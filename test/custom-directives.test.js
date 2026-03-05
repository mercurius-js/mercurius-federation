'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const { defaultFieldResolver } = require('graphql')
const GQL = require('mercurius')
const {
  MapperKind,
  mapSchema,
  getDirective
} = require('@graphql-tools/utils')
const buildFederationSchema = require('../lib/federation')
const federationTrasformer = require('../lib/transformFederatedSchema')

// --- Directive transformers ---

function upperDirectiveTransformer (schema) {
  return mapSchema(schema, {
    [MapperKind.FIELD]: (fieldConfig) => {
      const upperDirective = getDirective(schema, fieldConfig, 'upper')?.[0]
      if (upperDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig
        fieldConfig.resolve = async function (obj, args, ctx, info) {
          const result = await resolve(obj, args, ctx, info)
          return typeof result === 'string' ? result.toUpperCase() : result
        }
        return fieldConfig
      }
    }
  })
}

const PHONE_REGEXP = /(?:\+?\d{2}[ -]?\d{3}[ -]?\d{5}|\d{4})/g
const EMAIL_REGEXP = /([^\s@])+@[^\s@]+\.[^\s@]+/g

function redactDirectiveTransformer (schema) {
  return mapSchema(schema, {
    [MapperKind.FIELD]: (fieldConfig) => {
      const redactDirective = getDirective(schema, fieldConfig, 'redact')?.[0]
      if (redactDirective) {
        const { find } = redactDirective
        const { resolve = defaultFieldResolver } = fieldConfig
        fieldConfig.resolve = async function (obj, args, ctx, info) {
          const value = await resolve(obj, args, ctx, info)
          if (typeof value !== 'string') return value
          switch (find) {
            case 'email':
              return value.replace(EMAIL_REGEXP, '****@*****. ***')
            case 'phone':
              return value.replace(PHONE_REGEXP, m => '*'.repeat(m.length))
            default:
              return value
          }
        }
        return fieldConfig
      }
    }
  })
}

// --- Non-federation tests ---

test('custom directive @redact works without federation', async (t) => {
  const app = Fastify()
  const schema = `
    directive @redact(find: String) on FIELD_DEFINITION

    type Document {
      excerpt: String! @redact(find: "email")
      text: String! @redact(find: "phone")
    }

    type Query {
      documents: [Document]
    }
  `

  const resolvers = {
    Query: {
      documents: () => [
        {
          excerpt: 'Contact us at info@example.com for details',
          text: 'Call us at +39 333 12345'
        }
      ]
    }
  }

  app.register(GQL, {
    schema,
    resolvers,
    schemaTransforms: [redactDirectiveTransformer]
  })

  await app.ready()

  const query = '{ documents { excerpt text } }'
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  const body = JSON.parse(res.body)

  t.assert.strictEqual(body.data.documents[0].excerpt.includes('info@example.com'), false)
  t.assert.strictEqual(body.data.documents[0].excerpt.includes('****@*****.'), true)
  t.assert.strictEqual(body.data.documents[0].text.includes('+39 333 12345'), false)
})

test('custom directive @upper works without federation', async (t) => {
  const app = Fastify()
  const schema = `
    directive @upper on FIELD_DEFINITION

    type Query {
      hello: String @upper
    }
  `

  const resolvers = {
    Query: {
      hello: () => 'world'
    }
  }

  app.register(GQL, {
    schema,
    resolvers,
    schemaTransforms: [upperDirectiveTransformer]
  })

  await app.ready()

  const query = '{ hello }'
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  t.assert.deepStrictEqual(JSON.parse(res.body), { data: { hello: 'WORLD' } })
})

// --- Federation tests ---

test('custom directive @upper works with federation schema and @key entity', async (t) => {
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

  const users = {
    1: { id: '1', name: 'John', username: '@john' },
    2: { id: '2', name: 'Jane', username: '@jane' }
  }

  const resolvers = {
    Query: {
      me: () => users['1']
    },
    User: {
      __resolveReference: (source) => users[source.id]
    }
  }

  app.register(GQL, {
    schema: buildFederationSchema(schema),
    resolvers,
    schemaTransforms: [upperDirectiveTransformer]
  })

  await app.ready()

  // Verify directive applies to the field
  const query = '{ me { id name username } }'
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  const body = JSON.parse(res.body)

  t.assert.strictEqual(body.data.me.name, 'JOHN')
  t.assert.strictEqual(body.data.me.username, '@john')
})

test('custom directive @upper preserves _service sdl in federation', async (t) => {
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
      me: () => ({ id: '1', name: 'John', username: '@john' })
    },
    User: {
      __resolveReference: (source) => ({ id: source.id, name: 'John', username: '@john' })
    }
  }

  app.register(GQL, {
    schema: buildFederationSchema(schema),
    resolvers,
    schemaTransforms: [upperDirectiveTransformer]
  })

  await app.ready()

  const query = '{ _service { sdl } }'
  const res = await app.inject({ method: 'GET', url: `/graphql?query=${query}` })
  t.assert.deepStrictEqual(JSON.parse(res.body), { data: { _service: { sdl: schema } } })
})

test('custom directive @redact works with federation schema', async (t) => {
  const app = Fastify()
  const schema = `
    directive @redact(find: String) on FIELD_DEFINITION

    extend type Query {
      contact: Contact
    }

    type Contact @key(fields: "id") {
      id: ID!
      email: String @redact(find: "email")
      phone: String @redact(find: "phone")
    }
  `

  const resolvers = {
    Query: {
      contact: () => ({
        id: '1',
        email: 'john@example.com',
        phone: '+39 333 12345'
      })
    },
    Contact: {
      __resolveReference: (source) => ({
        id: source.id,
        email: 'john@example.com',
        phone: '+39 333 12345'
      })
    }
  }

  app.register(GQL, {
    schema: buildFederationSchema(schema),
    resolvers,
    schemaTransforms: [redactDirectiveTransformer]
  })

  await app.ready()

  const query = '{ contact { id email phone } }'
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  const body = JSON.parse(res.body)

  t.assert.strictEqual(body.data.contact.id, '1')
  t.assert.strictEqual(body.data.contact.email.includes('john@example.com'), false)
  t.assert.strictEqual(body.data.contact.phone.includes('+39 333 12345'), false)
})

test('multiple custom directives work together with federation', async (t) => {
  const app = Fastify()
  const schema = `
    directive @upper on FIELD_DEFINITION
    directive @redact(find: String) on FIELD_DEFINITION

    extend type Query {
      user: User
    }

    type User @key(fields: "id") {
      id: ID!
      name: String @upper
      email: String @redact(find: "email")
    }
  `

  const resolvers = {
    Query: {
      user: () => ({ id: '1', name: 'John', email: 'john@example.com' })
    },
    User: {
      __resolveReference: (source) => ({
        id: source.id,
        name: 'John',
        email: 'john@example.com'
      })
    }
  }

  app.register(GQL, {
    schema: buildFederationSchema(schema),
    resolvers,
    schemaTransforms: [upperDirectiveTransformer, redactDirectiveTransformer]
  })

  await app.ready()

  const query = '{ user { id name email } }'
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  const body = JSON.parse(res.body)

  t.assert.strictEqual(body.data.user.name, 'JOHN')
  t.assert.strictEqual(body.data.user.email.includes('john@example.com'), false)
})

test('federation _entities query not works with custom directive on entity fields when not use federationTrasformer', async (t) => {
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

  const users = {
    1: { id: '1', name: 'John', username: '@john' },
    2: { id: '2', name: 'Jane', username: '@jane' }
  }

  const resolvers = {
    Query: {
      me: () => users['1']
    },
    User: {
      __resolveReference: (source) => users[source.id]
    }
  }

  app.register(GQL, {
    schema: buildFederationSchema(schema),
    resolvers,
    schemaTransforms: [upperDirectiveTransformer]
  })

  await app.ready()

  const query = `{
    _entities(representations: [{ __typename: "User", id: "2" }]) {
      ... on User {
        id
        name
        username
      }
    }
  }`
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  const body = JSON.parse(res.body)

  t.assert.strictEqual(body.data._entities[0].name, null)
  t.assert.strictEqual(body.data._entities[0].username, null)
})

test('federation _entities query works with custom directive on entity fields', async (t) => {
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

  const users = {
    1: { id: '1', name: 'John', username: '@john' },
    2: { id: '2', name: 'Jane', username: '@jane' }
  }

  const resolvers = {
    Query: {
      me: () => users['1']
    },
    User: {
      __resolveReference: (source) => users[source.id]
    }
  }

  app.register(GQL, {
    schema: buildFederationSchema(schema),
    resolvers,
    schemaTransforms: federationTrasformer([upperDirectiveTransformer])
  })

  await app.ready()

  const query = `{
    _entities(representations: [{ __typename: "User", id: "2" }]) {
      ... on User {
        id
        name
        username
      }
    }
  }`
  const res = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  const body = JSON.parse(res.body)

  t.assert.strictEqual(body.data._entities[0].name, 'JANE')
  t.assert.strictEqual(body.data._entities[0].username, '@jane')
})
