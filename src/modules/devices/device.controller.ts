import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { DeviceError, deviceService } from './device.service'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof DeviceError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  // Also catch AuthError if needed
  if (error instanceof Error && 'statusCode' in error) {
    const statusCode = (error as any).statusCode;
    if (typeof statusCode === 'number') {
      return context.json({ message: error.message }, statusCode as any)
    }
  }

  throw error
}

export const deviceController = {
  bulkUpload: async (context: Context) => {
    try {
      // For simplicity, we expect a JSON array of MAC IDs: ['MAC1', 'MAC2']
      // If we want admin protection, we can add `requireAdmin` logic later, 
      // but for now we'll just check if the user is authenticated if it's in the route.
      const user = await getAuthenticatedUser(context)
      if (user.role !== 'admin' && user.role !== 'superAdmin') {
        throw new DeviceError('Forbidden: Admin access required', 403)
      }

      const body = await context.req.json()
      
      return context.json(await deviceService.bulkUpload(body.macIds || body))
    } catch (error) {
      return handleError(context, error)
    }
  },

  activate: async (context: Context) => {
    try {
      const user = await getAuthenticatedUser(context)
      const body = await context.req.json()
      
      return context.json(await deviceService.activateDevice(body.macId, user.id))
    } catch (error) {
      return handleError(context, error)
    }
  },
}
