import type { Context } from 'hono'
import { httpStatus } from '../../shared/http/status-codes'
import { AuthError } from '../auth/auth.service'
import { warrantyClaimService } from './warranty-claim.service'
import { getAuthenticatedUser } from '../auth/auth.guard'
import type { CreateWarrantyClaimInput, UpdateWarrantyClaimInput } from './warranty-claim.types'
import * as fs from 'node:fs'
import * as path from 'node:path'

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

export const warrantyClaimController = {
  listAll: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const pageStr = context.req.query('page')
      const limitStr = context.req.query('limit')
      const page = pageStr ? parseInt(pageStr, 10) : 1
      const limit = limitStr ? parseInt(limitStr, 10) : 20
      
      const claims = await warrantyClaimService.listAll(viewer, page, limit)
      return context.json(claims, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  getById: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const id = context.req.param('id')
      if (!id) throw new AuthError('ID is required', httpStatus.badRequest)
      const claim = await warrantyClaimService.getById(viewer, id)
      return context.json(claim, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  create: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const body = await getFormData(context)
      
      const billFile = body['bill']
      
      if (!billFile) {
        throw new AuthError('bill is required', httpStatus.badRequest)
      }

      const input: CreateWarrantyClaimInput = {
        billFile: billFile as File,
        name: typeof body['name'] === 'string' ? body['name'] : undefined,
        invoiceNumber: typeof body['invoiceNumber'] === 'string' ? body['invoiceNumber'] : undefined,
        purchasingDate: typeof body['purchasingDate'] === 'string' && body['purchasingDate'] ? new Date(body['purchasingDate']) : undefined,
        reason: typeof body['reason'] === 'string' ? body['reason'] : undefined
      }

      const claim = await warrantyClaimService.create(viewer, input)
      return context.json(claim, httpStatus.created)
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
      
      const input: UpdateWarrantyClaimInput = {}
      
      if (body['bill']) input.billFile = body['bill'] as File
      if (typeof body['name'] === 'string') input.name = body['name']
      if (typeof body['invoiceNumber'] === 'string') input.invoiceNumber = body['invoiceNumber']
      if (typeof body['purchasingDate'] === 'string' && body['purchasingDate']) input.purchasingDate = new Date(body['purchasingDate'])
      if (typeof body['reason'] === 'string') input.reason = body['reason']
      if (typeof body['status'] === 'string') input.status = body['status'] as any
      
      const claim = await warrantyClaimService.update(viewer, id, input)
      return context.json(claim, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  delete: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      const id = context.req.param('id')
      if (!id) throw new AuthError('ID is required', httpStatus.badRequest)
      
      const result = await warrantyClaimService.delete(viewer, id)
      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleError(context, error)
    }
  },

  getBillImage: async (context: Context) => {
    try {
      const filename = context.req.param('filename')
      if (!filename) {
        return context.json({ message: 'Filename is required' }, httpStatus.badRequest)
      }

      const imagePath = path.join(process.cwd(), 'public', 'images', 'warranty-bills', filename)
      
      if (!imagePath.startsWith(path.join(process.cwd(), 'public', 'images', 'warranty-bills'))) {
        return context.json({ message: 'Forbidden' }, httpStatus.forbidden)
      }

      if (!fs.existsSync(imagePath)) {
        return context.json({ message: 'Image not found' }, httpStatus.notFound)
      }

      const ext = path.extname(filename).toLowerCase()
      const mimeType = ext === '.png' ? 'image/png' 
                     : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                     : ext === '.webp' ? 'image/webp'
                     : ext === '.gif' ? 'image/gif'
                     : ext === '.pdf' ? 'application/pdf'
                     : 'image/jpeg'

      context.res.headers.set('Content-Type', mimeType)
      
      return context.body(Bun.file(imagePath).stream(), 200)
    } catch (error) {
      console.error('Error serving bill image:', error)
      return context.json({ message: 'Internal server error' }, httpStatus.internalServerError)
    }
  }
}
