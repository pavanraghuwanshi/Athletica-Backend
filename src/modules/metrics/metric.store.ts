import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import { metricCollectionNames, type MetricName, type MetricRecord } from './metric.types'

type StoredMetric = {
  ownerUserId: string
  metric: MetricName
  recordId: string
  date: string
  timestamp?: number
  data: MetricRecord
  createdAt: Date
  updatedAt: Date
}

type StoredMetricDocument = StoredMetric & mongoose.Document
const metricModels: Partial<Record<MetricName, Model<StoredMetricDocument>>> = {}

const getMetricModel = async (metric: MetricName) => {
  await connectDatabase()

  if (!metricModels[metric]) {
    const schema = new Schema<StoredMetricDocument>(
      {
        ownerUserId: { type: String, required: true, index: true },
        metric: { type: String, required: true, immutable: true },
        recordId: { type: String, required: true },
        date: { type: String, required: true, index: true },
        timestamp: { type: Number },
        data: { type: Schema.Types.Mixed, required: true },
      },
      { collection: metricCollectionNames[metric], timestamps: true, versionKey: false },
    )

    schema.index({ ownerUserId: 1, recordId: 1 }, { unique: true })
    schema.index({ ownerUserId: 1, date: 1, timestamp: 1 })
    const modelName = `BandPro_${metric}`
    metricModels[metric] =
      (mongoose.models[modelName] as Model<StoredMetricDocument> | undefined) ||
      mongoose.model<StoredMetricDocument>(modelName, schema)
  }

  return metricModels[metric]!
}

export const metricStore = {
  upsertMany: async (records: Omit<StoredMetric, 'createdAt' | 'updatedAt'>[]) => {
    if (!records.length) {
      return 0
    }

    const metric = records[0].metric

    if (records.some((record) => record.metric !== metric)) {
      throw new Error('A metric store operation cannot mix different metric types')
    }

    const MetricModel = await getMetricModel(metric)

    const result = await MetricModel.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: {
            ownerUserId: record.ownerUserId,
            recordId: record.recordId,
          },
          update: { $set: record },
          upsert: true,
        },
      })),
    )

    return result.upsertedCount + result.modifiedCount + result.matchedCount
  },

  find: async (filter: {
    ownerUserId: string
    metric: MetricName
    date?: string
    from?: string
    to?: string
    limit: number
  }) => {
    const MetricModel = await getMetricModel(filter.metric)
    const query: Record<string, unknown> = {
      ownerUserId: filter.ownerUserId,
    }

    if (filter.date) {
      query.date = filter.date
    } else if (filter.from || filter.to) {
      query.date = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      }
    }

    return MetricModel.find(query)
      .sort({ timestamp: -1, recordId: -1 })
      .limit(filter.limit)
      .lean()
  },

  findByRecordId: async (ownerUserId: string, metric: MetricName, recordId: string) => {
    const MetricModel = await getMetricModel(metric)

    return MetricModel.findOne({ ownerUserId, recordId }).lean()
  },
}
