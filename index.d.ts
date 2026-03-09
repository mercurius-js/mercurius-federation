import { GraphQLSchema } from 'graphql'
import { FastifyInstance } from 'fastify'
import { MercuriusOptions } from 'mercurius'
import {
  DocumentNode
} from 'graphql/language/ast';

export interface buildFederationSchemaOptions {
  isGateway?: boolean
}

export type MercuriusFederationOptions = Omit<MercuriusOptions, 'schema'> & {
  schema: string | DocumentNode | Array<DocumentNode>
}

export declare const mercuriusFederationPlugin: (
  instance: FastifyInstance,
  opts: MercuriusFederationOptions
) => void

/**
 * Builds schema with support for federation mode.
 */
export declare const buildFederationSchema: (
  schema: string | DocumentNode | Array<DocumentNode>,
  opts?: buildFederationSchemaOptions
) => GraphQLSchema

export type SchemaTransformer = (schema: GraphQLSchema) => GraphQLSchema

/**
 * Wraps an array of schema transformers so that `resolveReference` functions
 * (set by mercurius on entity types) are preserved after the transformation.
 * Use this instead of passing transformers directly to `schemaTransforms`
 * when working with federated schemas.
 */
export declare const federationSchemaTransformer: (
  transformers: SchemaTransformer[]
) => SchemaTransformer
