import mongoose from 'mongoose'

export interface IWarrantyClaim {
  userId: string
  billUrl: string
  name?: string
  invoiceNumber?: string
  purchasingDate?: Date
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
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
      enum: ['pending', 'approved', 'rejected'],
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

  listAll: async (filters: any = {}) => {
    return WarrantyClaim.find(filters).sort({ createdAt: -1 }).lean()
  },

  update: async (id: string, data: Partial<IWarrantyClaim>) => {
    return WarrantyClaim.findByIdAndUpdate(id, data, { new: true }).lean()
  },

  deleteById: async (id: string) => {
    return WarrantyClaim.findByIdAndDelete(id).lean()
  }
}
