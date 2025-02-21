'use strict'
const os = require('os')

const inWSL = process.env.WSL_INTEROP ? true : false
const isLinux = os.type() === 'Linux'

module.exports = function cleanPath (path) {
    let cleaned = path.replace(/\\/g, '/').replace(/[/]+/g, '/').replace(/[/]$/, '')
    if (isLinux) {
        if (inWSL) cleaned = cleaned.replace(/^([A-Z]):/i, (_,drive) => `/mnt/${drive.toLowerCase()}`)
    } else {
        cleaned = cleaned.replace(/[/]/g, '\\')
    }
    return cleaned
}
