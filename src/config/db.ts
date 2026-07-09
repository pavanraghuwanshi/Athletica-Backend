import mongoose from 'mongoose'
import { env } from './env'

let connectionReady: Promise<typeof mongoose> | undefined

export const connectDatabase = () => {
  if (!connectionReady) {
    if (!env.mongoUri) {
      throw new Error('MONGODB_URI is required')
    }

    connectionReady = mongoose.connect(env.mongoUri, {
      dbName: env.mongoDbName,
    })
  }

  return connectionReady
}
