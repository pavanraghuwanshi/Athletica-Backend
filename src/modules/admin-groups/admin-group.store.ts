import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import type { AdminGroup } from './admin-group.types'

type AdminGroupDocument = AdminGroup & mongoose.Document
let adminGroupModel: Model<AdminGroupDocument> | undefined

const getAdminGroupModel = async () => {
  await connectDatabase()

  if (!adminGroupModel) {
    const schema = new Schema<AdminGroupDocument>(
      {
        id: { type: String, required: true, unique: true },
        adminUserId: { type: String, required: true, index: true },
        name: { type: String, required: true, trim: true },
        sport: { type: String, trim: true },
        memberUserIds: { type: [String], required: true, default: [] },
      },
      { collection: 'admin_groups', timestamps: true, versionKey: false },
    )

    schema.index({ adminUserId: 1, name: 1 })
    adminGroupModel =
      (mongoose.models.AdminGroup as Model<AdminGroupDocument> | undefined) ||
      mongoose.model<AdminGroupDocument>('AdminGroup', schema)
  }

  return adminGroupModel
}

export const adminGroupStore = {
  create: async (input: Pick<AdminGroup, 'adminUserId' | 'name' | 'sport' | 'memberUserIds'>) => {
    const AdminGroupModel = await getAdminGroupModel()

    return AdminGroupModel.create({ id: crypto.randomUUID(), ...input })
  },

  listByAdmin: async (
    adminUserId: string,
    options: { page: number; limit: number; search?: string },
  ) => {
    const AdminGroupModel = await getAdminGroupModel()
    const filter: mongoose.FilterQuery<AdminGroupDocument> = { adminUserId }

    if (options.search) {
      const escapedSearch = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const searchExpression = new RegExp(escapedSearch, 'i')
      filter.$or = [{ name: searchExpression }, { sport: searchExpression }]
    }

    const [groups, total] = await Promise.all([
      AdminGroupModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .lean(),
      AdminGroupModel.countDocuments(filter),
    ])

    return { groups, total }
  },

  findById: async (id: string) => {
    const AdminGroupModel = await getAdminGroupModel()

    return AdminGroupModel.findOne({ id }).lean()
  },

  update: async (
    id: string,
    update: Partial<Pick<AdminGroup, 'name' | 'sport' | 'memberUserIds'>>,
  ) => {
    const AdminGroupModel = await getAdminGroupModel()
    const entries = Object.entries(update)
    const setValues = Object.fromEntries(entries.filter(([, value]) => value !== undefined))
    const unsetValues = Object.fromEntries(
      entries.filter(([, value]) => value === undefined).map(([key]) => [key, 1]),
    )

    return AdminGroupModel.findOneAndUpdate(
      { id },
      {
        ...(Object.keys(setValues).length ? { $set: setValues } : {}),
        ...(Object.keys(unsetValues).length ? { $unset: unsetValues } : {}),
      },
      { new: true },
    ).lean()
  },

  deleteById: async (id: string) => {
    const AdminGroupModel = await getAdminGroupModel()

    await AdminGroupModel.deleteOne({ id })
  },

  deleteByUserId: async (userId: string) => {
    const AdminGroupModel = await getAdminGroupModel()

    await AdminGroupModel.deleteMany({ adminUserId: userId })
    await AdminGroupModel.updateMany({ memberUserIds: userId }, { $pull: { memberUserIds: userId } })
  },
}
