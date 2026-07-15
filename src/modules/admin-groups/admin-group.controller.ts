import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { adminGroupService } from './admin-group.service'
import type { AdminGroupInput } from './admin-group.types'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  throw error
}

const getBody = async <T>(context: Context) => {
  return context.req.json<T>().catch(() => {
    throw new AuthError('Valid JSON body is required', 400)
  })
}

export const adminGroupController = {
  create: async (context: Context) => {
    try {
      const body = await getBody<AdminGroupInput>(context)

      return context.json({ group: await adminGroupService.create(await getAuthenticatedUser(context), body) }, 201)
    } catch (error) {
      return handleError(context, error)
    }
  },

  list: async (context: Context) => {
    try {
      return context.json({ groups: await adminGroupService.list(await getAuthenticatedUser(context)) })
    } catch (error) {
      return handleError(context, error)
    }
  },

  get: async (context: Context) => {
    try {
      return context.json({
        group: await adminGroupService.get(await getAuthenticatedUser(context), context.req.param('id')),
      })
    } catch (error) {
      return handleError(context, error)
    }
  },

  update: async (context: Context) => {
    try {
      const body = await getBody<AdminGroupInput>(context)

      return context.json({
        group: await adminGroupService.update(await getAuthenticatedUser(context), context.req.param('id'), body),
      })
    } catch (error) {
      return handleError(context, error)
    }
  },

  remove: async (context: Context) => {
    try {
      return context.json(await adminGroupService.remove(await getAuthenticatedUser(context), context.req.param('id')))
    } catch (error) {
      return handleError(context, error)
    }
  },
}
