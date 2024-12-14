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
                label: 'strip script vite-inline',
            })
            assert.ok(result.success, result.output)
            assert.equal(
                await result.fromDistContent('index.html'),
                '<html><script>console.log(location.search)</script></html>',
                result.root,
            )
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
                label: 'error for additional attributes',
            })
            assert.ok(result.error, result.output)
            await rm(result.root, {recursive: true})
        })

        it('for missing src', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline></script></html>',
                },
                label: 'error for missing src',
            })
            assert.ok(result.error, result.output)
            await rm(result.root, {recursive: true})
        })

        it('for typescript src', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline></script></html>',
                },
                label: 'error for typescript src',
            })
            assert.ok(result.error, result.output)
            await rm(result.root, {recursive: true})
        })

        it('for network src', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline></script></html>',
                },
                label: 'error for network src',
            })
            assert.ok(result.error, result.output)
            await rm(result.root, {recursive: true})
        })

        it('for missing file', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><script vite-inline></script></html>',
                },
                label: 'error for network src',
            })
            assert.ok(result.error, result.output)
            await rm(result.root, {recursive: true})
        })
    })
})
