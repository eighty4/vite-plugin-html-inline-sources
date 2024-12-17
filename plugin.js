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
// todo inline svg
async function transform(node, ctx) {
    if (node.childNodes && node.childNodes.length) {
        return (
            await Promise.all(
                node.childNodes.map((childNode) => {
                    if (childNode.nodeName === 'script') {
                        return transformScript(childNode, ctx)
                    } else if (childNode.nodeName === 'link') {
                        return transformStyle(childNode, ctx)
                    } else {
                        return transform(childNode, ctx)
                    }
                }),
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
        throw new Error(`<script vite-inline> must use a relative filesystem src path (network paths like ${src} are unsupported)`)
    } else {
        const filename = src.substring(src.lastIndexOf('/'))
        const extension = filename.substring(filename.lastIndexOf('.') + 1)
        if (!['js', 'mjs', 'ts'].includes(extension)) {
            throw new Error(`<script vite-inline> does not support src extension .${extension}`)
        }
        updateInlinedHtml(ctx, node, createInlinedHtml('script', extension === 'ts'
            ? await processTypeScript(src, await readScript(ctx, src))
            : await readScript(ctx, src)))
        return true
    }
}

/**
 * @param {TransformCtx} ctx
 * @param {string} src
 * @returns Promise<string>
 */
async function readScript(ctx, src) {
    try {
        return await readFileContents(ctx, src)
    } catch (e) {
        throw new Error(`<script vite-inline> could not find src ${src}`)
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
 * @param {import('parse5').DefaultTreeAdapterTypes.ChildNode} node
 * @param {TransformCtx} ctx
 * @returns {Promise<boolean>}
 */
async function transformStyle(node, ctx) {
    let ignored = false
    let inline = false
    /**
     * @type {null|string}
     */
    let href = null
    let stylesheet = false
    for (const attr of node.attrs) {
        switch (attr.name) {
            case 'vite-inline':
                inline = true
                break
            case 'rel':
                if (attr.value === 'stylesheet') {
                    stylesheet = true
                }
                break
            case 'href':
                href = attr.value
                break
            case 'vite-ignore':
                ignored = true
                break
        }
    }
    if (!stylesheet || ignored || !inline) {
        return false
    } else if (href === null) {
        throw new Error('<link rel="stylesheet" vite-inline> is missing href attribute')
    } else if (href.startsWith('http')) {
        throw new Error(`<link rel="stylesheet" vite-inline> must use a relative filesystem href path (network paths like ${href} are unsupported)`)
    } else {
        const filename = href.substring(href.lastIndexOf('/'))
        const extension = filename.substring(filename.lastIndexOf('.') + 1)
        if (extension !== 'css') {
            throw new Error(`<link rel="stylesheet" vite-inline> href extension .${extension} isn't a valid value`)
        }
        /**
         * @type {undefined|string}
         */
        let css
        try {
            css = await readFileContents(ctx, href)
        } catch (e) {
            throw new Error(`<link rel="stylesheet" vite-inline> could not find css file ${href}`)
        }
        updateInlinedHtml(ctx, node, createInlinedHtml('style', css))
        return true
    }
}

/**
 * @param {TransformCtx} ctx
 * @param {string} src
 * @returns Promise<string>
 */
async function readFileContents(ctx, src) {
    return (await readFile(joinPath(ctx.root, src))).toString().trim()
}

/**
 * @param {string} tagName
 * @param {string} textContent
 * @returns string
 */
function createInlinedHtml(tagName, textContent) {
    const documentFragment = defaultTreeAdapter.createDocumentFragment()
    const styleElement = defaultTreeAdapter.createElement(tagName, html.NS.HTML, [])
    const textNode = defaultTreeAdapter.createTextNode(textContent)
    defaultTreeAdapter.appendChild(documentFragment, styleElement)
    defaultTreeAdapter.appendChild(styleElement, textNode)
    return serialize(documentFragment)
}

/**
 * @param {TransformCtx} ctx
 * @param {import('parse5').DefaultTreeAdapterTypes.ChildNode} node node
 * @param {string} html
 */
function updateInlinedHtml(ctx, node, html) {
    ctx.html.update(
        node.sourceCodeLocation.startOffset,
        node.sourceCodeLocation.endOffset,
        html,
    )
}
