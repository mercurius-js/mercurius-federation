'use strict'

const createError = require('@fastify/error')

const errors = {
  MER_ERR_GQL_INVALID_SCHEMA: createError(
    'MER_ERR_GQL_INVALID_SCHEMA',
    'Invalid schema: check out the .errors property on the Error'
  ),
  /**
   * Gateway errors
   */
  MER_ERR_GQL_FEDERATION_INVALID_SCHEMA: createError(
    'MER_ERR_GQL_FEDERATION_INVALID_SCHEMA',
    'The _entities resolver tried to load an entity for type "%s", but no object type of that name was found in the schema'
  ),
  MER_ERR_GQL_FEDERATION_DUPLICATE_DIRECTIVE: createError(
    'MER_ERR_GQL_FEDERATION_DUPLICATE_DIRECTIVE',
    'Directive with a different definition but the same name "%s" already exists in the gateway schema'
  )
}

module.exports = errors
