'use strict'

const Fastify = require('fastify')
const { mapSchema, getDirective, MapperKind, printSchemaWithDirectives, getResolversFromSchema } = require('@graphql-tools/utils')
const { mergeResolvers } = require('@graphql-tools/merge')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const mercurius = require('mercurius')
const { buildFederationSchema } = require('../')

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

const upperCaseDirectiveTypeDefs = 'directive @upper on FIELD_DEFINITION'
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
  ${upperCaseDirectiveTypeDefs}

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
    __resolveReference: source => {
      return users[source.id]
    }
  }
}

const federationSchema = buildFederationSchema(schema)

const executableSchema = makeExecutableSchema({
  typeDefs: printSchemaWithDirectives(federationSchema),
  resolvers: mergeResolvers([getResolversFromSchema(federationSchema), resolvers])
})

app.register(mercurius, {
  schema: executableSchema,
  schemaTransforms: [uppercaseTransformer],
  graphiql: true
})

app.get('/', async function () {
  const query = '{ _service { sdl } }'
  return app.graphql(query)
})

app.listen({ port: 3000 })
