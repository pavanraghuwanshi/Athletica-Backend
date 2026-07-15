import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'

type TokenRevocation = {
  tokenHash: string
  userId: string
  createdAt: Date
}

type TokenRevocationDocument = TokenRevocation & mongoose.Document
let tokenRevocationModel: Model<TokenRevocationDocument> | undefined

const getTokenRevocationModel = async () => {
  await connectDatabase()

  if (!tokenRevocationModel) {
    const schema = new Schema<TokenRevocationDocument>(
      {
        tokenHash: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
      },
      { collection: 'revoked_auth_tokens', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
    )

    tokenRevocationModel =
      (mongoose.models.RevokedAuthToken as Model<TokenRevocationDocument> | undefined) ||
      mongoose.model<TokenRevocationDocument>('RevokedAuthToken', schema)
  }

  return tokenRevocationModel
}

export const tokenRevocationStore = {
  revoke: async (tokenHash: string, userId: string) => {
    const TokenRevocationModel = await getTokenRevocationModel()
    await TokenRevocationModel.updateOne(
      { tokenHash },
      { $set: { tokenHash, userId }, $unset: { expiresAt: 1 } },
      { upsert: true },
    )
  },

  isRevoked: async (tokenHash: string) => {
    const TokenRevocationModel = await getTokenRevocationModel()
    return Boolean(await TokenRevocationModel.exists({ tokenHash }))
  },

  deleteByUserId: async (userId: string) => {
    const TokenRevocationModel = await getTokenRevocationModel()
    await TokenRevocationModel.deleteMany({ userId })
  },
}
