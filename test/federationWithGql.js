'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const { printSchema } = require('graphql')
const WebSocket = require('ws')
const mq = require('mqemitter')
const mercurius = require('mercurius')
const gql = require('graphql-tag')
const buildFederationSchema = require('../lib/federation')

test('federation support using schema from buildFederationSchema', async t => {
  const app = Fastify()
  const schema = `
    extend type Query {
      me: User
    }

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

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  let query = '{ _service { sdl } }'
  let res = await app.inject({ method: 'GET', url: `/graphql?query=${query}` })

  t.same(JSON.parse(res.body), { data: { _service: { sdl: schema } } })

  query = '{ me { id name username } }'
  res = await app.inject({ method: 'GET', url: `/graphql?query=${query}` })
  t.same(JSON.parse(res.body), {
    data: { me: { id: '1', name: 'John', username: '@john' } }
  })

  query = 'mutation { add(a: 11 b: 19) }'
  res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  t.same(JSON.parse(res.body), { data: { add: 30 } })
})

test('a normal schema can be run in federated mode', async t => {
  const app = Fastify()
  const schema = `
    extend type Query {
      me: User
    }

    type User {
      id: ID!
      name: String
      username: String
    }
  `

  const resolvers = {
    Query: {
      me: () => {
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = '{ _service { sdl } }'
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _service: {
        sdl: schema
      }
    }
  })
})

test('a schema can be run in federated mode when Query is not defined', async t => {
  const app = Fastify()
  const schema = `
    type User @key(fields: "id") {
      id: ID!
      name: String
      username: String
    }
  `

  const resolvers = {
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

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = '{ _service { sdl } }'
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _service: {
        sdl: schema
      }
    }
  })
})

test('entities resolver returns correct value', async t => {
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
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
    },
    User: {
      __resolveReference: reference => {
        return {
          id: reference.id,
          name: 'John',
          username: '@john'
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "User", id: "1"}]) {
      __typename
      ... on User {
        id
        username
        name
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [
        {
          __typename: 'User',
          id: '1',
          username: '@john',
          name: 'John'
        }
      ]
    }
  })
})

test('entities resolver returns correct value with async resolver', async t => {
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
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
    },
    User: {
      __resolveReference: reference => {
        return Promise.resolve({
          id: reference.id,
          name: 'John',
          username: '@john'
        })
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "User", id: "1"}]) {
      __typename
      ... on User {
        id
        username
        name
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [
        {
          __typename: 'User',
          id: '1',
          username: '@john',
          name: 'John'
        }
      ]
    }
  })
})

test('entities resolver returns user default resolver if resolveReference is not set', async t => {
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
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "User", id: "1"}]) {
      __typename
      ... on User {
        id
        username
        name
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [
        {
          __typename: 'User',
          id: '1',
          username: null,
          name: null
        }
      ]
    }
  })
})

test('entities resolver throws an error if reference type name not in schema', async t => {
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
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Account", id: "1"}]) {
      __typename
      ... on User {
        id
        username
        name
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.equal(
    JSON.parse(res.body).errors[0].message,
    'The _entities resolver tried to load an entity for type "Account", but no object type of that name was found in the schema'
  )
})

test('buildFederationSchema function adds stub types', async t => {
  const schema = `
    extend type Query {
      me: User
    }

    type User @key(fields: "id") {
      id: ID!
      name: String
      username: String
    }

    extend type Product @key(fields: "sku") {
      sku: String
    }

    directive @customdir on FIELD_DEFINITION
  `

  const federationSchema = buildFederationSchema(gql(schema))

  t.matchSnapshot(printSchema(federationSchema))
})

test('buildFederationSchema works correctly with multiple type extensions', async t => {
  const schema = `
    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String
      content: String
      author: User
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }

    extend type User @key(fields: "id") {
      other: String
    }
  `
  try {
    buildFederationSchema(gql(schema))
    t.pass('schema built without errors')
  } catch (err) {
    t.fail('it should not throw errors', err)
  }
})

test('buildFederationSchema ignores UniqueDirectivesPerLocationRule when validating', async t => {
  const schema = `
    directive @upper on FIELD_DEFINITION

    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String @upper
      content: String
      author: User
    }

    directive @upper on FIELD_DEFINITION

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }

    extend type User @key(fields: "id") {
      other: String @upper
    }
  `
  try {
    buildFederationSchema(gql(schema))
    t.pass('schema built without errors')
  } catch (err) {
    t.fail('it should not throw errors', err)
  }
})

test('buildFederationSchema still validate schema for errors (1 error)', async t => {
  const schema = `
    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String
      content: String
      author: User
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }

    extend type User @key(fields: "id") {
      id: ID! @external
    }
  `
  try {
    buildFederationSchema(gql(schema))
    t.fail('it should throw validation error')
  } catch (err) {
    // expected error: Field "User.id" can only be defined once.
    t.pass('it should throw error')
  }
})

test('buildFederationSchema still validate schema for errors (multiple error)', async t => {
  const schema = `
    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String
      content: String
      author: User
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      activity: [Actions]
    }
  `
  try {
    buildFederationSchema(gql(schema))
    t.fail('it should throw validation error')
  } catch (err) {
    // expected errors:
    // Field "User.id" can only be defined once.
    // Unknown type "Actions"
    t.ok(err.errors)
    t.equal(err.errors.length, 2)
    t.pass('it should throw error')
  }
})

test('mutation works with federation support', async t => {
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

    extend type Mutation {
      add(a: Int, b: Int): Int
    }
  `

  const resolvers = {
    Query: {
      me: () => {
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
    },
    Mutation: {
      add: (root, { a, b }) => {
        return a + b
      }
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

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = 'mutation { add(a: 11 b: 19) }'
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query
    }
  })

  t.same(JSON.parse(res.body), {
    data: {
      add: 30
    }
  })
})

test('subscription server sends update to subscriptions', t => {
  const app = Fastify()
  t.teardown(() => app.close())

  const sendTestQuery = () => {
    app.inject(
      {
        method: 'POST',
        url: '/graphql',
        body: {
          query: `
          query {
            notifications {
              id
              message
            }
          }
        `
        }
      },
      () => {
        sendTestMutation()
      }
    )
  }

  const sendTestMutation = () => {
    app.inject(
      {
        method: 'POST',
        url: '/graphql',
        body: {
          query: `
          mutation {
            addNotification(message: "Hello World") {
              id
            }
          }
        `
        }
      },
      () => {}
    )
  }

  const emitter = mq()
  const schema = `
    type Notification @key(fields: "id") {
      id: ID!
      message: String
    }

    extend type Query {
      notifications: [Notification]
    }

    extend type Mutation {
      addNotification(message: String): Notification
    }

    extend type Subscription {
      notificationAdded: Notification
    }
  `

  let idCount = 1
  const notifications = [
    {
      id: idCount,
      message: 'Notification message'
    }
  ]

  const resolvers = {
    Query: {
      notifications: () => notifications
    },
    Mutation: {
      addNotification: async (_, { message }) => {
        const id = idCount++
        const notification = {
          id,
          message
        }
        notifications.push(notification)
        await emitter.emit({
          topic: 'NOTIFICATION_ADDED',
          payload: {
            notificationAdded: notification
          }
        })

        return notification
      }
    },
    Subscription: {
      notificationAdded: {
        subscribe: (root, args, { pubsub }) =>
          pubsub.subscribe('NOTIFICATION_ADDED')
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers,
    subscription: {
      emitter
    }
  })

  app.listen({ port: 0 }, err => {
    t.error(err)

    const ws = new WebSocket(
      'ws://localhost:' + app.server.address().port + '/graphql',
      'graphql-ws'
    )
    const client = WebSocket.createWebSocketStream(ws, {
      encoding: 'utf8',
      objectMode: true
    })
    t.teardown(client.destroy.bind(client))
    client.setEncoding('utf8')

    client.write(
      JSON.stringify({
        type: 'connection_init'
      })
    )

    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query: `
          subscription {
            notificationAdded {
              id
              message
            }
          }
        `
        }
      })
    )

    client.write(
      JSON.stringify({
        id: 2,
        type: 'start',
        payload: {
          query: `
          subscription {
            notificationAdded {
              id
              message
            }
          }
        `
        }
      })
    )

    client.write(
      JSON.stringify({
        id: 2,
        type: 'stop'
      })
    )

    client.on('data', chunk => {
      const data = JSON.parse(chunk)

      if (data.id === 1 && data.type === 'data') {
        t.equal(
          chunk,
          JSON.stringify({
            type: 'data',
            id: 1,
            payload: {
              data: {
                notificationAdded: {
                  id: '1',
                  message: 'Hello World'
                }
              }
            }
          })
        )

        client.end()
        t.end()
      } else if (data.id === 2 && data.type === 'complete') {
        sendTestQuery()
      }
    })
  })
})

test('federation supports loader for __resolveReference function', async t => {
  const app = Fastify()
  const users = {
    1: {
      id: 1,
      name: 'John',
      username: '@john'
    },
    2: {
      id: 2,
      name: 'Jane',
      username: '@jane'
    }
  }
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
    }
  }

  const loaders = {
    User: {
      async __resolveReference (queries) {
        t.same(queries, [
          {
            obj: {
              __typename: 'User',
              id: '1'
            },
            params: {}
          },
          {
            obj: {
              __typename: 'User',
              id: '2'
            },
            params: {}
          }
        ])
        return queries.map(({ obj }) => users[obj.id])
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers,
    loaders
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "User", id: "1" }, { __typename: "User", id: "2" }, { __typename: "User", id: "1" }]) {
      ... on User {
        id
        username
        name
      }
    }
  }
  `
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query
    }
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [
        {
          id: '1',
          username: '@john',
          name: 'John'
        },
        {
          id: '2',
          username: '@jane',
          name: 'Jane'
        },
        {
          id: '1',
          username: '@john',
          name: 'John'
        }
      ]
    }
  })
})

test('federation schema is built correctly with type extension', async t => {
  const app = Fastify()
  const schema = `
    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String
      content: String
      author: User
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }
  `

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema
  })

  await app.ready()

  const query = '{ topPosts { id author { id posts { id } } } }'
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      topPosts: null
    }
  })
})

test("basic federation support with 'schema' in the schema", async t => {
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

    schema {
      query: Query
    }
  `

  const resolvers = {
    Query: {
      me: () => {
        return {
          id: '1',
          name: 'John',
          username: '@john'
        }
      }
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

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = '{ _service { sdl } }'
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _service: {
        sdl: schema
      }
    }
  })
})

test('buildFederationSchema remove some directive in isGateway mode', async t => {
  const schema = `
    directive @custom(input: ID) on OBJECT | FIELD_DEFINITION
    
    directive @custom(input: ID) on OBJECT | FIELD_DEFINITION
  
    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String
      content: String
      author: User
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }

    extend type User @key(fields: "id") {
      other: String
    }
  `
  try {
    const resultGateway = buildFederationSchema(gql(schema), { isGateway: true })

    const printedSchema = printSchema(resultGateway)

    t.notOk(printedSchema.includes('directive @external on FIELD_DEFINITION'))
    t.notOk(
      printedSchema.includes(
        'directive @provides(fields: _FieldSet!) on FIELD_DEFINITION'
      )
    )
    t.notOk(
      printedSchema.includes(
        'directive @key(fields: _FieldSet!) on OBJECT | INTERFACE'
      )
    )
    t.notOk(printedSchema.includes('directive @extends on OBJECT | INTERFACE'))
    t.notOk(printedSchema.includes('type _Service'))
    t.notOk(
      printedSchema.includes('_entities(representations: [_Any!]!): [_Entity]!')
    )
    t.notOk(printedSchema.includes('union _Entity = User | Post'))
    t.ok(
      printedSchema.includes(
        'directive @requires(fields: _FieldSet!) on FIELD_DEFINITION'
      )
    )
  } catch (err) {
    t.fail('it should not throw errors', err)
  }
})

test('buildFederationSchema thrown an error on duplicated directive that with different signature in isGateway mode', async t => {
  const schema = `
    directive @custom(input: ID) on OBJECT | FIELD_DEFINITION
    
    directive @custom(input: String) on OBJECT | FIELD_DEFINITION
  
    extend type Query {
      topPosts: [Post]
    }

    type Post @key(fields: "id") {
      id: ID!
      title: String
      content: String
      author: User
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      posts: [Post]
    }

    extend type User @key(fields: "id") {
      other: String
    }
  `
  try {
    buildFederationSchema(gql(schema), { isGateway: true })
    t.fail('schema built without errors')
  } catch (err) {
    t.same(
      err.message,
      'Directive with a different definition but the same name "custom" already exists in the gateway schema'
    )
  }
})

test('buildFederationSchema with extension directive', async t => {
  const schema = `
    type Post @key(fields: "id") @extends {
      id: ID!
      title: String
      content: String
    }
  `
  try {
    const resultGateway = buildFederationSchema(gql(schema))
    const printedSchema = printSchema(resultGateway)
    t.ok(printedSchema.includes('directive @extends on OBJECT | INTERFACE'))
  } catch (err) {
    t.fail('schema built with errors')
  }
})

test('entities resolver returns correct value for interface', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      product: Product
    }
    interface Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type BundleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
      productIds: [ID!]!
    }
  `

  const resolvers = {
    Query: {
      product: () => {
        return {
          id: '1',
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    },
    Product: {
      resolveType: () => {
        return 'BundleProduct'
      }
    },
    BundleProduct: {
      __resolveReference: (reference) => {
        return {
          id: reference.id,
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Product", id: "1"}]) {
      __typename
      ... on Product {
        id
        name
      }
      ... on BundleProduct {
        productIds
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [{
        __typename: 'BundleProduct',
        id: '1',
        name: 'bundle',
        productIds: ['001', '002']
      }]
    }
  })
})

test('entities resolver returns correct value for interface with async resolveType', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      product: Product
    }
    interface Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type BundleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
      productIds: [ID!]!
    }
  `

  const resolvers = {
    Query: {
      product: () => {
        return {
          id: '1',
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    },
    Product: {
      resolveType: () => {
        return Promise.resolve('BundleProduct')
      }
    },
    BundleProduct: {
      __resolveReference: (reference) => {
        return {
          id: reference.id,
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Product", id: "1"}]) {
      __typename
      ... on Product {
        id
        name
      }
      ... on BundleProduct {
        productIds
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [{
        __typename: 'BundleProduct',
        id: '1',
        name: 'bundle',
        productIds: ['001', '002']
      }]
    }
  })
})

test('entities resolver returns correct value for interface with async resolveType and resolveReference', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      product: Product
    }
    interface Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type BundleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
      productIds: [ID!]!
    }
  `

  const resolvers = {
    Query: {
      product: () => {
        return {
          id: '1',
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    },
    Product: {
      resolveType: () => {
        return Promise.resolve('BundleProduct')
      }
    },
    BundleProduct: {
      __resolveReference: (reference) => {
        return Promise.resolve({
          id: reference.id,
          name: 'bundle',
          productIds: ['001', '002']
        })
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Product", id: "1"}]) {
      __typename
      ... on Product {
        id
        name
      }
      ... on BundleProduct {
        productIds
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [{
        __typename: 'BundleProduct',
        id: '1',
        name: 'bundle',
        productIds: ['001', '002']
      }]
    }
  })
})

test('entities resolver returns correct value for interface with async without definition of resolveReference', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      product: Product
    }
    interface Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type BundleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
      productIds: [ID!]!
    }
  `

  const resolvers = {
    Query: {
      product: () => {
        return {
          id: '1',
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    },
    Product: {
      resolveType: () => {
        return Promise.resolve('BundleProduct')
      }
    },
    BundleProduct: {}
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Product", id: "1"}]) {
      __typename
      ... on Product {
        id
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [{
        __typename: 'BundleProduct',
        id: '1'
      }]
    }
  })
})

test('entities resolver returns correct value for interface using isTypeOf method', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      product: Product
    }
    interface Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type SingleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type BundleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
      productIds: [ID!]!
    }
  `

  const resolvers = {
    Query: {
      product: () => {
        return {
          __typename: 'BundleProduct',
          id: '1',
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    },
    SingleProduct: {
      isTypeOf: () => {
        return false
      },
      __resolveReference: (reference) => {
        return {
          id: reference.id,
          name: 'single'
        }
      }
    },
    BundleProduct: {
      isTypeOf: () => {
        return true
      },
      __resolveReference: (reference) => {
        return {
          id: reference.id,
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Product", id: "1"}]) {
      __typename
      ... on Product {
        id
        name
      }
      ... on BundleProduct {
        productIds
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [{
        __typename: 'BundleProduct',
        id: '1',
        name: 'bundle',
        productIds: ['001', '002']
      }]
    }
  })
})

test('entities resolver returns correct value for interface using isTypeOf as promise', async (t) => {
  const app = Fastify()
  const schema = `
    extend type Query {
      product: Product
    }
    interface Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type SingleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
    }
    type BundleProduct implements Product @key(fields: "id") {
      id: ID!
      name: String!
      productIds: [ID!]!
    }
  `

  const resolvers = {
    Query: {
      product: () => {
        return {
          __typename: 'BundleProduct',
          id: '1',
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    },
    SingleProduct: {
      isTypeOf: () => {
        return Promise.resolve(false)
      },
      __resolveReference: (reference) => {
        return {
          id: reference.id,
          name: 'single'
        }
      }
    },
    BundleProduct: {
      isTypeOf: () => {
        return Promise.resolve(true)
      },
      __resolveReference: (reference) => {
        return {
          id: reference.id,
          name: 'bundle',
          productIds: ['001', '002']
        }
      }
    }
  }

  const federationSchema = buildFederationSchema(gql(schema))

  app.register(mercurius, {
    schema: federationSchema,
    resolvers
  })

  await app.ready()

  const query = `
  {
    _entities(representations: [{ __typename: "Product", id: "1"}]) {
      __typename
      ... on Product {
        id
        name
      }
      ... on BundleProduct {
        productIds
      }
    }
  }
  `
  const res = await app.inject({
    method: 'GET',
    url: `/graphql?query=${query}`
  })

  t.same(JSON.parse(res.body), {
    data: {
      _entities: [{
        __typename: 'BundleProduct',
        id: '1',
        name: 'bundle',
        productIds: ['001', '002']
      }]
    }
  })
})
