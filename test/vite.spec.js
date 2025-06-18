import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { runViteBuild } from './run.js'

describe('html parsing', () => {
    describe('errors', () => {
        it('for parse5 error', async () => {
            const result = await runViteBuild({
                files: {
                    'index.html': '<html><scripipt</html>',
                },
            })
            assert.ok(result.error, result.output)
            assert.ok(
                result.output.includes(
                    'parse5 HTML error: unexpected-solidus-in-tag',
                ),
                result.output,
            )
            await rm(result.root, { recursive: true })
        })
    })
})
