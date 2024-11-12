const commonjs = require('@rollup/plugin-commonjs')
const resolve = require('@rollup/plugin-node-resolve')
const terser = require('@rollup/plugin-terser')

module.exports = {
  input: 'index.js',
  output: {
    dir: 'output',
    format: 'commonjs'
  },
  plugins: [commonjs({
    strictRequires: false,
    ignore: ['fs', 'util']
  }), resolve({preferBuiltins: true, mainField: ['main']}),terser()]
}