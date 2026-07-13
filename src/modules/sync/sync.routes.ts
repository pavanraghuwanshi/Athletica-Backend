import { Hono } from 'hono'
import { syncController } from './sync.controller'

export const syncRoutes = new Hono()

syncRoutes.post('/', syncController.upload)
