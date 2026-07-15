import type { AuthUserResponse } from '../auth/auth.types'
import { userStore } from '../auth/auth.store'
import { accessService } from '../sharing/access.service'
import { AuthError } from '../auth/auth.service'
import { metricStore } from './metric.store'
import { metricNames, metricTimestampFields, type MetricName, type MetricRecord } from './metric.types'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

type MetricDocumentLike = {
  timestamp?: number
  updatedAt?: Date | string
  data: MetricRecord
}

const parseDate = (value: string | undefined, field: string) => {
  if (value === undefined) {
    return undefined
  }

  const normalizedValue = value.trim()

  if (!datePattern.test(normalizedValue)) {
    throw new AuthError(`${field} must use yyyy-MM-dd format`, 400)
  }

  return normalizedValue
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

const ensureOwnerAccess = async (viewer: AuthUserResponse, owner: { id: string; email: string }) => {
  if (owner.id === viewer.id || viewer.role === 'superAdmin') {
    return
  }

  if (!(await accessService.hasActiveAccess(viewer.id, owner.id))) {
    throw new AuthError('The user has not made you their data admin', 403)
  }
}

const resolveOwner = async (viewer: AuthUserResponse, query: { ownerEmail?: string; ownerUserId?: string }) => {
  const normalizedOwnerEmail = query.ownerEmail?.trim().toLowerCase()
  const ownerUserId = query.ownerUserId?.trim()

  if (ownerUserId) {
    const owner = await userStore.findById(ownerUserId)

    if (!owner) {
      throw new AuthError('Data owner not found', 404)
    }

    await ensureOwnerAccess(viewer, owner)

    return { id: owner.id, name: owner.name, email: owner.email, picture: owner.picture }
  }

  if (normalizedOwnerEmail === viewer.email) {
    return { id: viewer.id, name: viewer.name, email: viewer.email, picture: viewer.picture }
  }

  if (!normalizedOwnerEmail) {
    if (viewer.role === 'admin') {
      const activeOwnerIds = await accessService.listActiveOwnerIds(viewer.id)

      if (activeOwnerIds.length === 1) {
        const owner = await userStore.findById(activeOwnerIds[0])

        if (owner) {
          return { id: owner.id, name: owner.name, email: owner.email, picture: owner.picture }
        }
      }

      if (activeOwnerIds.length > 1) {
        throw new AuthError('ownerUserId or ownerEmail is required when multiple users are connected', 400)
      }
    }

    return { id: viewer.id, name: viewer.name, email: viewer.email, picture: viewer.picture }
  }

  const owner = await userStore.findByEmail(normalizedOwnerEmail)

  if (!owner) {
    throw new AuthError('Data owner not found', 404)
  }

  await ensureOwnerAccess(viewer, owner)

  return { id: owner.id, name: owner.name, email: owner.email, picture: owner.picture }
}

const asNumber = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const asRecord = (value: unknown) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as MetricRecord) : undefined
}

const asArray = (value: unknown) => {
  return Array.isArray(value) ? value : []
}

const formatMinutes = (minutes?: number) => {
  if (minutes === undefined) {
    return undefined
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)

  return `${hours}h ${remainingMinutes}m`
}

const getUpdatedAt = (document?: MetricDocumentLike) => {
  if (!document) {
    return undefined
  }

  if (document.timestamp) {
    return new Date(document.timestamp).toISOString()
  }

  if (document.updatedAt instanceof Date) {
    return document.updatedAt.toISOString()
  }

  if (typeof document.updatedAt === 'string') {
    return document.updatedAt
  }

  return undefined
}

const nestedMeasurements: Partial<Record<MetricName, { arrayPath: string; timestampField: string }>> = {
  pedometer: { arrayPath: 'hourly_json', timestampField: 'timestamp' },
  sleep: { arrayPath: 'sleep_json.sessions', timestampField: 'endTime' },
  bloodOxygen: { arrayPath: 'blood_oxygen_json.samples', timestampField: 'timestamp' },
  bloodGlucose: { arrayPath: 'blood_glucose_json.samples', timestampField: 'timestamp' },
  bloodComponents: { arrayPath: 'blood_components_json.samples', timestampField: 'timestamp' },
  bodyTemperature: { arrayPath: 'body_temperature_json.samples', timestampField: 'timestamp' },
  hrv: { arrayPath: 'hrv_json.samples', timestampField: 'timestamp' },
  stress: { arrayPath: 'stress_json.samples', timestampField: 'timestamp' },
  met: { arrayPath: 'met_json.samples', timestampField: 'timestamp' },
  sportsWorkout: { arrayPath: 'samples_json', timestampField: 'timestamp' },
}

type MetricMergeConfig = {
  arrayKey: string
  containerKey?: string
  dailyRecord?: boolean
  identityField: string
  sortField: string
}

const metricMergeConfigs: Partial<Record<MetricName, MetricMergeConfig>> = {
  pedometer: { arrayKey: 'hourly_json', identityField: 'timestamp', sortField: 'timestamp', dailyRecord: true },
  sleep: {
    containerKey: 'sleep_json',
    arrayKey: 'sessions',
    identityField: 'startTime',
    sortField: 'endTime',
    dailyRecord: true,
  },
  bloodOxygen: {
    containerKey: 'blood_oxygen_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  bloodGlucose: {
    containerKey: 'blood_glucose_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  bloodComponents: {
    containerKey: 'blood_components_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  bodyTemperature: {
    containerKey: 'body_temperature_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  hrv: {
    containerKey: 'hrv_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  stress: {
    containerKey: 'stress_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  met: {
    containerKey: 'met_json',
    arrayKey: 'samples',
    identityField: 'timestamp',
    sortField: 'timestamp',
    dailyRecord: true,
  },
  sportsWorkout: { arrayKey: 'samples_json', identityField: 'timestamp', sortField: 'timestamp' },
}

const mergeTimedArrays = (existingValue: unknown, incomingValue: unknown, config: MetricMergeConfig) => {
  const mergedItems = new Map<string, unknown>()

  for (const item of [...asArray(existingValue), ...asArray(incomingValue)]) {
    const record = asRecord(item)
    const identity = record?.[config.identityField]
    const key = identity !== undefined ? `timestamp:${String(identity)}` : `value:${JSON.stringify(item)}`
    mergedItems.set(key, item)
  }

  return [...mergedItems.values()].sort((left, right) => {
    const leftValue = asNumber(asRecord(left)?.[config.sortField])
    const rightValue = asNumber(asRecord(right)?.[config.sortField])

    if (leftValue === undefined || rightValue === undefined) {
      return 0
    }

    return leftValue - rightValue
  })
}

const mergeMetricRecord = (metric: MetricName, existing: MetricRecord | undefined, incoming: MetricRecord) => {
  const config = metricMergeConfigs[metric]

  if (!config) {
    return incoming
  }

  const mergedRecord: MetricRecord = { ...existing, ...incoming }
  const existingContainer = config.containerKey ? asRecord(existing?.[config.containerKey]) : existing
  const incomingContainer = config.containerKey ? asRecord(incoming[config.containerKey]) : incoming
  const mergedArray = mergeTimedArrays(
    existingContainer?.[config.arrayKey],
    incomingContainer?.[config.arrayKey],
    config,
  )

  if (config.containerKey) {
    mergedRecord[config.containerKey] = {
      ...existingContainer,
      ...incomingContainer,
      [config.arrayKey]: mergedArray,
    }
  } else {
    mergedRecord[config.arrayKey] = mergedArray
  }

  return mergedRecord
}

const getHealthScore = (cards: Array<{ value?: number | string; key: string }>) => {
  const numericCards = cards.filter((card) => typeof card.value === 'number') as Array<{ value: number; key: string }>

  if (!numericCards.length) {
    return undefined
  }

  let score = 70

  for (const card of numericCards) {
    if (card.key === 'heartRate' && card.value >= 55 && card.value <= 100) score += 4
    if (card.key === 'spo2' && card.value >= 95) score += 5
    if (card.key === 'stress' && card.value <= 40) score += 4
    if (card.key === 'bmi' && card.value >= 18.5 && card.value <= 25) score += 4
    if (card.key === 'hrv' && card.value >= 40) score += 4
  }

  return Math.min(score, 100)
}

const buildOverview = (documents: Partial<Record<MetricName, MetricDocumentLike>>) => {
  const heartRate = documents.heartRate?.data
  const bloodPressure = documents.bloodPressure?.data
  const bloodGlucose = documents.bloodGlucose?.data
  const bloodOxygen = documents.bloodOxygen?.data
  const stress = documents.stress?.data
  const sleep = documents.sleep?.data
  const hrv = documents.hrv?.data
  const bodyTemperature = documents.bodyTemperature?.data
  const ecg = documents.ecg?.data
  const bodyComposition = documents.bodyComposition?.data
  const met = documents.met?.data
  const bloodComponents = documents.bloodComponents?.data
  const pedometer = documents.pedometer?.data
  const sleepMinutes = asNumber(sleep?.totalMinutes)
  const cards = [
    {
      key: 'heartRate',
      title: 'Heart Rate',
      value: asNumber(heartRate?.heart_rate),
      unit: 'bpm',
      updatedAt: getUpdatedAt(documents.heartRate),
    },
    {
      key: 'bloodPressure',
      title: 'Blood Pressure',
      value:
        asNumber(bloodPressure?.systolic) !== undefined && asNumber(bloodPressure?.diastolic) !== undefined
          ? `${asNumber(bloodPressure?.systolic)}/${asNumber(bloodPressure?.diastolic)}`
          : undefined,
      unit: 'mmHg',
      updatedAt: getUpdatedAt(documents.bloodPressure),
    },
    {
      key: 'bloodGlucose',
      title: 'Blood Glucose',
      value: asNumber(bloodGlucose?.glucose),
      unit: 'mmol/L',
      updatedAt: getUpdatedAt(documents.bloodGlucose),
    },
    {
      key: 'spo2',
      title: 'SPO2',
      value: asNumber(bloodOxygen?.oxygen),
      unit: '%',
      updatedAt: getUpdatedAt(documents.bloodOxygen),
    },
    {
      key: 'stress',
      title: 'Stress',
      value: asNumber(stress?.stress),
      updatedAt: getUpdatedAt(documents.stress),
    },
    {
      key: 'sleep',
      title: 'Sleep',
      value: formatMinutes(sleepMinutes),
      meta: { totalMinutes: sleepMinutes },
      updatedAt: getUpdatedAt(documents.sleep),
    },
    {
      key: 'hrv',
      title: 'HRV',
      value: asNumber(hrv?.hrv),
      unit: 'ms',
      updatedAt: getUpdatedAt(documents.hrv),
    },
    {
      key: 'bodyTemperature',
      title: 'Body Temp',
      value: asNumber(bodyTemperature?.temperatureCelsius),
      unit: '°C',
      updatedAt: getUpdatedAt(documents.bodyTemperature),
    },
    {
      key: 'ecg',
      title: 'ECG',
      value:
        asNumber(ecg?.success) === 1
          ? 'Normal'
          : asNumber(ecg?.success) === 0
            ? 'Review'
            : undefined,
      updatedAt: getUpdatedAt(documents.ecg),
    },
    {
      key: 'bmi',
      title: 'Body Composition',
      value: asNumber(bodyComposition?.bmi),
      unit: 'BMI',
      meta: {
        bodyFatPercentage: asNumber(bodyComposition?.body_fat_percentage),
        muscleRate: asNumber(bodyComposition?.muscle_rate),
        weight: asNumber(bodyComposition?.weight),
        height: asNumber(bodyComposition?.stature),
      },
      updatedAt: getUpdatedAt(documents.bodyComposition),
    },
    {
      key: 'metabolism',
      title: 'Metabolism',
      value: asNumber(bodyComposition?.basal_metabolic_rate) ?? asNumber(met?.met),
      unit: asNumber(bodyComposition?.basal_metabolic_rate) !== undefined ? 'kcal' : 'MET',
      updatedAt: getUpdatedAt(documents.bodyComposition) ?? getUpdatedAt(documents.met),
    },
    {
      key: 'bloodComponents',
      title: 'Blood Components',
      value: asNumber(bloodComponents?.uricAcid),
      unit: 'µmol/L',
      meta: { label: 'Uric acid' },
      updatedAt: getUpdatedAt(documents.bloodComponents),
    },
  ]
  const activity = {
    steps: asNumber(pedometer?.steps) ?? asNumber(pedometer?.total_steps) ?? null,
    caloriesKcal: asNumber(pedometer?.caloriesKcal) ?? asNumber(pedometer?.calories_kcal) ?? null,
    distanceMeters: asNumber(pedometer?.distanceMeters) ?? asNumber(pedometer?.distance_meters) ?? null,
    updatedAt: getUpdatedAt(documents.pedometer) ?? null,
  }
  const normalizedCards = cards.map((card) => ({
    ...card,
    value: card.value ?? null,
    unit: ('unit' in card ? card.unit : null) ?? null,
    meta:
      'meta' in card && card.meta
        ? Object.fromEntries(Object.entries(card.meta).map(([key, value]) => [key, value ?? null]))
        : null,
    updatedAt: card.updatedAt ?? null,
  }))

  return {
    healthScore: getHealthScore(cards) ?? null,
    cards: normalizedCards,
    activity,
  }
}

export const metricService = {
  save: async (metric: MetricName, user: AuthUserResponse, body: unknown) => {
    const records = normalizeRecords(body)
    const incomingRecords = new Map<
      string,
      { recordId: string; date: string; timestamp?: number; data: MetricRecord }
    >()

    for (const record of records) {
      const timestamp = getTimestamp(metric, record)
      const date = getRecordDate(record, timestamp)
      const recordId = metricMergeConfigs[metric]?.dailyRecord ? date : String(record.id)
      const previousIncoming = incomingRecords.get(recordId)

      incomingRecords.set(recordId, {
        recordId,
        date,
        timestamp:
          previousIncoming?.timestamp !== undefined && timestamp !== undefined
            ? Math.max(previousIncoming.timestamp, timestamp)
            : timestamp ?? previousIncoming?.timestamp,
        data: mergeMetricRecord(metric, previousIncoming?.data, record),
      })
    }

    const preparedRecords = [...incomingRecords.values()]
    const existingDocuments = metricMergeConfigs[metric]
      ? await metricStore.findByRecordIds(
          user.id,
          metric,
          preparedRecords.map((record) => record.recordId),
        )
      : []
    const existingByRecordId = new Map(existingDocuments.map((document) => [document.recordId, document.data]))
    const storedRecords = preparedRecords.map((record) => {
      return {
        ownerUserId: user.id,
        metric,
        recordId: record.recordId,
        date: record.date,
        timestamp: record.timestamp,
        data: mergeMetricRecord(metric, existingByRecordId.get(record.recordId), record.data),
      }
    })

    await metricStore.upsertMany(storedRecords)

    return { metric, saved: records.length }
  },

  list: async (
    metric: MetricName,
    viewer: AuthUserResponse,
    query: { ownerEmail?: string; ownerUserId?: string; date?: string; from?: string; to?: string; limit?: string },
  ) => {
    const date = parseDate(query.date, 'date')
    const from = parseDate(query.from, 'from')
    const to = parseDate(query.to, 'to')

    if (date && (from || to)) {
      throw new AuthError('Use either date or from/to filters, not both', 400)
    }

    if (from && to && from > to) {
      throw new AuthError('from must be earlier than or equal to to', 400)
    }

    const owner = await resolveOwner(viewer, query)
    const requestedLimit = Number(query.limit ?? 500)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : 500
    const documents = await metricStore.find({ ownerUserId: owner.id, metric, date, from, to, limit })

    return { metric, ownerUserId: owner.id, ownerEmail: owner.email, count: documents.length, records: documents.map((item) => item.data) }
  },

  getById: async (metric: MetricName, viewer: AuthUserResponse, recordId: string, query: { ownerEmail?: string; ownerUserId?: string }) => {
    const owner = await resolveOwner(viewer, query)
    const document = await metricStore.findByRecordId(owner.id, metric, recordId)

    if (!document) {
      throw new AuthError('Health record not found', 404)
    }

    return { metric, ownerUserId: owner.id, ownerEmail: owner.email, record: document.data }
  },

  overview: async (viewer: AuthUserResponse, ownerUserId: string, dateInput?: string) => {
    const date = parseDate(dateInput, 'date')
    const owner = await resolveOwner(viewer, { ownerUserId })
    const entries = await Promise.all(
      metricNames.map(async (metric) => {
        const nested = nestedMeasurements[metric]
        let document: MetricDocumentLike | undefined = nested
          ? await metricStore.findLatestNested({
              ownerUserId: owner.id,
              metric,
              ...(date ? { date } : {}),
              ...nested,
            })
          : undefined

        if (!nested || (!document && metric === 'sportsWorkout')) {
          const [latestDocument] = await metricStore.find({
            ownerUserId: owner.id,
            metric,
            ...(date ? { date } : {}),
            limit: 1,
          })
          document = latestDocument
        }

        return [metric, document] as const
      }),
    )
    const documents = Object.fromEntries(entries) as Partial<Record<MetricName, MetricDocumentLike>>
    const latestRecords = Object.fromEntries(
      metricNames.map((metric) => [metric, documents[metric]?.data ?? null]),
    ) as Record<MetricName, MetricRecord | null>
    const overview = buildOverview(documents)

    return {
      ownerUserId: owner.id,
      ownerEmail: owner.email,
      name: owner.name,
      picture: owner.picture ?? null,
      date: date ?? null,
      latestRecords,
      ...overview,
    }
  },
}
