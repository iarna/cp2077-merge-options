'use strict'
const fs = require('fs').promises
const ini = require('ini')
const {UserError,LibError} = require('./errors.js')
const exists = require('./fs-exists.js')

const $initialize = Symbol('initialize')

exports = module.exports = async mo2path => {
    const mo2 = new MO2(mo2path)
    return await mo2[$initialize]()
}

class MO2 {
    constructor (mo2path) {
        this.path = mo2path
    }

    inWSL = false

    async [$initialize] () {
        if ('ini' in this) return this.ini
        this.inWSL = await exists('/proc/sys/fs/binfmt_misc/WSLInterop')
        const mo2ini_filename = `${this.path}/ModOrganizer.ini`
        let rawmo2ini
        try {
            rawmo2ini = await fs.readFile(mo2ini_filename, 'utf8')
        } catch (ex) {
            throw new UserError(`Error reading ${mo2ini_filename}: ${ex.message}`, {cause: ex})
        }
        try {
            this.ini = new MO2Ini(ini.parse(rawmo2ini))
            return this
        } catch (ex) {
            throw new UserError(`Error parsing ${mo2ini_filename}`, {cause: ex})
        }
    }
    async modlist (profile) {
        if (!this.ini) throw new UserError(`Called modlist() before initializing object`)
        if (!profile) {
            profile = this.ini.General.selected_profile
        }
        const modlist_filename = `${this.dir.profiles}/${profile}/modlist.txt`
        let modlist_txt
        try {
            modlist_txt = await fs.readFile(modlist_filename, 'utf8')
        } catch (ex) {
            throw new UserError(`Error reading ${modlist_filename}`, {cause: ex})
        }
        try {
            const modlist = modlist_txt.split(/\r?\n/)
            return modlist.filter(_ => !/^#/.test(_)).map(_ => ({active: _[0] === '+', name: _.slice(1)}))
        } catch (ex) {
            throw new LibError(`Error while parsing ${modlist_filename}`, {cause: ex})
        }
    }

    dir = new MO2.Dirs(this)

    modfolder (modname) {
        if (!this.ini) throw new UserError(`Called modlist() before initializing object`)
        return `${this.dir.mods}/${modname}`
    }

    get gamePath () {
        // if we're running from WSL convert the path
        if (this.inWSL) {
            return this.ini.General.gamePath
                .replace(/\\/g, '/')
                .replace(/^([A-Z]):/i, (_,drive) => `/mnt/${drive.toLowerCase()}`)
        } else {
            return this.ini.General.gamePath
        }
    }
}
exports.MO2 = MO2

MO2.Dirs = class MO2Dirs {
    constructor (mo2) {
        this.mo2 = mo2
    }
    get downloads () {
        const dir = this.mo2.ini.Settings.download_directory || '%BASE_DIR%/downloads'
        return dir.replace(/%BASE_DIR%/g, this.mo2.path)
    }
    get mods () {
        const dir = this.mo2.ini.Settings.mod_directory || '%BASE_DIR%/mods'
        return dir.replace(/%BASE_DIR%/g, this.mo2.path)
    }
    get profiles () {
        const dir = this.mo2.ini.Settings.profile_directory || '%BASE_DIR%/profiles'
        return dir.replace(/%BASE_DIR%/g, this.mo2.path)
    }
    get overwrite () {
        const dir = this.mo2.ini.Settings.overwrite_directory || '%BASE_DIR%/overwrite'
        return dir.replace(/%BASE_DIR%/g, this.mo2.path)
    }
}

const knownSections = exports.knownSections = [
  'General', 'PluginPersistance', 'Settings', 'customExecutables',
  'recentDirectories', 'Widgets', 'Servers', 'Plugins', 'pluginBlacklist',
  'Geometry', 'CompletedWindowTutorials'
]

const matchNumber = /^\d+$|^\d+[.]\d+$/
const matchType = /^@([A-Z][A-Za-z]+)\((.*)\)$/
const validTypes = exports.validTypes = {
    Size: {
        validate: _ => /^(\d+) (\d+)$/.test(_),
        value: _ => _.split(/ /).map(Number)
    },
    Variant: {
        validate: _ => true,
        value: _ => Buffer.from(_)
    },
    ByteArray: {
        validate: _ => true,
        value: _ => _
    },
}

const $ini = Symbol('ini')
const $get = Symbol('get')

class MO2Ini {
    #ini = null
    constructor (ini) {
        this.#ini = ini
        // generate shortcuts
        for (const section of [...knownSections, ...Object.keys(ini)]) {
            if (section in this) continue
            this[section] = Object.create(null)
            if (!(section in ini)) continue
            for (let inikey of Object.keys(ini[section])) {
                if (inikey in this[section]) continue
                this[section][inikey] = null;
                Object.defineProperty(this[section], inikey, { get: () => this.#get(section,inikey) })
            }
        }
    }
    #get (section, key) {
        if (!section in this.#ini) return
        if (!key in this.#ini[section]) return
        const value = this.#ini[section][key]
        if (value === 'true' || value === 'false') return Boolean(value === 'true')
        if (matchNumber.test(value)) return Number(value)
        const matched = matchType.exec(value)
        if (matched) {
            const [,initype, inivalue] = matched
            if (initype in validTypes) {
                const mo2type = validTypes[initype]
                if (mo2type.validate(inivalue)) {
                    return mo2type.value(inivalue)
                }
                throw new UserError(`[$key] Invalid entry, type "${initype}", value "${value}"`)
            }
            throw new LibError(`[${key}] Unknown MO2INI entry, type "${type}", value "${value}"`)
        }
        return value
    }
}
exports.MO2Ini = MO2Ini
