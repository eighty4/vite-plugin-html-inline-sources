import { readdir, readFile } from 'node:fs/promises'
import { join as joinPath } from 'node:path'

export default class BuildResult {
    constructor(root, output, success) {
        this.root = root
        this.output = output
        this.success = success
    }

    /**
     * @returns {boolean}
     */
    get error() {
        return !this.success
    }

    /**
     * @returns {Promise<Array<string>>}
     */
    async distFiles() {
        return readdir(joinPath(this.root, 'dist'))
    }

    /**
     * @param {string} filename
     * @returns {Promise<string>}
     */
    async fromDistContent(filename) {
        return (
            await readFile(joinPath(this.root, 'dist', filename))
        ).toString()
    }

    /**
     * @param {string} filename
     * @param {string} searchString
     * @returns {Promise<boolean>}
     */
    async fromDistIncludes(filename, searchString) {
        return (await this.fromDistContent(filename)).includes(searchString)
    }

    /**
     * @param {string} filename
     * @param {string} searchString
     * @returns {Promise<boolean>}
     */
    async fromDistOmits(filename, searchString) {
        return !(await this.fromDistIncludes(filename, searchString))
    }

    /**
     * @param {string} filename
     * @params {RegExp} pattern
     * @returns {Promise<boolean>}
     */
    async fromDistTest(filename, pattern) {
        return pattern.test(await this.fromDistContent(filename))
    }
}
