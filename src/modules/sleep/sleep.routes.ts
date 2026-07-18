import { Hono, type Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { createMetricRoutes } from '../metrics/metric.routes.factory'
import { metricService } from '../metrics/metric.service'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  throw error
}

export const sleepRoutes = new Hono()

sleepRoutes.get('/summary', async (context) => {
  try {
    const user = await getAuthenticatedUser(context)
    return context.json(
      await metricService.sleepSummary(user, {
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

sleepRoutes.route('/', createMetricRoutes('sleep'))
