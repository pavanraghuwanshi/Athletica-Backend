import type { Context } from 'hono'
import { getAuthenticatedUser } from '../auth/auth.guard'
import { AuthError } from '../auth/auth.service'
import { systemSettingsStore } from './system-settings.store'

const handleError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }
  return context.json({ message: 'Internal Server Error' }, 500)
}

export const systemSettingsController = {
  getReferralSettings: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      if (viewer.role !== 'superAdmin') {
        throw new AuthError('Only super admin can read system settings', 403)
      }
      const settings = await systemSettingsStore.getReferralSettings()
      return context.json(settings)
    } catch (error) {
      return handleError(context, error)
    }
  },

  updateReferralSettings: async (context: Context) => {
    try {
      const viewer = await getAuthenticatedUser(context)
      if (viewer.role !== 'superAdmin') {
        throw new AuthError('Only super admin can update system settings', 403)
      }

      const body = await context.req.json()
      const updateData: any = {}

      if (typeof body.signupBonus === 'number') {
        updateData.signupBonus = body.signupBonus
      }
      if (typeof body.referralReward === 'number') {
        updateData.referralReward = body.referralReward
      }
      if (typeof body.discountPercentage === 'number') {
        updateData.discountPercentage = body.discountPercentage
      }

      const updatedSettings = await systemSettingsStore.updateReferralSettings(updateData)
      return context.json(updatedSettings)
    } catch (error) {
      return handleError(context, error)
    }
  }
}
