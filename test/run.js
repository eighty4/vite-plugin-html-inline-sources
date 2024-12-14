import * as child_process from 'node:child_process'
import {mkdir, mkdtemp, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join as joinPath} from 'node:path'
import BuildResult from './result.js'

const VITE_CONFIG = `
    import {defineConfig} from 'vite'
    import htmlInlineSources from 'vite-plugin-html-inline-sources'
    
    export default defineConfig(() => {
        return {
            plugins: [htmlInlineSources()]
        }
    })
`

/**
 * @return {Promise.<BuildResult>}
 */
export async function runViteBuild(opts) {
    if (!opts) throw new Error('opts is required')
    if (!opts.files || !Object.keys(opts.files).length) throw new Error('opts.files is required')
    if (!opts.label) throw new Error('opts.label is required')

    // write opts.files to temp directory
    const LABEL = 'html-inline-sources-'
    const root = await mkdtemp(joinPath(tmpdir(), LABEL))
    for (const filename in opts.files) {
        await writeFile(joinPath(root, filename), opts.files[filename])
    }

    // create node_modules with vite and vite-plugin-html-inline-sources
    await mkdir(joinPath(root, 'node_modules'))
    await symlink(process.cwd(), joinPath(root, 'node_modules/vite-plugin-html-inline-sources'))
    await symlink(joinPath(process.cwd(), 'node_modules/vite'), joinPath(root, 'node_modules/vite'))

    // create vite.config.mjs (ts or js would require a package.json with {"type": "module"}
    await writeFile(joinPath(root, 'vite.config.mjs'), VITE_CONFIG)

    // run `node vite.js build`
    return new Promise((res, rej) => {
        const viteProcess = child_process.spawn('node', [
            joinPath(process.cwd(), 'node_modules/vite/bin/vite.js'),
            'build',
        ], {cwd: root})
        let output = ''
        const append = (bytes) => output += bytes.toString()
        viteProcess.stdout.on('data', append)
        viteProcess.stderr.on('data', append)
        viteProcess.on('error', rej)
        viteProcess.on('exit', (exitCode) => {
            res(new BuildResult(root, output, exitCode === 0))
        })
    })
}
