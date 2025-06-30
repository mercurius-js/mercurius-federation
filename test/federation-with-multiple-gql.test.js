'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const mercurius = require('mercurius')
const gql = require('graphql-tag')
const buildFederationSchema = require('../lib/federation')

test('federation support using schema from buildFederationSchema', async t => {
  const app = Fastify()
  const schema1 = `
    extend type Query {
      me: User
    }
  `

  const schema2 = `
    extend type Mutation {
      add(a: Int, b: Int): Int
    }

    type User @key(fields: "id") {
      id: ID!
      name: String
      username: String
    }
  `

  const resolvers = {
    Query: {
      me: () => ({
        id: '1',
        name: 'John',
        username: '@john'
      })
    },
    Mutation: {
      add: (_, { a, b }) => a + b
    },
    User: {
      __resolveReference: object => {
        return {
          id: object.id,
          name: 'John',
          username: '@john'
        }
      }
    }
  }

  const schema = [gql(schema1), gql(schema2)]

  const federationSchema = buildFederationSchema(schema)

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  let query = '{ _service { sdl } }'
  let res = await app.inject({ method: 'GET', url: `/graphql?query=${query}` })

  t.assert.deepStrictEqual(JSON.parse(res.body), { data: { _service: { sdl: `${schema1}${schema2}` } } })

  query = '{ me { id name username } }'
  res = await app.inject({ method: 'GET', url: `/graphql?query=${query}` })
  t.assert.deepStrictEqual(JSON.parse(res.body), {
    data: { me: { id: '1', name: 'John', username: '@john' } }
  })

  query = 'mutation { add(a: 11 b: 19) }'
  res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  t.assert.deepStrictEqual(JSON.parse(res.body), { data: { add: 30 } })
})
