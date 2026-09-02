import { Hono } from 'hono'
import { shopifyController } from './shopify.controller'

const shopifyRouter = new Hono()

// Webhook endpoint for Shopify
shopifyRouter.post('/webhook', shopifyController.handleWebhook)

export { shopifyRouter }
