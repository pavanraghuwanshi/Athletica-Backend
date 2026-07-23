import { advertisementBannerStore } from './advertisement-banner.store'
import type { CreateAdvertisementBannerInput, UpdateAdvertisementBannerInput } from './advertisement-banner.types'
import { AuthError } from '../auth/auth.service'
import type { AuthUserResponse } from '../auth/auth.types'
import * as fs from 'node:fs'
import * as path from 'node:path'

const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'banners')
const VIDEOS_DIR = path.join(process.cwd(), 'public', 'videos', 'banners')

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true })
}
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true })
}

const saveFile = async (file: File, contentType: 'image' | 'video'): Promise<string> => {
  const ext = file.name.split('.').pop() || 'bin'
  const filename = `${crypto.randomUUID()}.${ext}`
  
  if (contentType === 'image') {
    const filePath = path.join(IMAGES_DIR, filename)
    await Bun.write(filePath, file)
    return `/api/images/banners/${filename}`
  } else {
    const filePath = path.join(VIDEOS_DIR, filename)
    await Bun.write(filePath, file)
    return `/api/videos/banners/${filename}`
  }
}

export const advertisementBannerService = {
  listAll: async () => {
    return advertisementBannerStore.listAll()
  },

  getById: async (id: string) => {
    const banner = await advertisementBannerStore.findById(id)
    if (!banner) {
      throw new AuthError('Advertisement banner not found', 404)
    }
    return banner
  },

  create: async (viewer: AuthUserResponse, input: CreateAdvertisementBannerInput) => {
    if (viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }

    if (!input.file || typeof input.file === 'string') {
      throw new AuthError('A valid file is required', 400)
    }

    if (!input.contentType) {
      throw new AuthError('Content type is required (image or video)', 400)
    }

    if (input.sequence === undefined) {
      throw new AuthError('Sequence is required', 400)
    }

    const fileUrl = await saveFile(input.file, input.contentType)
    const id = crypto.randomUUID()
    
    return advertisementBannerStore.create(id, {
      fileUrl,
      contentType: input.contentType,
      sequence: input.sequence,
      redirectUrl: input.redirectUrl,
    })
  },

  update: async (viewer: AuthUserResponse, id: string, input: UpdateAdvertisementBannerInput) => {
    if (viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }

    const banner = await advertisementBannerStore.findById(id)
    if (!banner) {
      throw new AuthError('Advertisement banner not found', 404)
    }

    const payload: Partial<Parameters<typeof advertisementBannerStore.update>[1]> = {}

    if (input.file && typeof input.file !== 'string') {
      const contentTypeToSave = input.contentType || banner.contentType
      payload.fileUrl = await saveFile(input.file, contentTypeToSave)
    }
    
    if (input.contentType) payload.contentType = input.contentType
    if (input.sequence !== undefined) payload.sequence = input.sequence
    if (input.redirectUrl !== undefined) payload.redirectUrl = input.redirectUrl

    const updatedBanner = await advertisementBannerStore.update(id, payload)
    if (!updatedBanner) {
      throw new AuthError('Advertisement banner not found', 404)
    }
    return updatedBanner
  },

  delete: async (viewer: AuthUserResponse, id: string) => {
    if (viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }
    
    const banner = await advertisementBannerStore.findById(id)
    if (!banner) {
      throw new AuthError('Advertisement banner not found', 404)
    }
    
    // Optionally delete the file here if desired
    if (banner.fileUrl) {
      const filePath = path.join(process.cwd(), 'public', banner.fileUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await advertisementBannerStore.deleteById(id)
    return { success: true }
  },
}
