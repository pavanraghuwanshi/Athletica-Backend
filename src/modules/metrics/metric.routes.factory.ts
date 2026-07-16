import { Hono, type Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import type { MetricName } from './metric.types'
import { metricService } from './metric.service'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  throw error
}

export const createMetricRoutes = (metric: MetricName) => {
  const routes = new Hono()

  routes.post('/', async (context) => {
    try {
      const user = await getAuthenticatedUser(context)
      const body = await context.req.json().catch(() => {
        throw new AuthError('Valid JSON body is required', 400)
      })
      return context.json(await metricService.save(metric, user, body), 201)
    } catch (error) {
      return handleError(context, error)
    }
  })

  routes.get('/', async (context) => {
    try {
      const user = await getAuthenticatedUser(context)
      return context.json(
        await metricService.list(metric, user, {
          ownerEmail: context.req.query('ownerEmail'),
          ownerUserId: context.req.query('ownerUserId'),
          date: context.req.query('date'),
          from: context.req.query('from'),
          to: context.req.query('to'),
          limit: context.req.query('limit'),
        }),
      )
    } catch (error) {
      return handleError(context, error)
    }
  })

  routes.get('/:id', async (context) => {
    try {
      const user = await getAuthenticatedUser(context)
      const requestedOwnerUserId = context.req.param('id')

      return context.json(
        await metricService.list(metric, user, {
          ownerUserId: requestedOwnerUserId ?? context.req.query('ownerUserId'),
          ownerEmail: context.req.query('ownerEmail'),
          date: context.req.query('date'),
          from: context.req.query('from'),
          to: context.req.query('to'),
          limit: context.req.query('limit'),
        }),
      )
    } catch (error) {
      return handleError(context, error)
    }
  })

  return routes
}
