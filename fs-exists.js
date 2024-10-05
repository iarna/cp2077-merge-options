'use strict'
const fs = require('fs')
const {R_OK} = fs.constants

// Deprecating fs.exists for fs.access was mostly fine till promises were introduced.

// Without promises it was a little weird 'cause it'd requires inverting the
// logic implied by the method name:
//   fs.access(file, F_OK, (doesNotExist) => { if (doesNotExist) { ... } else { ... } })
// Better would have been:
//   fs.access(file, F_OK, (, exists) => { if (exists) { ... } else { ... } })
// But it's still tolerable.

// With promises, it's awful, as it throws when a file doesn't exist (or
// not readable or whatever options you gave it), which is insane behavior.

// It'd make sense to do something like:
//     const isAccessible = await fs.promises.access(file, F_OK)

// But you can't because that throws. fs.promises.access isn't a function
// with return value, it's an assertion that isn't named like an assertion.
// I'd have far fewer complaints if it were called fs.assertFileAccess.

// Anyway, here's the wrapper so I can ignore that nonsense:

module.exports = filename => new Promise(resolve => fs.access(filename, R_OK, err => resolve(!err)))
