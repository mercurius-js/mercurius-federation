'use strict'

const buildFederationSchema = require('./lib/federation')
const mercuriusFederationPlugin = require('./lib/plugin')

module.exports = { buildFederationSchema }
module.exports.default = mercuriusFederationPlugin
