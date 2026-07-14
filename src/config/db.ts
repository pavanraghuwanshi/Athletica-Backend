import mongoose from 'mongoose'
import { env } from './env'

let connectionReady: Promise<typeof mongoose> | undefined

const getMongoUri = () => {
  if (!env.mongoHosts.length || !env.mongoUri.startsWith('mongodb+srv://')) {
    return env.mongoUri
  }

  const uriWithoutScheme = env.mongoUri.slice('mongodb+srv://'.length)
  const pathStart = uriWithoutScheme.search(/[/?]/)
  const authority = pathStart === -1 ? uriWithoutScheme : uriWithoutScheme.slice(0, pathStart)
  const suffix = pathStart === -1 ? '/' : uriWithoutScheme.slice(pathStart)
  const credentialsEnd = authority.lastIndexOf('@')
  const credentials = credentialsEnd === -1 ? '' : authority.slice(0, credentialsEnd + 1)
  const querySeparator = suffix.includes('?') ? '&' : '?'
  const options = new URLSearchParams({
    tls: 'true',
    authSource: env.mongoAuthSource,
  })

  if (env.mongoReplicaSet) {
    options.set('replicaSet', env.mongoReplicaSet)
  }

  return `mongodb://${credentials}${env.mongoHosts.join(',')}${suffix}${querySeparator}${options}`
}

export const connectDatabase = () => {
  if (!connectionReady) {
    if (!env.mongoUri) {
      throw new Error('MONGODB_URI is required')
    }

    connectionReady = mongoose.connect(getMongoUri(), {
      dbName: env.mongoDbName,
    })
  }

  return connectionReady
}
