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

### federationSchemaTransformer

Wraps an array of schema transformers (e.g. custom directive transformers built with `@graphql-tools/utils` `mapSchema`) so that the `resolveReference` functions defined on entity types are preserved after the transformation.

When mercurius applies `schemaTransforms`, `mapSchema` internally recreates every `GraphQLObjectType` via `new GraphQLObjectType(type.toConfig())`. Because `resolveReference` is a non-standard property set at runtime by mercurius, it is **lost** during this process. `federationSchemaTransformer` takes care of copying it back onto the new type instances after every transformer runs.

`(transformers: SchemaTransformer[]) => SchemaTransformer`

- `transformers` Array of functions `(schema: GraphQLSchema) => GraphQLSchema`: the directive / schema transformers to apply.

> **Note:** `mercuriusFederationPlugin` already wraps `schemaTransforms` with `federationSchemaTransformer` automatically. You only need to use this function when you build the federation schema yourself with `buildFederationSchema` and register it directly with `mercurius`.

#### Usage with `mercuriusFederationPlugin`

When using the plugin, just pass your transformers directly — the plugin handles the wrapping:

```js
const { mercuriusFederationPlugin } = require('@mercuriusjs/federation')

app.register(mercuriusFederationPlugin, {
  schema,
  resolvers,
  schemaTransforms: [upperDirectiveTransformer]
})
```

#### Usage with `buildFederationSchema` and `mercurius`

When registering mercurius directly with a federation schema, you must wrap transformers with `federationSchemaTransformer` to preserve `resolveReference`:

```js
const mercurius = require('mercurius')
const { buildFederationSchema, federationSchemaTransformer } = require('@mercuriusjs/federation')
const { MapperKind, mapSchema, getDirective } = require('@graphql-tools/utils')
const { defaultFieldResolver } = require('graphql')

// Define a directive transformer
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
    me: () => users['1']
  },
  User: {
    __resolveReference: (source) => users[source.id]
  }
}

app.register(mercurius, {
  schema: buildFederationSchema(schema),
  resolvers,
  schemaTransforms: federationSchemaTransformer([upperDirectiveTransformer])
})
```

**Without `federationSchemaTransformer`** in this scenario, `_entities` queries will fail because `resolveReference` is lost during the schema transformation:

```js
// ⚠️ _entities queries will return null for entity fields
app.register(mercurius, {
  schema: buildFederationSchema(schema),
  resolvers,
  schemaTransforms: [upperDirectiveTransformer]
})
```
