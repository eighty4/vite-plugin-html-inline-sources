import assert from 'node:assert/strict'
import {rm} from 'node:fs/promises'
import {describe, it} from 'node:test'
import {runViteBuild} from './run.js'

describe('<script vite-inline>', () => {
    it('inlines javascript', async () => {
        for (const src of ['/index.js', './index.js', 'index.js']) {
            const result = await runViteBuild({
                files: {
                    'index.html': `<html><script vite-inline src="${src}"></script></html>`,
                    'index.js': `console.log(location.search)`,
                },
            })
            assert.ok(result.success, result.output)
            assert.equal(
                await result.fromDistContent('index.html'),
                '<html><script>console.log(location.search)</script></html>',
                result.root,
            )
            assert.deepStrictEqual(['index.html'], await result.distFiles(), result.root)
            await rm(result.root, {recursive: true})
        }
    })

    it('inlines javascript type="module"', async () => {
        for (const src of ['/index.js', './index.js', 'index.js']) {
            const result = await runViteBuild({
                files: {
                    'index.html': `<html><script vite-inline src="${src}" type="module"></script></html>`,
                    'index.js': `import './delegate.js'`,
                    'delegate.js': `console.log(location.search)`,
                },
            })
            assert.ok(result.success, result.output)
            assert.equal(
                await result.fromDistContent('index.html'),
                `<html><script  type="module">// delegate.js
console.log(location.search);
</script></html>`,
                result.root,
            )
            assert.deepStrictEqual(['index.html'], await result.distFiles(), result.root)
            await rm(result.root, {recursive: true})
        }
    })

    it('inlines typescript', async () => {
        for (const src of ['/index.ts', './index.ts', 'index.ts']) {
            const result = await runViteBuild({
                files: {
                    'index.html': `<html><script vite-inline src="${src}"></script></html>`,
                    'index.ts': `
                        class Foo {
                            constructor(private readonly asdf: any) {}
                        
                            isAsdfy(): boolean {
                                return !!this.asdf
                            }
                        }
                        
                        new Foo('0').isAsdfy()
                    `,
                },
            })
            assert.ok(result.success, result.output)
            assert.equal(
                await result.fromDistContent('index.html'),
                `<html><script>// index.ts
var Foo = class {
  constructor(asdf) {
    this.asdf = asdf;
  }
  isAsdfy() {
    return !!this.asdf;
  }
};
new Foo("0").isAsdfy();
</script></html>`,
                result.root,
            )
            assert.deepStrictEqual(['index.html'], await result.distFiles(), result.root)
            await rm(result.root, {recursive: true})
        }
    })

    it('esbuild shakin\' the tree', async () => {
        for (const src of ['/index.ts', './index.ts', 'index.ts']) {
            const result = await runViteBuild({
                files: {
                    'index.html': `<html><script vite-inline src="${src}"></script></html>`,
                    'index.ts': `
                        import {getDeviceInfo} from './deviceInterface.js'
                        console.log(getDeviceInfo())
                    `,
                    'deviceInterface.ts': `
                        export function getDeviceInfo() {
                            return 'google tv'
                        }
                        export function getDeviceVersion() {
                            return '8675309'
                        }
                    `,
                },
            })
            assert.ok(result.success, result.output)
            assert.ok(await result.fromDistOmits('index.html', 'getDeviceVersion'), result.root)
            assert.deepStrictEqual(['index.html'], await result.distFiles(), result.root)
            await rm(result.root, {recursive: true})
        }
    })

    describe('errors', () => {
        it('for additional attributes', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': `
                        <html>
                            <script vite-inline src="index.js" fetchpriority="high"></script>
                        </html>`,
                    'index.js': `console.log(location.search)`,
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<script vite-inline> does not work with fetchpriority attribute (and only supports the src and type="module" attributes)'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for type="whatever" attribute', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': `
                        <html>
                            <script vite-inline src="index.js" type="whatever"></script>
                        </html>`,
                    'index.js': `console.log(location.search)`,
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<script vite-inline> does not work with type="whatever" attribute (and only supports the src and type="module" attributes)'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for missing src', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline></script></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<script vite-inline> is missing src attribute'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for unsupported filetype', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline src="index.pdf"></script></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<script vite-inline> does not support src extension .pdf'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for network src', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline src="https://cdn/index.js"></script></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<script vite-inline> must use a relative filesystem src path (network paths like https://cdn/index.js are unsupported)'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for missing file', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline src="index.js"></script></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<script vite-inline> could not find src index.js'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for esbuild error', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline src="index.ts"></script></html>',
                    'index.ts': `class Foo {\nconsole.log('asdf')`,
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('esbuild processing index.ts'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for parse5 error', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><scripipt</html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('parse5 HTML error: unexpected-solidus-in-tag'), result.output)
            await rm(result.root, {recursive: true})
        })
    })
})
