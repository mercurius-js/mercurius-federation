'use strict'

const Fastify = require('fastify')
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

const app = Fastify()
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

app.register(mercurius, {
  schema: buildFederationSchema(schema),
  resolvers,
  graphiql: true
})

app.get('/', async function () {
  const query = '{ _service { sdl } }'
  return app.graphql(query)
})

app.listen({ port: 3000 })
