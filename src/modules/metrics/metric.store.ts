import mongoose, { Schema, type Model } from 'mongoose'
import { connectDatabase } from '../../config/db'
import { metricCollectionNames, type MetricName, type MetricRecord } from './metric.types'
import { metricNames } from './metric.types'

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

    const result = MetricModel.find(query).limit(filter.limit)

    // A date identifies one daily record for metrics such as blood oxygen.
    // Sorting a large document is unnecessary work in this common request.
    if (!filter.date) {
      result.sort({ timestamp: -1, recordId: -1 })
    }

    return result.lean()
  },

  findByRecordId: async (ownerUserId: string, metric: MetricName, recordId: string) => {
    const MetricModel = await getMetricModel(metric)

    return MetricModel.findOne({ ownerUserId, recordId }).lean()
  },

  findByRecordIds: async (ownerUserId: string, metric: MetricName, recordIds: string[]) => {
    if (!recordIds.length) {
      return []
    }

    const MetricModel = await getMetricModel(metric)

    return MetricModel.find({
      ownerUserId,
      recordId: { $in: [...new Set(recordIds)] },
    }).lean()
  },

  findLatestForOwners: async (filter: {
    ownerUserIds: string[]
    metric: MetricName
    arrayPath?: string
    timestampField?: string
  }) => {
    if (!filter.ownerUserIds.length) {
      return []
    }

    const MetricModel = await getMetricModel(filter.metric)
    const ownerUserIds = [...new Set(filter.ownerUserIds)]

    if (filter.arrayPath && filter.timestampField) {
      const measurementPath = `data.${filter.arrayPath}`
      const timestampPath = `${measurementPath}.${filter.timestampField}`

      return MetricModel.aggregate<{
        ownerUserId: string
        timestamp?: number
        date?: string
        data: MetricRecord
        updatedAt?: Date
      }>([
        { $match: { ownerUserId: { $in: ownerUserIds }, [`${measurementPath}.0`]: { $exists: true } } },
        { $sort: { ownerUserId: 1, timestamp: -1, recordId: -1 } },
        {
          $group: {
            _id: '$ownerUserId',
            date: { $first: '$date' },
            data: { $first: '$data' },
            updatedAt: { $first: '$updatedAt' },
          },
        },
        {
          $project: {
            _id: 0,
            ownerUserId: '$_id',
            timestamp: { $arrayElemAt: [`$${timestampPath}`, -1] },
            date: 1,
            data: { $arrayElemAt: [`$${measurementPath}`, -1] },
            updatedAt: 1,
          },
        },
      ])
    }

    return MetricModel.aggregate<{
      ownerUserId: string
      timestamp?: number
      date?: string
      data: MetricRecord
      updatedAt?: Date
    }>([
      { $match: { ownerUserId: { $in: ownerUserIds } } },
      { $sort: { ownerUserId: 1, timestamp: -1, recordId: -1 } },
      {
        $group: {
          _id: '$ownerUserId',
          timestamp: { $first: '$timestamp' },
          date: { $first: '$date' },
          data: { $first: '$data' },
          updatedAt: { $first: '$updatedAt' },
        },
      },
      { $project: { _id: 0, ownerUserId: '$_id', timestamp: 1, date: 1, data: 1, updatedAt: 1 } },
    ])
  },

  deleteByRecordIds: async (ownerUserId: string, metric: MetricName, recordIds: string[]) => {
    if (!recordIds.length) {
      return 0
    }

    const MetricModel = await getMetricModel(metric)
    const result = await MetricModel.deleteMany({
      ownerUserId,
      recordId: { $in: [...new Set(recordIds)] },
    })

    return result.deletedCount
  },

  findLatestNested: async (filter: {
    ownerUserId: string
    metric: MetricName
    date?: string
    arrayPath: string
    timestampField: string
  }) => {
    const MetricModel = await getMetricModel(filter.metric)
    const measurementPath = `data.${filter.arrayPath}`
    const timestampPath = `${measurementPath}.${filter.timestampField}`
    const [document] = await MetricModel.aggregate<{
      timestamp?: number
      data: MetricRecord
      updatedAt?: Date
    }>([
      {
        $match: {
          ownerUserId: filter.ownerUserId,
          ...(filter.date ? { date: filter.date } : {}),
        },
      },
      { $unwind: `$${measurementPath}` },
      { $sort: { [timestampPath]: -1 } },
      { $limit: 1 },
      {
        $project: {
          _id: 0,
          timestamp: `$${timestampPath}`,
          data: `$${measurementPath}`,
          updatedAt: 1,
        },
      },
    ])

    return document
  },

  deleteAllByOwner: async (ownerUserId: string) => {
    const results = await Promise.all(
      metricNames.map(async (metric) => {
        const MetricModel = await getMetricModel(metric)
        const result = await MetricModel.deleteMany({ ownerUserId })
        return result.deletedCount
      }),
    )

    return results.reduce((total, deletedCount) => total + deletedCount, 0)
  },
}
