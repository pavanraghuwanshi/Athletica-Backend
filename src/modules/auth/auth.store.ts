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
        picture: { type: String },
        passwordHash: { type: String },
        googleId: { type: String, sparse: true },
        appleId: { type: String, sparse: true },
        providers: { type: [String], required: true },
        role: { type: String, enum: ['user', 'admin', 'superAdmin'], required: true, default: 'user' },
        deviceMacIds: { type: [String], default: [] },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
      },
      {
        collection: 'users',
        versionKey: false,
      },
    )

    userModel = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema)
  }

  return userModel
}

const toUser = (document: UserDocument | null): User | undefined => {
  const user = document?.toObject<User>({
    flattenMaps: true,
    transform: (_document, user) => {
      delete (user as { _id?: unknown })._id

      return user
    },
  })

  if (user && !['admin', 'superAdmin'].includes(user.role)) {
    user.role = 'user'
  }

  return user
}

export const userStore = {
  listAll: async () => {
    const UserModel = await getUserModel()
    const documents = await UserModel.find().sort({ createdAt: -1 })

    return documents.map(toUser).filter((user): user is User => Boolean(user))
  },

  listByIds: async (ids: string[]) => {
    if (!ids.length) {
      return []
    }

    const UserModel = await getUserModel()
    const documents = await UserModel.find({ id: { $in: [...new Set(ids)] } }).sort({ createdAt: -1 })

    return documents.map(toUser).filter((user): user is User => Boolean(user))
  },

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

  setRole: async (id: string, role: User['role']) => {
    const UserModel = await getUserModel()
    const updatedAt = new Date().toISOString()
    const document = await UserModel.findOneAndUpdate({ id }, { role, updatedAt }, { new: true })

    return toUser(document)
  },

  deleteById: async (id: string) => {
    const UserModel = await getUserModel()
    await UserModel.deleteOne({ id })
  },

  addDevice: async (id: string, macId: string) => {
    const UserModel = await getUserModel()
    const updatedAt = new Date().toISOString()
    const document = await UserModel.findOneAndUpdate(
      { id },
      { $addToSet: { deviceMacIds: macId }, updatedAt },
      { new: true }
    )
    return toUser(document)
  }
}
