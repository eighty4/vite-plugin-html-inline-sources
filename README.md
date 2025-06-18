# vite-plugin-html-inline-sources

A Vite plugin for inlining JS, CSS and SVG into `index.html` with a declarative `vite-inline` attribute.

```html
<!-- CSS -->
<link vite-inline rel="stylesheet" href="index.css"/>

<!-- JavaScript -->
<script vite-inline type="module" src="index.js"></script>

<!-- TypeScript -->
<script vite-inline type="module" src="index.ts"></script>
```

## Why?

Performance gains from bundling JS and CSS sources in HTML are *extreme* and _visible_ to users immediately on page load.

This plugin should be used for code that applies custom theming, fonts, dark mode and CSS that curbs awkward
[flash of unstyled content](https://en.wikipedia.org/wiki/Flash_of_unstyled_content) 
before any network requests for CSS complete.

### Alternative approaches

There are Vite plugins for inlining sources in HTML that focus on inlining *all* sources into a single file.
Plugins that make HTML files without external dependencies are useful for embedded systems and
mobile apps. Check out
[vite-plugin-singlefile](https://www.npmjs.com/package/vite-plugin-singlefile) for those use cases.

## Install

```shell
pnpm i -D vite-plugin-html-inline-sources
```

## Usage

### vite.config.js

```js
import {defineConfig} from 'vite'
import inlining from 'vite-plugin-html-inline-sources'

export default defineConfig(() => {
    return {
        plugins: [inlining()]
    }
})
```

### index.html

```html
<html lang="en">
<body>
    <script vite-inline src="index.ts"></script>
</body>
</html>
```

### `vite-inline` for JavaScript

#### <script vite-inline src="index.[js|ts]">

The default behavior of `vite-inline` is to transform TypeScript to JavaScript
and to minify sources. This process is done with `esbuild.build`.

#### <script vite-inline="-minify" src="index.[js|ts]">

To opt out of minifying, use a `-minify` value for `vite-inline`.

With minifying disabled and without `type=module` or a TypeScript source,
the inlined script will be read from disk and inlined as-is.

#### <script vite-inline type="module" src="index.[js|ts]">

_don't forget type="module" if you use top-level-await or any other ESM module features_

### `vite-inline` for CSS

#### <link vite-inline src="index.css">

CSS will be inlined as-is with a read of the file from your project directory.

Currently, nothing is done to minify CSS or support `@import` within your CSS.
`lightningcss` could provide support for both features.
