'use strict'
const util = require('util')

module.exports = class Attribution {
    constructor (value, src) {
        this.value = value
        this.src = src
    }
    toJSON () {
        return this.value
    }
    [util.inspect.custom]() {
        return `[Attribution: ${JSON.stringify(this.value)} @ ${this.src}]`
    }
}
