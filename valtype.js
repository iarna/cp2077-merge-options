'use strict'
const JSON = require('lossless-json') 
const Attribution = require('./attribution.js')
const TaggedValue = require('./tagged-value.js')

function valType (val) {
    val = deVal(val)
    const valTypeof = typeof val
    if (val !== null && valTypeof === 'object') {
        if (Array.isArray(val)) return 'array'
        if (val instanceof JSON.LosslessNumber) return 'scalar'
        return Array.isArray(val) ? 'array' : 'object'
    }
    return val === undefined ? 'undefined' : 'scalar'
}
exports.valType = valType

function deVal (val) {
    if (val instanceof TaggedValue) val = val.toJSON()
    if (val instanceof Attribution) val = val.toJSON()
    return val instanceof JSON.LosslessNumber ? val.valueOf() : val
}
exports.deVal = deVal
