import { expectType, expectError } from 'tsd'
import Fastify from 'fastify'
import { GraphQLSchema } from 'graphql/index'

import { buildFederationSchema, mercuriusFederationPlugin } from '../../index'

const schema = `
    extend type Query {
      me: User
    }

    type User @key(fields: "id") {
      id: ID!
      name: String
      username: String
    }
  `

expectType<GraphQLSchema>(buildFederationSchema(schema))
expectType<GraphQLSchema>(buildFederationSchema(schema, {}))
expectType<GraphQLSchema>(buildFederationSchema(schema, { isGateway: true }))

expectError(buildFederationSchema(schema, { isGateway: 'hello' }))

const app = Fastify()

app.register(mercuriusFederationPlugin, {
  schema,
  graphiql: true
})

expectError(() => {
  app.register(mercuriusFederationPlugin, {
    schema: buildFederationSchema(schema),
    graphiql: true
  })
})
