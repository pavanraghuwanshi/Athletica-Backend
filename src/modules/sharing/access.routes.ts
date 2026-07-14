import { Hono } from 'hono'
import { accessController } from './access.controller'

export const accessRoutes = new Hono()

accessRoutes.post('/connect', accessController.connect)
accessRoutes.post('/requests', accessController.create)
accessRoutes.get('/requests/sent', accessController.sent)
accessRoutes.get('/requests/received', accessController.received)
accessRoutes.post('/requests/:id/accept', accessController.accept)
accessRoutes.post('/requests/:id/reject', accessController.reject)
accessRoutes.post('/requests/:id/verify-otp', accessController.verify)
accessRoutes.post('/requests/:id/revoke', accessController.revoke)
