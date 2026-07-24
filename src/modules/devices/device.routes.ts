import { Hono } from 'hono'
import { deviceController } from './device.controller'

export const deviceRoutes = new Hono()

deviceRoutes.post('/bulk-upload', deviceController.bulkUpload)
deviceRoutes.post('/activate', deviceController.activate)
