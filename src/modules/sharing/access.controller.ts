import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { accessService } from './access.service'

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

const getRequestId = (context: Context) => {
  const requestId = context.req.param('id')

  if (!requestId) {
    throw new AuthError('Access request id is required', 400)
  }

  return requestId
}

export const accessController = {
  connect: async (context: Context) => {
    try {
      const user = await getAuthenticatedUser(context)
      const body = await getBody<{ email?: string }>(context)
      return context.json(await accessService.connectByEmail(user, body.email), 201)
    } catch (error) {
      return handleError(context, error)
    }
  },

  create: async (context: Context) => {
    try {
      const user = await getAuthenticatedUser(context)
      const body = await getBody<{ email?: string }>(context)
      return context.json({ request: await accessService.requestAccess(user, body.email) }, 201)
    } catch (error) {
      return handleError(context, error)
    }
  },

  accept: async (context: Context) => {
    try {
      return context.json(await accessService.accept(await getAuthenticatedUser(context), getRequestId(context)))
    } catch (error) {
      return handleError(context, error)
    }
  },

  reject: async (context: Context) => {
    try {
      return context.json({ request: await accessService.reject(await getAuthenticatedUser(context), getRequestId(context)) })
    } catch (error) {
      return handleError(context, error)
    }
  },

  verify: async (context: Context) => {
    try {
      const body = await getBody<{ otp?: string }>(context)
      return context.json({ request: await accessService.verifyOtp(await getAuthenticatedUser(context), getRequestId(context), body.otp) })
    } catch (error) {
      return handleError(context, error)
    }
  },

  revoke: async (context: Context) => {
    try {
      return context.json({ request: await accessService.revoke(await getAuthenticatedUser(context), getRequestId(context)) })
    } catch (error) {
      return handleError(context, error)
    }
  },

  sent: async (context: Context) => {
    try {
      return context.json({ requests: await accessService.listSent(await getAuthenticatedUser(context)) })
    } catch (error) {
      return handleError(context, error)
    }
  },

  received: async (context: Context) => {
    try {
      return context.json({ requests: await accessService.listReceived(await getAuthenticatedUser(context)) })
    } catch (error) {
      return handleError(context, error)
    }
  },
}
