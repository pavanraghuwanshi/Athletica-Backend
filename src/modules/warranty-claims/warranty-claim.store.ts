import mongoose from 'mongoose'

export interface IWarrantyClaim {
  userId: string
  billUrl: string
  name?: string
  invoiceNumber?: string
  purchasingDate?: Date
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'replaced'
  createdAt: Date
  updatedAt: Date
}

const warrantyClaimSchema = new mongoose.Schema<IWarrantyClaim>(
  {
    userId: { type: String, required: true },
    billUrl: { type: String, required: true },
    name: { type: String, required: false },
    invoiceNumber: { type: String, required: false },
    purchasingDate: { type: Date, required: false },
    reason: { type: String, required: false },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'replaced'],
      default: 'pending'
    },
  },
  {
    timestamps: true,
  }
)

export const WarrantyClaim = mongoose.model<IWarrantyClaim>('WarrantyClaim', warrantyClaimSchema)

export const warrantyClaimStore = {
  create: async (data: Partial<IWarrantyClaim>) => {
    return WarrantyClaim.create(data)
  },

  findById: async (id: string) => {
    return WarrantyClaim.findById(id).lean()
  },

  listAll: async (filters: any = {}, page: number = 1, limit: number = 20) => {
    const skip = (page - 1) * limit
    const [claims, total] = await Promise.all([
      WarrantyClaim.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WarrantyClaim.countDocuments(filters)
    ])
    return { claims, total }
  },

  update: async (id: string, data: Partial<IWarrantyClaim>) => {
    return WarrantyClaim.findByIdAndUpdate(id, data, { new: true }).lean()
  },

  deleteById: async (id: string) => {
    return WarrantyClaim.findByIdAndDelete(id).lean()
  }
}
