'use strict'
const fs = require('fs').promises
const MO2Info = require('./mo2.js')
const {findOptionsFiles,mergeOptions} = require('./merge-options.js')
// because fs.promises.exists does not... exist and fs.process.access is awful
const exists = require('./fs-exists.js')
const {UserError,LibError} = require('./errors.js')
const JSON = require('lossless-json') 


async function main(mo2path, outputMod='Merged Options') {
    if (!mo2path) {
        const exec  = process.argv[1].replace(/^.*?([^\\/]+)$/, '$1')
        console.error(`Form: merge-options <mo2path> [outputMod]`)
        console.error(`The default outputMod name is "Merged Options"`)
        process.exit(1)
    }
    let mo2 = await MO2Info(mo2path)
    if (mo2.ini.General.gameName !== 'Cyberpunk 2077') {
        throw new UserError(`This does not appear to be a Cyberpunk MO2 install (gameName: ${JSON.stringify(mo2.ini.General.gameName)})`)
    }
    const optionsFiles = await findOptionsFiles(mo2, outputMod)
    const {merged, changeSummary} = await mergeOptions(mo2, optionsFiles)


    console.error('Merged options from:')
    for (const {file} of optionsFiles) { console.error('\t' + file) }

    const changes_path = mo2.path + '/logs/options-json-merger-changes.yaml'
    console.error('Writing change log to: ' + changes_path)
    if (changeSummary.trim().length === 0) {
        console.error('No changes to defaults detected!')
    }
    await fs.writeFile(changes_path, changeSummary)
    
    const mod_directory = (mo2.ini.Settings.mod_directory || '%BASE_DIR%/mods').replace(/%BASE_DIR%/g, mo2.path)
    const output_folder = `${mod_directory}/${outputMod}/r6/config/settings/platform/pc`
    const output_file = `${output_folder}/options.json`
    console.error('Writing merged options to: ' + output_file)
    if (!await exists(output_folder)) {
        await fs.mkdir(output_folder, {recursive: true})
    }
    await fs.writeFile(output_file, JSON.stringify(JSON.parse(JSON.stringify(merged)), null, 4))//.replace(/\r?\n/g,'\r\n'))


    console.error('Press any key to continue...')
    process.stdin.setRawMode(true)
    await process.stdin.read({length: 1})
    process.stdin.resume()
    process.stdin.on('data', () => process.exit(0))
}


main(...process.argv.slice(2)).catch(ex => {
   console.error(ex.message)
   if (!(ex instanceof UserError)) {
       if (ex.cause) console.error(ex.cause.stack)
       console.error(ex.stack)
   }
   process.exit(1)
})
