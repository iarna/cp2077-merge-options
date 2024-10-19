'use strict'
require('@iarna/cli')(main)
    .boolean('pause').default('pause', true)
    .boolean('dryrun').alias('n', 'dryrun')

const fs = require('fs').promises
const MO2Info = require('./mo2.js')
const {findOptionsFiles,mergeOptions} = require('./merge-options.js')
// because fs.promises.exists does not... exist and fs.process.access is awful
const exists = require('./fs-exists.js')
const {UserError,LibError} = require('./errors.js')
const JSON = require('lossless-json') 

async function main(opts, mo2path, outputMod='Merged Options') {
    if (!mo2path) {
        const exec  = process.argv[1].replace(/^.*?([^\\/]+)$/, '$1')
        console.error(`Form: merge-options <mo2path> [outputMod]`)
        console.error(`The default outputMod name is "Merged Options"`)
        throw 1
    }
    try {
        let mo2 = await MO2Info(mo2path)
        if (mo2.ini.General.gameName !== 'Cyberpunk 2077') {
            throw new UserError(`This does not appear to be a Cyberpunk MO2 install (gameName: ${JSON.stringify(mo2.ini.General.gameName)})`)
        }
        const optionsFiles = await findOptionsFiles(mo2, outputMod)
        const {merged, changeSummary} = await mergeOptions(mo2, optionsFiles)


        console.error('Merged options from:')
        for (const {file} of optionsFiles) { console.error('\t' + file) }
        const mod_directory = (mo2.ini.Settings.mod_directory || '%BASE_DIR%/mods').replace(/%BASE_DIR%/g, mo2.path)
        const output_folder = `${mod_directory}/${outputMod}/r6/config/settings/platform/pc`
        const output_file = `${output_folder}/options.json`
        
        const writing = opts.dryrun ? 'Would have written' : 'Writing'

        console.error(writing + ' merged options to: ' + output_file)
        if (!await exists(output_folder)) {
            if (!opts.dryrun) await fs.mkdir(output_folder, {recursive: true})
        }
        if (!opts.drynrun) await fs.writeFile(output_file, JSON.stringify(JSON.parse(JSON.stringify(merged)), null, 4))//.replace(/\r?\n/g,'\r\n'))

        const changes_path = mo2.path + '/logs/options-json-merger-changes.yaml'
        if (!await exists(mo2.path + '/logs')) {
            console.error("Your MO2 folder doesn't seem to have a logs folder, creating it")
            if (!opts.dryrun) fs.mkdirSync(mo2.path + '/logs')
        }
        console.error(writing + ' change log to: ' + changes_path)
        if (changeSummary.trim().length === 0) {
            console.error('No changes to defaults detected!')
        }
        if (!opts.dryrun) await fs.writeFile(changes_path, changeSummary)
        
    } catch (ex) {
        console.error(ex.message)
        if (!(ex instanceof UserError)) {
            if (ex.cause) console.error(ex.cause.stack)
            console.error(ex.stack)
        }
        throw 1
    }

    if (opts.pause && process.stdin.setRawMode) {
        console.error('Press any key to continue...')
        process.stdin.setRawMode(true)
        await process.stdin.read({length: 1})
    }
}
