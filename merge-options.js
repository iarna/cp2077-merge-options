'use strict'
const fs = require('fs')
const util = require('util')
const Attribution = require('./attribution.js')
const TaggedValue = require('./tagged-value.js')
//const {disp} = require('./disp-json.js')
const disp = require('./disp-yaml.js')
const {valType,deVal} = require('./valtype.js')

// needed to preserve a float/int distinction that Cyberpunk can be
// inappropriately picky about.
const JSON = require('lossless-json') 
const MO2Info = require('./mo2.js')
const cleanPath = require('./clean-path.js')

// because fs.promises.exists does not... exist and fs.process.access is awful
const exists = require('./fs-exists.js')

exports.findOptionsFiles = async function getOptionsFiles(mo2, outputMod) {
    let optionsFiles = []
    await Promise.all((await mo2.modlist()).reverse().map(async mod => {
        if (!mod.active) return
        if (mod.name === outputMod) return
        const optionsFile = cleanPath(`${mo2.modfolder(mod.name)}/r6/config/settings/platform/pc/options.json`)
        if (!await exists(optionsFile)) return
        optionsFiles.push({mod: mod.name, file: optionsFile})
    }))
    return optionsFiles
}
exports.mergeOptions = function mergeOptions (mo2, optionsFiles, defaultOptions, mergedOptions) {
    const defaultOptionsFile = cleanPath(`${mo2.gamePath}/r6/config/settings/platform/pc/options.json`)
    if (!defaultOptions) defaultOptions = JSON.parse(fs.readFileSync(defaultOptionsFile, 'utf8'))
    if (!mergedOptions) mergedOptions = JSON.parse(fs.readFileSync(defaultOptionsFile, 'utf8'))
    let optionsData = {}

    for (const {mod, file} of optionsFiles) {
        optionsData[mod] = JSON.parse(fs.readFileSync(file, 'utf8'))
    }

    for (const [mod,optionsContent] of Object.entries(optionsData)) {
        mergemod(mod, mod, optionsContent, mergedOptions, defaultOptions)
    }

    const changes = getchanges(defaultOptions, mergedOptions)
    const changeSummary = disp(summarizeChanges(changes))
    return {merged: mergedOptions, changeSummary, changes}
}

function summarizeChanges(changes) {
    const changeTree = {}

    for (const [path, action, to, from] of changes) {
        let branch = changeTree
        let terminalNode
        let terminalBranch
        let node
        while (node = path.shift()) {
            if (valType(node) === 'object') continue
            terminalNode = node
            terminalBranch = branch
            if (node in branch) {
                branch = branch[node]
            } else {
                const limb = {}
                branch[node] = limb
                branch = limb
            }
        }
        let entry = []
        //if (to instanceof Attribution) entry.push(`[${to.src}]`)
        if (action === 'SET' || action === 'ADD') {
            if (entry.length === 0 && to != null && from == null) {
                entry = deVal(to)
            } else if (to != null || from != null) {
                if (to != null) {
                    entry.push(deVal(to))
                }
                if (from != null) {
                    entry.push({default: deVal(from)})
                }
            } else {
                throw new Error('Both from and to values are null in SET: ' + JSON.stringify([path, action, to, from]))
            }
        } else if (action === 'REMOVE') {
            entry.push([deVal(from)])
        } else {
            entry.push(action)
            if (to != null) entry.push(deVal(to))
            if (from != null) entry.push({default: deVal(from)})
        }
        terminalBranch[terminalNode] = new TaggedValue(entry, action.toLowerCase())
    }
    return changeTree
}

function getchanges(from, to, _path=[]) {
    const changes = []
    const dispFrom = disp(from)
    const dispTo = disp(to)
    if (disp(from) === disp(to)) return changes

    const toType = valType(to)
    if (toType === 'scalar') {
        const path = [..._path]
        if (from === undefined) {
            return [[path, 'SET', to]]
        } else if (!cmp(from, to)) {
            return [[path, 'SET', to, from]]
        }
    } else if (toType === 'array') {
        const arrayType = valType(to[0])
        const toName = arrayType === 'object' && findName(to[0])
        if (!toName) {
            if (disp(from) !== disp(to)) {
                changes.push([_path, 'SET', to, from])
            }
            return changes
        }
        // adds and changes
        for (const [ii, toVal] of Object.entries(to)) {
            //const path = [..._path, '[]', {[toName]: `${toVal[toName]}`}]
            const path = [..._path, `[${toVal[toName]}]`]
            const toValStr = disp(toVal)
            const fromVal = toName && from.find(_ => _[toName] === toVal[toName])
            // it's a named object, which we treate as an ordered map
            if (arrayType === 'object' && fromVal != null) {
                // if we found a match, but it's not identical then iterate to find the changes
                if (disp(fromVal) !== toValStr) {
                   changes.push(...getchanges(fromVal, toVal, path))
                }
            } else {
                // non named matches, we just report adding outright
                if (!from.find(_ => disp(_) === toValStr)) {
                    changes.push([path,'ADD', toVal])
                }
            }
        }
        // removes may not actually be possible given how we walk things --
        // changes to simple arrays are aggregated, and complex arrays 
        // we iterate into
        for (const [ii, fromVal] of Object.entries(from)) {
            const toVal = toName && to.find(_ => _[toName] === fromVal[toName])
            // it's a named object, which we treate as an ordered map
            if (arrayType === 'object' && toVal) {
                //const path = [..._path, '[]', {toName: toVal[toName]} ]
                const path = [..._path, `[${toVal[toName]}]`]
                if (!to.find(_ => _[toName] === fromVal[toName])) {
                   changes.push([path, 'REMOVED', null, fromVal])
                }
            } else {
                //const path = [..._path, `[]`, ii]
                const path = [..._path, `[${ii}]`]
                const fromValStr = disp(fromVal)
                if (!to.find(_ => disp(_) === fromValStr)) {
                    changes.push([path, 'REMOVED', null, fromVal])
                }
            }
        }
    } else {
        // adds and changes
        for (const key of Object.keys(to)) {
            const path = [..._path, key]
            const toSubType = valType(to[key])
            let fromVal = from[key]
            if (toSubType === 'array') {
                fromVal = from[key] || []
            } else if (toSubType === 'object') {
                fromVal = from[key] || {}
            }
            changes.push(...getchanges(fromVal, to[key], path))
        }
        // removes
        for (const key of Object.keys(from)) {
            if (key in to) continue
            const path = [...path, key]
            changes.push([path, 'REMOVED', null, from[key]])
        }
    }
    return changes 
}

function cmp (v1, v2) {
    return disp(v1) === disp(v2)
}

function findName (val) {
    if (valType(val) !== 'object') return
    const labels = ['group_name', 'name','display_name']
    for (const maybe of labels) {
        if (maybe in val) return maybe
    }
}

function mergemod (mod, _keypath, newOptions, mergedOptions, defaults={}) {
    for (const key of Object.keys(newOptions)) {
        const keypath = _keypath + '.' + key
        const newValue = newOptions[key]
        const newValueType = valType(newValue)
        if (!(key in mergedOptions)) {
            mergedOptions[key] = new Attribution(newValue, mod)
            continue
        }
        const mergeType = valType(mergedOptions[key])
        if (newValueType !== mergeType) {
            throw new Error(`${keypath} changed type of key from ${mergeType} to ${newValueType}`)
        } else if (disp(newValue) === disp(defaults[key]))  {
            // if the new value is entirely defualts, skip
            continue
        } else if (disp(mergedOptions[key]) === disp(newValue)) {
            // if a previous mod already set it to the same value, skip
            continue
        } else if (newValueType === 'array') {
            const firstElement = Object.keys(newValue)[0]
            const newValueElementType = valType(newValue[firstElement])
            const valName = findName(newValue[firstElement])
            const mixedTypes = newValue.map(_ => valType(_)).filter(_ => _ !== newValueElementType)
            if (mixedTypes.length) {
                throw new Error(`Found mixed array, expected ${newValueElementType}, got ${disp(mixedTypes)} for ${keypath}`)
            }
            function ident(obj) {
                return valName ? deVal(obj)[valName] : disp(obj)
            }
            function mergeMatch(oldValue, val) {
                const valIdentity = ident(val)
                return oldValue.findIndex(_ => ident(_) === valIdentity)
            }

            let attribValues = true
            if (!(key in mergedOptions)) {
                mergedOptions[key] = new Attribution([], mod)
                attribValues = false
            }
            const mergeValue = deVal(mergedOptions[key])

            for (let ii=0; ii<newValue.length; ++ii) {
                const val = newValue[ii]
                const attrVal = attribValues ? new Attribution(val, mod) : val
                const oldIndex = mergeMatch(mergeValue, val)
                if (oldIndex === -1) {
                    const nextValues = newValue.slice(ii+1,Infinity)
                    const prevValues = newValue.slice(0,ii).reverse()
                    const nextMatchIndex = mergeValue.findIndex(_ => mergeMatch(nextValues,_) !== -1)
                    const prevMatchIndex = mergeValue.findIndex(_ => mergeMatch(prevValues,_) !== -1)
                    if (nextValues.length && nextMatchIndex !== -1) {
                        mergeValue.splice(nextMatchIndex,0, attrVal)
                    } else if (prevValues.length && prevMatchIndex !== -1) {
                        mergeValue.splice(1+(newValue.length - prevMatchIndex),0, attrVal)
                    } else {
                        // if we have only new values then just append
                        mergeValue.push(attrVal)
                    }
                } else {
                    // matched objects get 
                    if (valName && newValueElementType === 'object') {
                        // if it exists in the array, but is a named object then we'll iterate into it
                        const valIdentity = ident(valName,val)
                        const defaultIndex = key in defaults ? defaults[key].findIndex(_ => ident(valName, _) === valIdentity) : -1
                        const defaultValue = defaultIndex !== -1 ? defaults[key][defaultIndex] : newValueElementType === 'object' ? {} : []
                        mergemod(mod, `${keypath}.${valIdentity}`, val, mergeValue[oldIndex], defaultValue)
                    }
                }
            }
        } else if (newValueType === 'object') {
            const subDefault = key in defaults ? defaults[key] : {}
            mergemod(mod, keypath, newValue, mergedOptions[key], subDefault)
        } else if (newValueType === 'scalar') {
           // if the value from the ini is different than the defaults...
           if (!(key in defaults) || !cmp(newValue, defaults[key])) {
               mergedOptions[key] = new Attribution(newValue, mod)
           }
        } else {
           throw new Error(keypath+': hit a weird thing: ' + newValueType)
        }
    }
    return mergedOptions
}
