import { advertisementBannerStore } from './advertisement-banner.store'
import type { CreateAdvertisementBannerInput, UpdateAdvertisementBannerInput } from './advertisement-banner.types'
import { AuthError } from '../auth/auth.service'
import type { AuthUserResponse } from '../auth/auth.types'

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
    
    // In actual implementation crypto is needed, let's use global crypto
    const id = crypto.randomUUID()
    return advertisementBannerStore.create(id, input)
  },

  update: async (viewer: AuthUserResponse, id: string, input: UpdateAdvertisementBannerInput) => {
    if (viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }
    
    const banner = await advertisementBannerStore.update(id, input)
    if (!banner) {
      throw new AuthError('Advertisement banner not found', 404)
    }
    return banner
  },

  delete: async (viewer: AuthUserResponse, id: string) => {
    if (viewer.role !== 'superAdmin') {
      throw new AuthError('Forbidden', 403)
    }
    
    const banner = await advertisementBannerStore.findById(id)
    if (!banner) {
      throw new AuthError('Advertisement banner not found', 404)
    }
    
    await advertisementBannerStore.deleteById(id)
    return { success: true }
  },
}
