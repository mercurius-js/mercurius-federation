'use strict'

const buildFederationSchema = require('./lib/federation')
const mercuriusFederationPlugin = require('./lib/plugin')
const federationSchemaTransformer = require('./lib/transformFederatedSchema')

module.exports = { mercuriusFederationPlugin, buildFederationSchema, federationSchemaTransformer }
module.exports.default = mercuriusFederationPlugin
