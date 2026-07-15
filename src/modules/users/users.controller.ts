import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { usersService } from './users.service'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  throw error
}

export const usersController = {
  list: async (context: Context) => {
    try {
      return context.json({ users: await usersService.listVisible(await getAuthenticatedUser(context)) })
    } catch (error) {
      return handleError(context, error)
    }
  },

  get: async (context: Context) => {
    try {
      return context.json({
        user: await usersService.getVisibleById(await getAuthenticatedUser(context), context.req.param('id')),
      })
    } catch (error) {
      return handleError(context, error)
    }
  },
}
