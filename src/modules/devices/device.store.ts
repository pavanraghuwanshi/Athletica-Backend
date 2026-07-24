import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import type { Device } from './device.types'

type DeviceDocument = Device & mongoose.Document

let deviceModel: Model<DeviceDocument> | undefined

const getDeviceModel = async () => {
  await connectDatabase()

  if (!deviceModel) {
    const deviceSchema = new Schema<DeviceDocument>(
      {
        macId: { type: String, required: true, unique: true, uppercase: true, trim: true },
        warrantyMonths: { type: Number, required: true, default: 12 },
        activationTime: { type: String },
        userId: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
      },
      {
        collection: 'devices',
        versionKey: false,
      },
    )

    deviceModel = mongoose.models.Device || mongoose.model<DeviceDocument>('Device', deviceSchema)
  }

  return deviceModel
}

const toDevice = (document: DeviceDocument | null): Device | undefined => {
  const device = document?.toObject<Device>({
    flattenMaps: true,
    transform: (_document, device) => {
      delete (device as { _id?: unknown })._id

      return device
    },
  })

  return device
}

export const deviceStore = {
  bulkInsert: async (macIds: string[]) => {
    const DeviceModel = await getDeviceModel()
    const now = new Date().toISOString()
    
    const operations = macIds.map(macId => ({
      updateOne: {
        filter: { macId },
        update: {
          $setOnInsert: {
            macId,
            warrantyMonths: 12, // Default to 12 months as per user request
            createdAt: now,
            updatedAt: now,
          }
        },
        upsert: true
      }
    }))

    if (operations.length === 0) return 0
    
    const result = await DeviceModel.bulkWrite(operations)
    return result.upsertedCount + result.modifiedCount
  },

  findByMacId: async (macId: string) => {
    const DeviceModel = await getDeviceModel()
    return toDevice(await DeviceModel.findOne({ macId }))
  },

  activateDevice: async (macId: string, userId: string, activationTime: string) => {
    const DeviceModel = await getDeviceModel()
    const updatedAt = new Date().toISOString()
    
    const document = await DeviceModel.findOneAndUpdate(
      { macId },
      { 
        $set: { 
          activationTime,
          userId,
          updatedAt
        } 
      },
      { new: true }
    )
    
    return toDevice(document)
  }
}
