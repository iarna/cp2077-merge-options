'use strict'
const JSON = require('lossless-json')
const TaggedValue = require('./tagged-value.js')
const Attribution = require('./attribution.js')
const {valType, deVal} = require('./valtype.js')

function seq (from, to) {
    const res = []
    for (let ii=from; ii<to; ++ii) res.push(ii)
    return res
}
function indent (amt) {
    return seq(0,amt).map(()=>' ').join('')
}

function disp (rawValue, sp=0, inline) {
    const vv = deVal(rawValue)
    let result
    if (rawValue instanceof TaggedValue) { return dispTaggedValue(rawValue, sp, inline) }
    else if (vv == null) { result = 'null' }
    else if (Array.isArray(vv)) { result = dispArray(vv, sp, inline) }
    else if (typeof vv !== 'object') { result = dispScalar(rawValue, sp, inline) }
    else { result = dispObject(vv, sp, inline) }
    if (inline && result.length > 80) {
        return disp(rawValue, sp, false)
    }
    return result
}
module.exports = disp

function dispTaggedValue (vv, sp, inline) {
    const tag = vv.tag
    const [to, from] = vv.value
    let result = `!${tag} `
    let attrval = to || from
    if (to && !from) {
        result += disp(to, sp, inline)
    } else if (!to && from) {
        result += disp(from, sp, inline)
    } else if (to && from) {
        result += disp(to, sp, inline)
    }
    if (!inline && attrval instanceof Attribution) {
        if (result.includes('\n')) {
            const lines = result.split('\n')
            lines[0] += ' # @ ' + attrval.src
            result = lines.join('\n')
        } else if (!result.includes('# @')) {
            result += ' # @ ' + attrval.src
        }
    }
    return result
}

function dispScalar (vv, sp, inline) {
    let result = String(deVal(vv))
    if (!inline && vv instanceof Attribution) {
        result += ' # @ ' + vv.src
    }
    return result
}

function dispObject (vv, sp, inline) {
    return inline ? dispObjectInline(vv, sp, inline) : dispObjectMultiline(vv, sp, inline)
}

function dispArray (vv, sp, inline) {
    if (vv.length === 0) return '[]'

    const firstValueType = valType(vv[0])
    if (inline || (inline !== false && firstValueType === 'scalar' || firstValueType === 'array')) {
        const str = dispArrayInline(vv, sp)
        return str
    } 
    return dispArrayMultiline(vv, sp+4)
}

function safeKey (key) {
    return /[ "'\[]/.test(key) ? JSON.stringify(key) : key
}
function dispObjectInline (vv, sp) {
    return '{ '
         + Object.entries(vv)
                 .map(([key, value]) => `${safeKey(key)}: ${disp(value, sp+safeKey(key).length+2, true)}`)
                 .join(', ')
         + ' }'
}

function dispArrayInline (vv, sp) {
    return '[ ' + vv.map(_ => disp(_, sp, true)).join(', ') + ' ]'
}

function dispObjectMultiline (vv, sp) {
    return '\n' + indent(sp)
         + Object.entries(vv).map(([key,val]) => `${safeKey(key)}: ${disp(val, sp+4, false)}`)
             .join('\n'+indent(sp))
         + '\n'
}

function dispArrayMultiline (vv, sp) {
    return '\n' + indent(sp) + '- '
         + vv.map(_ => disp(_, sp+4))
             .join('\n'+indent(sp)+'- ')
         + '\n'
}
