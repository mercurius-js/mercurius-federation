# @mercuriusjs/federation

A module to add Apollo Federation v1 metadata info to a schema.

## Quick start

```bash
npm i fastify @mercuriusjs/federation
```

```js
const Fastify = require('fastify')
const { mercuriusFederationPlugin } = require('@mercuriusjs/federation')

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
    __resolveReference: (source, args, context, info) => {
      return users[source.id]
    }
  }
}

app.register(mercuriusFederationPlugin, {
  schema,
  resolvers
})

app.get('/', async function (req, reply) {
  const query = '{ _service { sdl } }'
  return app.graphql(query)
})

app.listen({ port: 3000 })
```

### Build a schema and pass it to `mercurius`

Instead of using the plugin, the federation schema can be built using the `buildFederationSchema` function and passing the schema generated to `mercurius`.

```javascript
const Fastify = require('fastify')
const mercurius = require('mercurius')
const { buildFederationSchema } = require('../')

...

app.register(mercurius, {
  schema: buildFederationSchema(schema),
  resolvers,
  graphiql: true
})

...
```

## API

### mercuriusFederationPlugin

A fastify plugin to create a `mercurius` server that expose the `federation` directives.

```javascript
const { mercuriusFederationPlugin } = require('@mercuriusjs/federation')

const schema = ...
const resolvers = ...
const app = Fastify()

app.register(mercuriusFederationPlugin, {
  schema,
  resolvers
})
```

#### options
Uses the same [options](https://mercurius.dev/#/docs/api/options?id=plugin-options) of `mercurius` but
it requires a `string`, `DocumentNode` or an Array of `DocumentNode` for `schema` attribute. 

### buildFederationSchema

Create a schema object that can be used in a federated environment

`(schema,  opts) => GraphQLSchema`

- `schema` string | DocumentNode | Array<DocumentNode>: the source schema
- `opts` object:
  - `isGateway` boolean: If enabled create a schema compatible with the `gateway`, Default 'false'
