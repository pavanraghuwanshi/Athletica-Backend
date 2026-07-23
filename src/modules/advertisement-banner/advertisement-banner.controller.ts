import type { Context } from 'hono'
import { httpStatus } from '../../shared/http/status-codes'
import { AuthError } from '../auth/auth.service'
import { advertisementBannerService } from './advertisement-banner.service'
import { getAuthenticatedUser } from '../auth/auth.guard'
import type { CreateAdvertisementBannerInput, UpdateAdvertisementBannerInput } from './advertisement-banner.types'

const getJsonBody = async <T>(context: Context) => {
  try {
    return (await context.req.json()) as T
  } catch {
    throw new AuthError('Valid JSON body is required', httpStatus.badRequest)
  }
}

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }
  console.error(error)
  return context.json({ message: 'Internal server error' }, httpStatus.internalServerError)
}

export const advertisementBannerController = {
  listAll: async (context: Context) => {
    try {
      const banners = await advertisementBannerService.listAll()
      return context.json(banners, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  getById: async (context: Context) => {
    try {
      const id = context.req.param('id')
      if (!id) throw new AuthError('ID is required', httpStatus.badRequest)
      const banner = await advertisementBannerService.getById(id)
      return context.json(banner, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  create: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const body = await getJsonBody<CreateAdvertisementBannerInput>(context)
      
      if (!body.imageUrl || typeof body.sequence !== 'number') {
        throw new AuthError('imageUrl and sequence are required', httpStatus.badRequest)
      }

      const banner = await advertisementBannerService.create(viewer, body)
      return context.json(banner, httpStatus.created)
    } catch (error) {
      return handleError(context, error)
    }
  },

  update: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const id = context.req.param('id')
      if (!id) throw new AuthError('ID is required', httpStatus.badRequest)
      const body = await getJsonBody<UpdateAdvertisementBannerInput>(context)
      
      const banner = await advertisementBannerService.update(viewer, id, body)
      return context.json(banner, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  delete: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const id = context.req.param('id')
      if (!id) throw new AuthError('ID is required', httpStatus.badRequest)
      
      const result = await advertisementBannerService.delete(viewer, id)
      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  }
}
