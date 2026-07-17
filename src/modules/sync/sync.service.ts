import type { AuthUserResponse } from '../auth/auth.types'
import { AuthError } from '../auth/auth.service'
import { metricService } from '../metrics/metric.service'
import { metricNames, type MetricName } from '../metrics/metric.types'
import { syncStore } from './sync.store'

type SyncPayload = Partial<Record<MetricName, unknown>> & { syncedAt?: unknown }

export const syncService = {
  upload: async (user: AuthUserResponse, body: unknown) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AuthError('Sync payload must be a JSON object', 400)
    }

    const payload = body as SyncPayload

    if (payload.syncedAt !== undefined && (typeof payload.syncedAt !== 'number' || !Number.isFinite(payload.syncedAt))) {
      throw new AuthError('syncedAt must be an epoch millisecond number', 400)
    }

    const uploads = metricNames.flatMap((metric) => {
      const records = payload[metric]

      if (records === undefined) {
        return []
      }

      if (!Array.isArray(records)) {
        throw new AuthError(`${metric} must be an array`, 400)
      }

      return records.length ? [{ metric, records }] : []
    })

    if (!uploads.length) {
      throw new AuthError('Sync payload must contain at least one health record', 400)
    }

    const results = await Promise.all(
      uploads.map(({ metric, records }) => metricService.save(metric, user, records)),
    )
    const syncedAt = typeof payload.syncedAt === 'number' ? payload.syncedAt : Date.now()

    await syncStore.saveLastSyncedAt(user.id, syncedAt)

    return {
      syncedAt,
      totalSaved: results.reduce((total, result) => total + result.saved, 0),
      savedByMetric: Object.fromEntries(results.map((result) => [result.metric, result.saved])),
    }
  },
}
