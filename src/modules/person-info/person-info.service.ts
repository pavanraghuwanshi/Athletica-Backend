import { AuthError } from '../auth/auth.service'
import type { AuthUserResponse } from '../auth/auth.types'
import { personInfoStore } from './person-info.store'
import type { SavePersonInfoInput } from './person-info.types'

export const personInfoService = {
  get: async (viewer: AuthUserResponse) => {
    const info = await personInfoStore.getByUserId(viewer.id)
    if (!info) {
      throw new AuthError('Person info not found', 404)
    }
    return info
  },

  save: async (viewer: AuthUserResponse, input: SavePersonInfoInput) => {
    if (!input.name || !input.gender || input.height == null || input.weight == null || input.age == null) {
      throw new Error('All fields (name, gender, height, weight, age) are required')
    }
    return await personInfoStore.save(viewer.id, input)
  },

  delete: async (viewer: AuthUserResponse) => {
    await personInfoStore.deleteByUserId(viewer.id)
  }
}
