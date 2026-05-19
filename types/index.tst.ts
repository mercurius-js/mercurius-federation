import Fastify from 'fastify'
import gql from 'graphql-tag'
import { GraphQLSchema } from 'graphql/index.js'
import { expect } from 'tstyche'

import { buildFederationSchema, mercuriusFederationPlugin } from '..'

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

const schema2 = `
    extend type Query {
      you: User
    }
  `

expect(buildFederationSchema(schema)).type.toBe<GraphQLSchema>()
expect(buildFederationSchema(gql(schema))).type.toBe<GraphQLSchema>()
expect(buildFederationSchema([gql(schema), gql(schema2)])).type.toBe<GraphQLSchema>()
expect(buildFederationSchema(schema, {})).type.toBe<GraphQLSchema>()
expect(buildFederationSchema(schema, { isGateway: true })).type.toBe<GraphQLSchema>()

expect(buildFederationSchema).type.not.toBeCallableWith(schema, { isGateway: 'hello' })

const app = Fastify()

app.register(mercuriusFederationPlugin, {
  schema,
  graphiql: true
})

expect(app.register).type.not.toBeCallableWith(mercuriusFederationPlugin, {
  schema: buildFederationSchema(schema),
  graphiql: true
})
