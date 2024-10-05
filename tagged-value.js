'use strict'
const util = require('util')

module.exports = class TaggedValue {
    constructor (value, tag) {
        this.value = value
        this.tag = tag
    }
    toJSON () {
        return this.value
    }
    [util.inspect.custom]() {
        return `[TaggedValue: !${this.tag} ${disp(this.value)}]`
    }
}
