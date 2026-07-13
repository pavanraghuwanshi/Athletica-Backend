import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import type { User } from './auth.types'

type UserDocument = User & mongoose.Document

let userModel: Model<UserDocument> | undefined

const getUserModel = async () => {
  await connectDatabase()

  if (!userModel) {
    const userSchema = new Schema<UserDocument>(
      {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String },
        googleId: { type: String, sparse: true },
        appleId: { type: String, sparse: true },
        providers: { type: [String], required: true },
        role: { type: String, enum: ['user', 'superAdmin'], required: true, default: 'user' },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
      },
      {
        collection: 'users',
        versionKey: false,
      },
    )

    userSchema.index({ googleId: 1 }, { sparse: true })
    userSchema.index({ appleId: 1 }, { sparse: true })
    userModel = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema)
  }

  return userModel
}

const toUser = (document: UserDocument | null) => {
  const user = document?.toObject<User>({
    flattenMaps: true,
    transform: (_document, user) => {
      delete (user as { _id?: unknown })._id

      return user
    },
  })

  if (user && user.role !== 'superAdmin') {
    user.role = 'user'
  }

  return user
}

export const userStore = {
  findByEmail: async (email: string) => {
    const UserModel = await getUserModel()

    return toUser(await UserModel.findOne({ email: email.toLowerCase() }))
  },

  findById: async (id: string) => {
    const UserModel = await getUserModel()

    return toUser(await UserModel.findOne({ id }))
  },

  findByAppleId: async (appleId: string) => {
    const UserModel = await getUserModel()

    return toUser(await UserModel.findOne({ appleId }))
  },

  save: async (user: User) => {
    const UserModel = await getUserModel()
    const normalizedUser = {
      ...user,
      email: user.email.toLowerCase(),
    }

    const document = await UserModel.findOneAndUpdate({ id: normalizedUser.id }, normalizedUser, {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    })

    return toUser(document) ?? normalizedUser
  },
}
