# vite-plugin-html-inline-sources

A Vite plugin for inlining JS, CSS and SVG into index.html with a declarative vite-inline attribute.

```js
<script vite-inline src="index.js"></script>
```

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
    <script vite-inline src="index.js"></script>
</body>
</html>
```
