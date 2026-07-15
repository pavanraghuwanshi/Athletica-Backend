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

    return { id: owner.id, email: owner.email }
  }

  if (!normalizedOwnerEmail || normalizedOwnerEmail === viewer.email) {
    return { id: viewer.id, email: viewer.email }
  }

  const owner = await userStore.findByEmail(normalizedOwnerEmail)

  if (!owner) {
    throw new AuthError('Data owner not found', 404)
  }

  await ensureOwnerAccess(viewer, owner)

  return { id: owner.id, email: owner.email }
}

const asNumber = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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
      value: formatMinutes(sleepMinutes || undefined),
      meta: { totalMinutes: sleepMinutes || undefined },
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
      value: ecg ? (asNumber(ecg.success) === 1 ? 'Normal' : 'Review') : undefined,
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
    steps: asNumber(pedometer?.steps) ?? asNumber(pedometer?.total_steps),
    caloriesKcal: asNumber(pedometer?.caloriesKcal) ?? asNumber(pedometer?.calories_kcal),
    distanceMeters: asNumber(pedometer?.distanceMeters) ?? asNumber(pedometer?.distance_meters),
    updatedAt: getUpdatedAt(documents.pedometer),
  }

  return {
    healthScore: getHealthScore(cards),
    cards,
    activity,
  }
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
    query: { ownerEmail?: string; ownerUserId?: string; date?: string; from?: string; to?: string; limit?: string },
  ) => {
    validateDate(query.date, 'date')
    validateDate(query.from, 'from')
    validateDate(query.to, 'to')
    const owner = await resolveOwner(viewer, query)
    const requestedLimit = Number(query.limit ?? 500)
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : 500
    const documents = await metricStore.find({ ownerUserId: owner.id, metric, ...query, limit })

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
    const date = dateInput?.trim() || undefined
    validateDate(date, 'date')
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
      ...(date ? { date } : {}),
      latestRecords,
      ...overview,
    }
  },
}
