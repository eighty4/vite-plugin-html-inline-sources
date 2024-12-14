# vite-plugin-html-inline-sources

A Vite plugin for inlining JS, CSS and SVG into `index.html` with a declarative `vite-inline` attribute.

```js
<script vite-inline src="index.js"></script>
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
