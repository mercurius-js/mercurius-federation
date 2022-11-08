import { GraphQLSchema } from 'graphql'
import { FastifyInstance } from 'fastify'
import { MercuriusOptions } from 'mercurius'

export interface buildFederationSchemaOptions {
  isGateway?: boolean
}

export type MercuriusFederationOptions = Omit<MercuriusOptions, 'schema'> & {
  schema: string
}

export declare const mercuriusFederationPlugin: (
  instance: FastifyInstance,
  opts: MercuriusFederationOptions
) => void

/**
 * Builds schema with support for federation mode.
 */
export declare const buildFederationSchema: (
  schema: string,
  opts?: buildFederationSchemaOptions
) => GraphQLSchema
