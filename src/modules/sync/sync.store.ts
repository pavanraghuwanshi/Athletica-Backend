import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'

type UserSyncState = {
  ownerUserId: string
  lastSyncedAt: number
}

type UserSyncStateDocument = UserSyncState & mongoose.Document
let userSyncStateModel: Model<UserSyncStateDocument> | undefined

const getUserSyncStateModel = async () => {
  await connectDatabase()

  if (!userSyncStateModel) {
    const schema = new Schema<UserSyncStateDocument>(
      {
        ownerUserId: { type: String, required: true, unique: true },
        lastSyncedAt: { type: Number, required: true },
      },
      { collection: 'bandpro_user_sync_state', versionKey: false },
    )

    userSyncStateModel =
      (mongoose.models.BandProUserSyncState as Model<UserSyncStateDocument> | undefined) ||
      mongoose.model<UserSyncStateDocument>('BandProUserSyncState', schema)
  }

  return userSyncStateModel
}

export const syncStore = {
  saveLastSyncedAt: async (ownerUserId: string, lastSyncedAt: number) => {
    const UserSyncStateModel = await getUserSyncStateModel()

    await UserSyncStateModel.updateOne(
      { ownerUserId },
      { $max: { lastSyncedAt } },
      { upsert: true },
    )
  },

  findLastSyncedAtByOwnerIds: async (ownerUserIds: string[]) => {
    if (!ownerUserIds.length) {
      return new Map<string, number>()
    }

    const UserSyncStateModel = await getUserSyncStateModel()
    const states = await UserSyncStateModel.find({ ownerUserId: { $in: [...new Set(ownerUserIds)] } })
      .select({ _id: 0, ownerUserId: 1, lastSyncedAt: 1 })
      .lean()

    return new Map(states.map((state) => [state.ownerUserId, state.lastSyncedAt]))
  },
}
