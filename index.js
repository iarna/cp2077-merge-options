'use strict'
require('@iarna/cli')(main)
    .default('mod', 'Merged Options').alias('output-mod', 'mod').alias('output', 'mod').alias('outputMod', 'mod')
    .boolean('pause').default('pause', true)
    .boolean('dryrun').alias('n', 'dryrun').alias('dry-run', 'dryrun')
    .boolean('help').alias('?', 'help')

const fs = require('fs').promises
const MO2Info = require('./mo2.js')
const {findOptionsFiles,mergeOptions} = require('./merge-options.js')
// because fs.promises.exists does not... exist and fs.process.access is awful
const exists = require('./fs-exists.js')
const {UserError,LibError} = require('./errors.js')
const JSON = require('lossless-json') 
const cleanPath = require('./clean-path.js')

async function main(opts, mo2path) {
    const globalMO2Path = process.env.LOCALAPPDATA ? cleanPath(`${process.env.LOCALAPPDATA}/ModOrganizer/Cyberpunk 2077`) : undefined
    if (mo2path) mo2path = await fs.realpath(mo2path)
    if (!mo2path && globalMO2Path) {
        const globalIni = cleanPath(`${globalMO2Path}/ModOrganizer.ini`)
        if (await exists(globalIni)) mo2path = globalMO2Path
    }
    if (!mo2path) {
        if (await exists('./ModOrganizer.ini')) mo2path = await fs.realpath('.')
    }
    if (!mo2path) {
        if (await exists('../ModOrganizer.ini')) mo2path = await fs.realpath('..')
    }
    try {
        if (opts.help || !mo2path) {
            if (mo2path) console.error(`MO2 Ini:         ${cleanPath(mo2path+'/ModOrganizer.ini')}`)
            if (mo2path) console.error(``)
            const exec  = process.argv[1].replace(/^.*?([^\\/]+)$/, '$1')
            console.error(`Form: merge-options [--help|-?] [--no-pause] [--dryrun|-n] [<mo2path>] [--mod=<outputMod>]`)
            console.error(``)
            console.error(`  <mo2path>    The path that has your ModOrganizer2.ini. If you don't specify a`)
            console.error(`               path then merge-options will try to find ini in`)
            console.error(`               "${cleanPath('%LOCALAPPDATA%/ModOrganizer/Cyberpunk 2077')}", the folder`)
            console.error(`               it is running from, and the parent folder of that.`)
            console.error(`  <outputMod>  The name of the mod to write the merged ini file to. If it does`)
            console.error(`               not exist, it will be created. Default value is: Merged Options`)
            console.error(`  --no-pause   Don't wait for a keypress after running`)
            console.error(`  --dryrun     Don't write anything to disc, just report which files would be merged.`)
            throw 1
        }
        console.error(`MO2 Ini:         ${cleanPath(mo2path+'/ModOrganizer.ini')}`)
        let mo2 = await MO2Info(mo2path)
        if (mo2.ini.General.gameName !== 'Cyberpunk 2077') {
            throw new UserError(`This does not appear to be a Cyberpunk MO2 install (gameName: ${JSON.stringify(mo2.ini.General.gameName)})`)
        }
        console.error(`Game Path:       ${mo2.gamePath}`)
        console.error(`Output Mod Path: ${mo2.modfolder(opts.mod)}`)
        console.error(`Logs folder:     ${mo2.dir.logs}`)
        console.error(``)

        const optionsFiles = await findOptionsFiles(mo2, opts.mod)
        const {merged, changeSummary} = mergeOptions(mo2, optionsFiles)

        const output_folder = cleanPath(`${mo2.modfolder(opts.mod)}/r6/config/settings/platform/pc`)
        const output_file = cleanPath(`${output_folder}/options.json`)
        
        const writing = opts.dryrun ? 'Would have written' : 'Writing'

        console.error('Merged options from:')
        for (const {file} of optionsFiles) { console.error('\t' + file) }
        console.error(writing + ' merged options to: ' + output_file)
        if (!await exists(output_folder)) {
            if (!opts.dryrun) await fs.mkdir(output_folder, {recursive: true})
        }
        if (!opts.dryrun) await fs.writeFile(output_file, JSON.stringify(JSON.parse(JSON.stringify(merged)), null, 4))//.replace(/\r?\n/g,'\r\n'))

        const changes_path = cleanPath(mo2.dir.logs + '/options-json-merger-changes.yaml')
        if (!await exists(mo2.dir.logs)) {
            console.error("Your MO2 folder doesn't seem to have a logs folder,", opts.dryrun ? 'would have created it' : 'creating it')
            if (!opts.dryrun) fs.mkdirSync(mo2.dir.logs)
        }
        console.error(writing + ' change log to: ' + changes_path)
        if (changeSummary.trim().length === 0) {
            console.error('No changes to defaults detected!')
        }
        if (!opts.dryrun) await fs.writeFile(changes_path, changeSummary)
        
    } catch (ex) {
        if (ex instanceof Error) {
            console.error(ex.message)
            if (!(ex instanceof UserError)) {
                if (ex.cause) console.error(ex.cause.stack)
                console.error(ex.stack)
            }
        }
        process.exitCode = 1
    }
    if (!opts.help && opts.pause && process.stdin.setRawMode) {
        console.error('\nPress any key to continue...')
        process.stdin.setRawMode(true)
        await process.stdin.read({length: 1})
    }
}
