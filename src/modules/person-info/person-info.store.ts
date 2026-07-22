import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import type { PersonInfo, SavePersonInfoInput } from './person-info.types'

type PersonInfoDocument = PersonInfo & mongoose.Document

let personInfoModel: Model<PersonInfoDocument> | undefined

const getPersonInfoModel = async () => {
  await connectDatabase()

  if (!personInfoModel) {
    const personInfoSchema = new Schema<PersonInfoDocument>(
      {
        userId: { type: String, required: true, unique: true },
        gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
        name: { type: String, required: true },
        height: { type: Number, required: true },
        weight: { type: Number, required: true },
        age: { type: Number, required: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
      },
      {
        collection: 'person_info',
        versionKey: false,
      },
    )

    personInfoModel = mongoose.models.PersonInfo || mongoose.model<PersonInfoDocument>('PersonInfo', personInfoSchema)
  }

  return personInfoModel
}

const toPersonInfo = (document: PersonInfoDocument | null) => {
  if (!document) return null
  const info = document.toObject<PersonInfo>({
    flattenMaps: true,
    transform: (_doc, ret) => {
      delete (ret as { _id?: unknown })._id
      return ret
    },
  })
  return info
}

export const personInfoStore = {
  getByUserId: async (userId: string) => {
    const Model = await getPersonInfoModel()
    return toPersonInfo(await Model.findOne({ userId }))
  },

  save: async (userId: string, input: SavePersonInfoInput) => {
    const Model = await getPersonInfoModel()
    const now = new Date().toISOString()
    const document = await Model.findOneAndUpdate(
      { userId },
      { ...input, updatedAt: now, $setOnInsert: { createdAt: now } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    )
    return toPersonInfo(document)
  },

  deleteByUserId: async (userId: string) => {
    const Model = await getPersonInfoModel()
    await Model.deleteOne({ userId })
  }
}
