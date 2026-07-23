import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'

export type AuthOtpPurpose = 'register' | 'delete'

export interface AuthOtp {
  id: string
  email: string
  purpose: AuthOtpPurpose
  otpHash: string
  otpExpiresAt: Date
  otpSendCount: number
  otpHoldUntil?: Date
  createdAt: Date
  updatedAt: Date
}

type AuthOtpDocument = AuthOtp & mongoose.Document
let authOtpModel: Model<AuthOtpDocument> | undefined

const getAuthOtpModel = async () => {
  await connectDatabase()

  if (!authOtpModel) {
    const schema = new Schema<AuthOtpDocument>(
      {
        id: { type: String, required: true, unique: true },
        email: { type: String, required: true, index: true },
        purpose: {
          type: String,
          enum: ['register', 'delete'],
          required: true,
        },
        otpHash: { type: String, required: true },
        otpExpiresAt: { type: Date, required: true },
        otpSendCount: { type: Number, default: 0 },
        otpHoldUntil: { type: Date },
      },
      { collection: 'auth_otps', timestamps: true, versionKey: false },
    )

    schema.index({ email: 1, purpose: 1 }, { unique: true })
    authOtpModel =
      (mongoose.models.AuthOtp as Model<AuthOtpDocument> | undefined) ||
      mongoose.model<AuthOtpDocument>('AuthOtp', schema)
  }

  return authOtpModel
}

export const authOtpStore = {
  createOrUpdate: async (
    email: string,
    purpose: AuthOtpPurpose,
    update: Pick<AuthOtp, 'otpHash' | 'otpExpiresAt' | 'otpSendCount'> & { otpHoldUntil?: Date }
  ) => {
    const Model = await getAuthOtpModel()
    const entries = Object.entries(update)
    const setValues = Object.fromEntries(entries.filter(([, value]) => value !== undefined))
    const unsetValues = Object.fromEntries(
      entries.filter(([, value]) => value === undefined).map(([key]) => [key, 1]),
    )

    return Model.findOneAndUpdate(
      { email: email.toLowerCase(), purpose },
      {
        $setOnInsert: { id: crypto.randomUUID() },
        $set: setValues,
        ...(Object.keys(unsetValues).length ? { $unset: unsetValues } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()
  },

  findByEmailAndPurpose: async (email: string, purpose: AuthOtpPurpose) => {
    const Model = await getAuthOtpModel()
    return Model.findOne({ email: email.toLowerCase(), purpose }).lean()
  },

  deleteByEmailAndPurpose: async (email: string, purpose: AuthOtpPurpose) => {
    const Model = await getAuthOtpModel()
    await Model.deleteOne({ email: email.toLowerCase(), purpose })
  },
}
