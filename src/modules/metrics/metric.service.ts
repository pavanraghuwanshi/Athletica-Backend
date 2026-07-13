import type { AuthUserResponse } from '../auth/auth.types'
import { userStore } from '../auth/auth.store'
import { accessService } from '../sharing/access.service'
import { AuthError } from '../auth/auth.service'
import { metricStore } from './metric.store'
import { metricTimestampFields, type MetricName, type MetricRecord } from './metric.types'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const validateDate = (value: string | undefined, field: string) => {
  if (value && !datePattern.test(value)) {
    throw new AuthError(`${field} must use yyyy-MM-dd format`, 400)
  }
}

const getTimestamp = (metric: MetricName, record: MetricRecord) => {
  for (const field of metricTimestampFields[metric]) {
    const value = record[field]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
}

const getRecordDate = (record: MetricRecord, timestamp?: number) => {
  if (typeof record.id === 'string' && datePattern.test(record.id)) {
    return record.id
  }

  if (timestamp !== undefined) {
    return new Date(timestamp).toISOString().slice(0, 10)
  }

  throw new AuthError('Each record needs a documented timestamp/date field', 400)
}

const normalizeRecords = (body: unknown) => {
  const candidate =
    body && typeof body === 'object' && !Array.isArray(body) && 'records' in body
      ? (body as { records?: unknown }).records
      : body
  const records = Array.isArray(candidate) ? candidate : [candidate]

  if (!records.length || records.length > 5000) {
    throw new AuthError('Send between 1 and 5000 records', 400)
  }

  return records.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new AuthError('Every record must be a JSON object', 400)
    }

    const typedRecord = record as MetricRecord

    if (typeof typedRecord.id !== 'string' && typeof typedRecord.id !== 'number') {
      throw new AuthError('Every record must have an id', 400)
    }

    return typedRecord
  })
}

const resolveOwner = async (viewer: AuthUserResponse, ownerEmail?: string) => {
  const normalizedOwnerEmail = ownerEmail?.trim().toLowerCase()

  if (!normalizedOwnerEmail || normalizedOwnerEmail === viewer.email) {
    return { id: viewer.id, email: viewer.email }
  }

  const owner = await userStore.findByEmail(normalizedOwnerEmail)

  if (!owner) {
    throw new AuthError('Data owner not found', 404)
  }

  if (!(await accessService.hasActiveAccess(viewer.id, owner.id))) {
    throw new AuthError('The user has not made you their data admin', 403)
  }

  return { id: owner.id, email: owner.email }
}

export const metricService = {
  save: async (metric: MetricName, user: AuthUserResponse, body: unknown) => {
    const records = normalizeRecords(body)
    const storedRecords = records.map((record) => {
      const timestamp = getTimestamp(metric, record)

      return {
        ownerUserId: user.id,
        metric,
        recordId: String(record.id),
        date: getRecordDate(record, timestamp),
        timestamp,
        data: record,
      }
    })

    await metricStore.upsertMany(storedRecords)

    return { metric, saved: records.length }
  },

  list: async (
    metric: MetricName,
    viewer: AuthUserResponse,
    query: { ownerEmail?: string; date?: string; from?: string; to?: string; limit?: string },
  ) => {
    validateDate(query.date, 'date')
    validateDate(query.from, 'from')
    validateDate(query.to, 'to')
    const owner = await resolveOwner(viewer, query.ownerEmail)
    const requestedLimit = Number(query.limit ?? 500)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : 500
    const documents = await metricStore.find({ ownerUserId: owner.id, metric, ...query, limit })

    return { metric, ownerEmail: owner.email, count: documents.length, records: documents.map((item) => item.data) }
  },

  getById: async (metric: MetricName, viewer: AuthUserResponse, recordId: string, ownerEmail?: string) => {
    const owner = await resolveOwner(viewer, ownerEmail)
    const document = await metricStore.findByRecordId(owner.id, metric, recordId)

    if (!document) {
      throw new AuthError('Health record not found', 404)
    }

    return { metric, ownerEmail: owner.email, record: document.data }
  },
}
