import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'

export interface ReferralSettings {
  signupBonus: number;
  referralReward: number;
  discountPercentage: number;
  updatedAt: string;
}

type ReferralSettingsDocument = ReferralSettings & mongoose.Document

let referralSettingsModel: Model<ReferralSettingsDocument> | undefined

const getReferralSettingsModel = async () => {
  await connectDatabase()

  if (!referralSettingsModel) {
    const settingsSchema = new Schema<ReferralSettingsDocument>(
      {
        signupBonus: { type: Number, required: true, default: 0 },
        referralReward: { type: Number, required: true, default: 0 },
        discountPercentage: { type: Number, required: true, default: 0 },
        updatedAt: { type: String, required: true },
      },
      {
        collection: 'referral_settings',
        versionKey: false,
      }
    )

    referralSettingsModel = mongoose.models.ReferralSettings || mongoose.model<ReferralSettingsDocument>('ReferralSettings', settingsSchema)
  }

  return referralSettingsModel
}

const toSettings = (document: ReferralSettingsDocument | null): ReferralSettings | undefined => {
  if (!document) return undefined
  const settings = document.toObject<ReferralSettings>({
    flattenMaps: true,
    transform: (_doc, ret) => {
      delete (ret as { _id?: unknown })._id
      return ret
    }
  })
  return settings
}

export const systemSettingsStore = {
  getReferralSettings: async (): Promise<ReferralSettings> => {
    const Model = await getReferralSettingsModel()
    const document = await Model.findOne()
    
    if (!document) {
      // Return defaults if not initialized
      return {
        signupBonus: 0,
        referralReward: 0,
        discountPercentage: 0,
        updatedAt: new Date().toISOString()
      }
    }
    return toSettings(document)!
  },

  updateReferralSettings: async (settings: Partial<ReferralSettings>): Promise<ReferralSettings> => {
    const Model = await getReferralSettingsModel()
    
    const updates = {
      ...settings,
      updatedAt: new Date().toISOString()
    }
    
    const document = await Model.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    return toSettings(document)!
  }
}
