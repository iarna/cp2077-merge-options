'use strict'
const TaggedValue = require('./tagged-value.js')
const {valType, deVal} = require('./valtype.js')

function seq (from, to) {
   const res = []
   for (let ii=from; ii<to; ++ii) res.push(ii)
   return res
}
function indent (amt) {
    return seq(0,amt).map(()=>' ').join('')
}

function disp (vv, sp=0, inline=false) {
    const tag = vv instanceof TaggedValue ? `!${vv.tag} ` : ''
    vv = deVal(vv)

    if (vv == null) return tag+'null'
    if (Array.isArray(vv)) return tag + dispArray(vv, sp, inline)
    if (typeof vv === 'object') return tag + dispObject(vv, sp, inline)

    return tag+dispScalar(vv, sp, inline)
}
module.exports = disp

function dispScalar (vv, sp, inline) {
    vv = deVal(vv)
    return vv
}

function dispObject (vv, sp, inline) {
    return inline ? dispObjectInline(vv, sp, inline) : dispObjectMultiline(vv, sp, inline)
}

function dispArray (vv, sp, inline) {
    if (vv.length === 0) return '[]'

    const firstValueType = valType(vv[0])
    if (inline || firstValueType === 'scalar' || firstValueType === 'array') {
        const str = dispArrayInline(vv, sp)
        return str
    } 
    return dispArrayMultiline(vv, sp+4)
}

function safeKey (key) {
    return / "'/.test(key) ? JSON.stringify(key) : key
}
function dispObjectInline (vv, sp) {
    return '{ '
         + Object.entries(vv)
                 .map(([key, value]) => `${safeKey(key)}: ${disp(value, sp+safeKey(key).length+2, true)}`)
                 .join(', ')
         + '}'
}

function dispArrayInline (vv, sp) {
    return '[ ' + vv.map(_ => disp(_, sp, true)).join(', ') + ' ]'
}

function dispObjectMultiline (vv, sp) {
    return '\n' + indent(sp)
         + Object.entries(vv).map(([key,val]) => `${safeKey(key)}: ${disp(val, sp+4)}`)
             .join('\n'+indent(sp))
         + '\n'
}

function dispArrayMultiline (vv, sp) {
    return '\n' + indent(sp) + '- '
         + vv.map(_ => disp(_, sp+4))
             .join('\n'+indent(sp)+'- ')
         + '\n'
}
