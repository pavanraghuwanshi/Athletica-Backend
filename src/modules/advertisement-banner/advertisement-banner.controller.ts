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

const getFormData = async (context: Context) => {
  try {
    return await context.req.parseBody()
  } catch {
    throw new AuthError('Valid multipart/form-data body is required', httpStatus.badRequest)
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
      const body = await getFormData(context)
      
      const file = body['file']
      const contentType = body['contentType'] as 'image' | 'video' | undefined
      const sequenceStr = body['sequence']
      const sequence = typeof sequenceStr === 'string' ? parseInt(sequenceStr, 10) : undefined
      const redirectUrl = typeof body['redirectUrl'] === 'string' ? body['redirectUrl'] : undefined
      
      if (!file || typeof sequence !== 'number' || isNaN(sequence) || !contentType) {
        throw new AuthError('file, contentType, and sequence are required', httpStatus.badRequest)
      }

      const input: CreateAdvertisementBannerInput = {
        file: file as File,
        contentType,
        sequence,
        redirectUrl
      }

      const banner = await advertisementBannerService.create(viewer, input)
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
      const body = await getFormData(context)
      
      const file = body['file']
      const contentType = body['contentType'] as 'image' | 'video' | undefined
      const sequenceStr = body['sequence']
      const sequence = typeof sequenceStr === 'string' ? parseInt(sequenceStr, 10) : undefined
      const redirectUrl = typeof body['redirectUrl'] === 'string' ? body['redirectUrl'] : undefined

      const input: UpdateAdvertisementBannerInput = {}
      if (file) input.file = file as File
      if (contentType) input.contentType = contentType
      if (sequence !== undefined && !isNaN(sequence)) input.sequence = sequence
      if (redirectUrl !== undefined) input.redirectUrl = redirectUrl
      
      const banner = await advertisementBannerService.update(viewer, id, input)
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
