import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { personInfoService } from './person-info.service'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  return context.json({ message: error instanceof Error ? error.message : 'Unknown error' }, 400)
}

export const personInfoController = {
  get: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const info = await personInfoService.get(viewer)
      return context.json({ personInfo: info })
    } catch (error) {
      return handleError(context, error)
    }
  },

  save: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const body = await context.req.json()
      const info = await personInfoService.save(viewer, body)
      return context.json({ personInfo: info })
    } catch (error) {
      return handleError(context, error)
    }
  },

  delete: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      await personInfoService.delete(viewer)
      return context.json({ success: true })
    } catch (error) {
      return handleError(context, error)
    }
  }
}
