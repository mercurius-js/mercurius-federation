'use strict'

const fp = require('fastify-plugin')
const GQL = require('mercurius')

const buildFederationSchema = require('./federation')

module.exports = fp(async (fastify, props) => {
  await fastify.register(GQL, {
    ...props,
    schema: buildFederationSchema(props.schema)
  })
})
