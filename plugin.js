import {readFile} from 'node:fs/promises'
import {join as joinPath} from 'node:path'
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
                const doc = parse(src, {
                    scriptingEnabled: false,
                    sourceCodeLocationInfo: true,
                    onParseError,
                })
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
 * @param {import('parse5').ParserError} err
 */
function onParseError(err) {
    switch (err.code) {
        case 'missing-doctype':
            return
    }
    console.error(err)
    throw Error('wtf')
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
        throw new Error(`${unsupportable} attribute not supported with vite-inline`)
    } else if (src === null) {
        throw new Error('vite-inline script does not have a src attr')
    } else if (src.endsWith('.ts')) {
        throw new Error('vite-inline script does not yet support typescript')
    } else if (src.startsWith('http')) {
        throw new Error('vite-inline script src must be a relative path')
    } else {
        const scriptContent = (await readFile(joinPath(ctx.root, src))).toString().trim()
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
