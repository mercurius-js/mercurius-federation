'use strict'

const { isObjectType } = require('graphql/type')

const federationTrasformer = (
  transformers
) => {
  return (schema) => {
    const originalTypeMap = schema.getTypeMap()

    let newSchema = schema
    for (const transformer of transformers) {
      newSchema = transformer(newSchema)
    }
    // resolveReference is a non-standard property set by defineLoaders
    // on each GraphQLObjectType. Transformers such as mapSchema/rewireTypes
    // recreate types via new GraphQLObjectType({...type.toConfig()}) which
    // does not include non-standard properties. resolveReference must be
    // copied over to the new instances.
    for (const [typeName, newType] of Object.entries(
      newSchema.getTypeMap()
    )) {
      const originalType = originalTypeMap[typeName]
      if (
        isObjectType(originalType) && originalType.resolveReference
      ) {
        newType.resolveReference = originalType.resolveReference
      }
    }
    return newSchema
  }
}

module.exports = federationTrasformer
