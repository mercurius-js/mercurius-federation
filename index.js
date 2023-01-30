'use strict'

const buildFederationSchema = require('./lib/federation')
const mercuriusFederationPlugin = require('./lib/plugin')

module.exports = { mercuriusFederationPlugin, buildFederationSchema }
module.exports.default = mercuriusFederationPlugin
