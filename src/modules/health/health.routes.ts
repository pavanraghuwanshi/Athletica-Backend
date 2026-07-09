import { Hono } from 'hono'
import { healthController } from './health.controller'

export const healthRoutes = new Hono()

healthRoutes.get('/', healthController.index)
