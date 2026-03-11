'use strict'

const Fastify = require('fastify')
const { mapSchema, getDirective, MapperKind } = require('@graphql-tools/utils')
const { mercuriusFederationPlugin } = require('../')

const users = {
  1: {
    id: '1',
    name: 'John',
    username: '@john'
  },
  2: {
    id: '2',
    name: 'Jane',
    username: '@jane'
  }
}

const uppercaseTransformer = (schema) =>
  mapSchema(schema, {
    [MapperKind.FIELD]: (fieldConfig) => {
      const upperDirective = getDirective(schema, fieldConfig, 'upper')?.[0]
      if (upperDirective) {
        fieldConfig.resolve = async (obj, _args, _ctx, info) => {
          const value = obj[info.fieldName]
          return typeof value === 'string' ? value.toUpperCase() : value
        }
      }
    }
  })

const app = Fastify()
const schema = `
  directive @upper on FIELD_DEFINITION

  extend type Query {
    me: User
  }

  type User @key(fields: "id") {
    id: ID!
    name: String @upper
    username: String
  }
`

const resolvers = {
  Query: {
    me: () => {
      return users['1']
    }
  },
  User: {
    __resolveReference: (source) => {
      return users[source.id]
    }
  }
}

app.register(mercuriusFederationPlugin, {
  schema,
  resolvers,
  schemaTransforms: [uppercaseTransformer],
  graphiql: true
})

app.get('/', async function () {
  const query = '{ _service { sdl } }'
  return app.graphql(query)
})

app.listen({ port: 3000 })
