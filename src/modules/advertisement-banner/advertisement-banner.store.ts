import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import type { AdvertisementBanner } from './advertisement-banner.types'

type AdvertisementBannerDocument = AdvertisementBanner & mongoose.Document

let advertisementBannerModel: Model<AdvertisementBannerDocument> | undefined

const getAdvertisementBannerModel = async () => {
  await connectDatabase()

  if (!advertisementBannerModel) {
    const advertisementBannerSchema = new Schema<AdvertisementBannerDocument>(
      {
        id: { type: String, required: true, unique: true },
        fileUrl: { type: String, required: true },
        contentType: { type: String, enum: ['image', 'video'], required: true },
        sequence: { type: Number, required: true },
        redirectUrl: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
      },
      {
        collection: 'advertisement_banners',
        versionKey: false,
      },
    )

    advertisementBannerModel = mongoose.models.AdvertisementBanner || mongoose.model<AdvertisementBannerDocument>('AdvertisementBanner', advertisementBannerSchema)
  }

  return advertisementBannerModel
}

const toAdvertisementBanner = (document: AdvertisementBannerDocument | null) => {
  if (!document) return null
  const banner = document.toObject<AdvertisementBanner>({
    flattenMaps: true,
    transform: (_doc, ret) => {
      delete (ret as { _id?: unknown })._id
      return ret
    },
  })
  return banner as AdvertisementBanner
}

export const advertisementBannerStore = {
  listAll: async () => {
    const Model = await getAdvertisementBannerModel()
    const documents = await Model.find().sort({ sequence: 1, createdAt: -1 })
    return documents.map(toAdvertisementBanner).filter((banner): banner is AdvertisementBanner => Boolean(banner))
  },

  findById: async (id: string) => {
    const Model = await getAdvertisementBannerModel()
    return toAdvertisementBanner(await Model.findOne({ id }))
  },

  create: async (id: string, payload: Omit<AdvertisementBanner, 'id' | 'createdAt' | 'updatedAt'>) => {
    const Model = await getAdvertisementBannerModel()
    const now = new Date().toISOString()
    const document = await Model.create({
      id,
      ...payload,
      createdAt: now,
      updatedAt: now,
    })
    return toAdvertisementBanner(document) as AdvertisementBanner
  },

  update: async (id: string, payload: Partial<Omit<AdvertisementBanner, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const Model = await getAdvertisementBannerModel()
    const document = await Model.findOneAndUpdate(
      { id },
      { ...payload, updatedAt: new Date().toISOString() },
      { new: true, runValidators: true }
    )
    return toAdvertisementBanner(document)
  },

  deleteById: async (id: string) => {
    const Model = await getAdvertisementBannerModel()
    await Model.deleteOne({ id })
  }
}
