import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import type { AccessRequest, AccessStatus } from './access.types'

type AccessRequestDocument = AccessRequest & mongoose.Document
let accessModel: Model<AccessRequestDocument> | undefined

const getAccessModel = async () => {
  await connectDatabase()

  if (!accessModel) {
    const schema = new Schema<AccessRequestDocument>(
      {
        id: { type: String, required: true, unique: true },
        requesterUserId: { type: String, required: true, index: true },
        ownerUserId: { type: String, required: true, index: true },
        status: {
          type: String,
          enum: ['pending', 'otpPending', 'active', 'rejected', 'revoked'],
          required: true,
        },
        otpHash: { type: String },
        otpExpiresAt: { type: Date },
        verifiedAt: { type: Date },
      },
      { collection: 'health_access_requests', timestamps: true, versionKey: false },
    )

    schema.index({ requesterUserId: 1, ownerUserId: 1, status: 1 })
    accessModel =
      (mongoose.models.HealthAccessRequest as Model<AccessRequestDocument> | undefined) ||
      mongoose.model<AccessRequestDocument>('HealthAccessRequest', schema)
  }

  return accessModel
}

export const accessStore = {
  create: async (requesterUserId: string, ownerUserId: string) => {
    const AccessModel = await getAccessModel()
    return AccessModel.create({ id: crypto.randomUUID(), requesterUserId, ownerUserId, status: 'pending' })
  },

  findOpen: async (requesterUserId: string, ownerUserId: string) => {
    const AccessModel = await getAccessModel()
    return AccessModel.findOne({
      requesterUserId,
      ownerUserId,
      status: { $in: ['pending', 'otpPending', 'active'] },
    }).lean()
  },

  findById: async (id: string) => {
    const AccessModel = await getAccessModel()
    return AccessModel.findOne({ id }).lean()
  },

  update: async (
    id: string,
    update: Partial<Pick<AccessRequest, 'status' | 'otpHash' | 'otpExpiresAt' | 'verifiedAt'>>,
  ) => {
    const AccessModel = await getAccessModel()
    const entries = Object.entries(update)
    const setValues = Object.fromEntries(entries.filter(([, value]) => value !== undefined))
    const unsetValues = Object.fromEntries(
      entries.filter(([, value]) => value === undefined).map(([key]) => [key, 1]),
    )
    return AccessModel.findOneAndUpdate(
      { id },
      {
        ...(Object.keys(setValues).length ? { $set: setValues } : {}),
        ...(Object.keys(unsetValues).length ? { $unset: unsetValues } : {}),
      },
      { new: true },
    ).lean()
  },

  hasActive: async (requesterUserId: string, ownerUserId: string) => {
    const AccessModel = await getAccessModel()
    return Boolean(await AccessModel.exists({ requesterUserId, ownerUserId, status: 'active' }))
  },

  listByRequester: async (requesterUserId: string) => {
    const AccessModel = await getAccessModel()
    return AccessModel.find({ requesterUserId }).sort({ createdAt: -1 }).lean()
  },

  listByOwner: async (ownerUserId: string) => {
    const AccessModel = await getAccessModel()
    return AccessModel.find({ ownerUserId }).sort({ createdAt: -1 }).lean()
  },

  setStatus: async (id: string, status: AccessStatus) => {
    return accessStore.update(id, { status })
  },

  deleteById: async (id: string) => {
    const AccessModel = await getAccessModel()
    await AccessModel.deleteOne({ id })
  },

  deleteByUserId: async (userId: string) => {
    const AccessModel = await getAccessModel()
    await AccessModel.deleteMany({
      $or: [{ requesterUserId: userId }, { ownerUserId: userId }],
    })
  },
}
