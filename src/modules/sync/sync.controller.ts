import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { syncService } from './sync.service'

export const syncController = {
  upload: async (context: Context) => {
    try {
      const user = await getAuthenticatedUser(context)
      const body = await context.req.json().catch(() => {
        throw new AuthError('Valid JSON body is required', 400)
      })

      return context.json(await syncService.upload(user, body))
    } catch (error) {
      if (error instanceof AuthError) {
        return context.json({ message: error.message }, error.statusCode)
      }

      throw error
    }
  },
}
