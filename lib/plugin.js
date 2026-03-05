'use strict'

const fp = require('fastify-plugin')
const GQL = require('mercurius')

const buildFederationSchema = require('./federation')
const federationTrasformer = require('./transformFederatedSchema')

module.exports = fp(async (fastify, props) => {
  await fastify.register(GQL, {
    ...props,
    schema: buildFederationSchema(props.schema),
    schemaTransforms: props.schemaTransforms ? federationTrasformer(props.schemaTransforms) : undefined
  })
})
