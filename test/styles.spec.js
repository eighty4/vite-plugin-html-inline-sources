import assert from 'node:assert/strict'
import {rm} from 'node:fs/promises'
import {describe, it} from 'node:test'
import {runViteBuild} from './run.js'

describe('<link rel="stylesheet" vite-inline>', () => {
    it('inlines css', async () => {
        const result = await runViteBuild({
            files: {
                'index.html': `<html><link vite-inline rel="stylesheet" href="lava_lamp.css"/></html>`,
                'lava_lamp.css': `.wax-glob { color: #cfff04; }`,
            },
        })
        assert.ok(result.success, result.output)
        assert.equal(
            await result.fromDistContent('index.html'),
            '<html><style>.wax-glob { color: #cfff04; }</style></html>',
            result.root,
        )
        assert.deepStrictEqual(['index.html'], await result.distFiles(), result.root)
        await rm(result.root, {recursive: true})
    })

    describe('errors', () => {
        it('for missing href', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><link rel="stylesheet" vite-inline/></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<link rel="stylesheet" vite-inline> is missing href attribute'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for unsupported filetype', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><link rel="stylesheet" vite-inline href="lava_lamp.gif"/></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<link rel="stylesheet" vite-inline> href extension .gif isn\'t a valid value', result.output))
            await rm(result.root, {recursive: true})
        })

        it('for network src', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><link vite-inline rel="stylesheet" href="https://cdn/index.css"/></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<link rel="stylesheet" vite-inline> must use a relative filesystem href path (network paths like https://cdn/index.css are unsupported)'), result.output)
            await rm(result.root, {recursive: true})
        })

        it('for missing file', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><link rel="stylesheet" href="strobe_light.css" vite-inline/></html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(result.output.includes('<link rel="stylesheet" vite-inline> could not find css file strobe_light.css'), result.output)
            await rm(result.root, {recursive: true})
        })
    })
})
