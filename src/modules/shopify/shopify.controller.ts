import { Context } from 'hono'
import { shopifyService } from './shopify.service'

export const shopifyController = {
  handleWebhook: async (c: Context) => {
    try {
      // In a real production app, verify Shopify webhook HMAC signature here
      // const hmac = c.req.header('X-Shopify-Hmac-Sha256')
      // verifyWebhook(hmac, rawBody)
      
      const payload = await c.req.json()
      const topic = c.req.header('X-Shopify-Topic')

      console.log('--- RECEIVED SHOPIFY WEBHOOK ---')
      console.log('Topic:', topic)
      console.log('Payload:', JSON.stringify(payload, null, 2))
      console.log('--------------------------------')

      if (topic === 'orders/create') {
        await shopifyService.handleOrderCreated(payload)
      }

      return c.json({ message: 'Webhook received' }, 200)
    } catch (error) {
      console.error('Error handling Shopify webhook:', error)
      return c.json({ message: 'Error handling webhook' }, 500)
    }
  }
}
