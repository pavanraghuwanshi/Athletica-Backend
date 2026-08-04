import { warrantyClaimStore } from './warranty-claim.store'
import type { CreateWarrantyClaimInput, UpdateWarrantyClaimInput } from './warranty-claim.types'
import { AuthError } from '../auth/auth.service'
import type { AuthUserResponse } from '../auth/auth.types'
import * as fs from 'node:fs'
import * as path from 'node:path'

const BILLS_DIR = path.join(process.cwd(), 'public', 'images', 'warranty-bills')

// Ensure directory exists
if (!fs.existsSync(BILLS_DIR)) {
  fs.mkdirSync(BILLS_DIR, { recursive: true })
}

const saveBillFile = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  
  const filePath = path.join(BILLS_DIR, filename)
  await Bun.write(filePath, file)
  
  return `/api/warranty-claims/images/${filename}`
}

export const warrantyClaimService = {
  listAll: async (viewer: AuthUserResponse) => {
    // Regular users can only see their own claims, admins can see all
    const filters = viewer.role === 'admin' || viewer.role === 'superAdmin' ? {} : { userId: viewer.id }
    return warrantyClaimStore.listAll(filters)
  },

  getById: async (viewer: AuthUserResponse, id: string) => {
    const claim = await warrantyClaimStore.findById(id)
    if (!claim) {
      throw new AuthError('Warranty claim not found', 404)
    }

    if (claim.userId !== viewer.id && viewer.role !== 'admin' && viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }

    return claim
  },

  create: async (viewer: AuthUserResponse, input: CreateWarrantyClaimInput) => {
    if (!input.billFile || typeof input.billFile === 'string') {
      throw new AuthError('A valid bill file is required', 400)
    }

    const billUrl = await saveBillFile(input.billFile)
    
    return warrantyClaimStore.create({
      userId: viewer.id,
      billUrl,
      name: input.name,
      invoiceNumber: input.invoiceNumber,
      purchasingDate: input.purchasingDate,
      reason: input.reason
    })
  },

  update: async (viewer: AuthUserResponse, id: string, input: UpdateWarrantyClaimInput) => {
    const claim = await warrantyClaimStore.findById(id)
    if (!claim) {
      throw new AuthError('Warranty claim not found', 404)
    }

    // Only admins or the owner can update. If it's the owner, maybe restrict what they can update.
    // For simplicity, owner can update if status is still pending, admins can update anything.
    if (claim.userId !== viewer.id && viewer.role !== 'admin' && viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }

    const payload: Parameters<typeof warrantyClaimStore.update>[1] = {}

    if (input.billFile && typeof input.billFile !== 'string') {
      payload.billUrl = await saveBillFile(input.billFile)
      // Optionally delete old file here
    }
    
    if (input.name !== undefined) payload.name = input.name
    if (input.invoiceNumber !== undefined) payload.invoiceNumber = input.invoiceNumber
    if (input.purchasingDate !== undefined) payload.purchasingDate = input.purchasingDate
    if (input.reason !== undefined) payload.reason = input.reason
    
    // Only admins can update status
    if (input.status && (viewer.role === 'admin' || viewer.role === 'superAdmin')) {
      payload.status = input.status
    }

    const updatedClaim = await warrantyClaimStore.update(id, payload)
    if (!updatedClaim) {
      throw new AuthError('Warranty claim not found', 404)
    }
    return updatedClaim
  },

  delete: async (viewer: AuthUserResponse, id: string) => {
    const claim = await warrantyClaimStore.findById(id)
    if (!claim) {
      throw new AuthError('Warranty claim not found', 404)
    }
    
    // Only owner or admin can delete
    if (claim.userId !== viewer.id && viewer.role !== 'admin' && viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }
    
    if (claim.billUrl) {
      const filename = claim.billUrl.split('/').pop()
      if (filename) {
        const filePath = path.join(BILLS_DIR, filename)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    }

    await warrantyClaimStore.deleteById(id)
    return { success: true }
  },
}
