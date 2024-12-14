import {readFile} from 'node:fs/promises'
import {join as joinPath} from 'node:path'
import {transform as esbuildTransform} from 'esbuild'
import MagicString from 'magic-string'
import {defaultTreeAdapter, html, parse, serialize} from 'parse5'

/**
 * @returns {import('vite').Plugin}
 */
export default function htmlInlineSources() {
    return {
        apply: 'build',
        enforce: 'pre',
        name: 'vite-plugin-html-inline-sources',
        async transform(src, id) {
            if (id.endsWith('.html')) {
                const doc = parseHtmlDocument(src)
                const ctx = {
                    html: new MagicString(src),
                    root: id.substring(0, id.lastIndexOf('/')),
                }
                if (await transform(doc, ctx)) {
                    return ctx.html.toString()
                }
            }
        },
    }
}

/**
 * @param {string} html
 * @returns {import('parse5').DefaultTreeAdapterTypes.Document}
 */
function parseHtmlDocument(html) {
    try {
        return parse(html, {
            scriptingEnabled: false,
            sourceCodeLocationInfo: true,
            onParseError,
        })
    } catch (e) {
        throw new Error('parse5 HTML error: ' + e.code)
    }
}

/**
 * @param {import('parse5').ParserError} err
 */
function onParseError(err) {
    switch (err.code) {
        case 'missing-doctype':
        case 'abandoned-head-element-child':
        case 'duplicate-attribute':
        case 'non-void-html-element-start-tag-with-trailing-solidus':
        case 'unexpected-question-mark-instead-of-tag-name':
            return
    }
    // todo map source location to code
    throw err
}

/**
 * @typedef {Object} TransformCtx
 * @property {import('magic-string').default} html
 * @property {string} root
 *
 * @param {import('parse5').DefaultTreeAdapterTypes.Node} node
 * @param {TransformCtx} ctx
 * @returns {Promise<boolean>}
 */
// todo inline css
// todo inline svg
async function transform(node, ctx) {
    if (node.childNodes && node.childNodes.length) {
        return (
            await Promise.all(
                node.childNodes.map((childNode) =>
                    childNode.nodeName === 'script'
                        ? transformScript(childNode, ctx)
                        : transform(childNode, ctx),
                ),
            )
        ).some(mutated => mutated)
    } else {
        return false
    }
}

/**
 * @param {import('parse5').DefaultTreeAdapterTypes.ChildNode} node
 * @param {TransformCtx} ctx
 * @returns {Promise<boolean>}
 */
// todo bundling imports
// todo transpiling ts
// todo minifying content
async function transformScript(node, ctx) {
    let ignored = false
    let inline = false
    /**
     * @type {null|string}
     */
    let src = null
    let unsupportable = false
    for (const attr of node.attrs) {
        switch (attr.name) {
            case 'vite-inline':
                inline = true
                break
            case 'src':
                src = attr.value
                break
            case 'vite-ignore':
                ignored = true
                break
            default:
                unsupportable = attr.name
        }
    }
    if (ignored || !inline) {
        return false
    } else if (unsupportable) {
        throw new Error(`<script vite-inline> does not work with ${unsupportable} attribute (and only supports the src attribute)`)
    } else if (src === null) {
        throw new Error('<script vite-inline> is missing src attribute')
    } else if (src.startsWith('http')) {
        throw new Error(`<script vite-inline> muse use a relative filesystem src path (network paths like ${src} are unsupported)`)
    } else {
        const filename = src.substring(src.lastIndexOf('/'))
        const extension = filename.substring(filename.lastIndexOf('.') + 1)
        if (!['js', 'mjs', 'ts'].includes(extension)) {
            throw new Error(`<script vite-inline> does not support src extension .${extension}`)
        }
        const sourceContent = await readFileContent(ctx, src)
        const scriptContent = extension === 'ts' ? await processTypeScript(src, sourceContent) : sourceContent
        const documentFragment = defaultTreeAdapter.createDocumentFragment()
        const scriptElement = defaultTreeAdapter.createElement('script', html.NS.HTML, [])
        const textNode = defaultTreeAdapter.createTextNode(scriptContent)
        defaultTreeAdapter.appendChild(documentFragment, scriptElement)
        defaultTreeAdapter.appendChild(scriptElement, textNode)
        ctx.html.update(
            node.sourceCodeLocation.startOffset,
            node.sourceCodeLocation.endOffset,
            serialize(documentFragment),
        )
        return true
    }
}

/**
 * @param {string} src
 * @param {string} ts
 * @returns Promise<string>
 */
// todo tsconfig.json
async function processTypeScript(src, ts) {
    try {
        const tsOutput = await esbuildTransform(ts, {
            loader: 'ts',
            platform: 'browser',
        })
        return tsOutput.code
    } catch (e) {
        throw new Error(`esbuild processing ${src}: ${e.message}`)
    }
}

/**
 * @param {TransformCtx} ctx
 * @param {string} src
 * @returns Promise<string>
 */
async function readFileContent(ctx, src) {
    try {
        return (await readFile(joinPath(ctx.root, src))).toString().trim()
    } catch (e) {
        throw new Error(`<script vite-inline> could not find src ${src}`)
    }
}
