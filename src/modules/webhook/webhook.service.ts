import { env } from '../../config/env'
import { userStore } from '../auth/auth.store'
import { personInfoStore } from '../person-info/person-info.store'

export const webhookService = {
  fireUserWebhook: async (userId: string) => {
    try {
      if (!env.externalWebhookUrl) {
        return
      }

      const user = await userStore.findById(userId)
      if (!user || !user.deviceMacIds || user.deviceMacIds.length === 0) {
        return
      }

      const personInfo = await personInfoStore.getByUserId(userId)
      
      const payload = user.deviceMacIds.map((macId) => ({
        macId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        personInfo,
      }))

      const response = await fetch(env.externalWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        console.error(`Outbound webhook failed with status: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to fire outbound webhook:', error)
    }
  },
}
