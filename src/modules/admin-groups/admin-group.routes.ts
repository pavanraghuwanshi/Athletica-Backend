import { Hono } from 'hono'
import { adminGroupController } from './admin-group.controller'

export const adminGroupRoutes = new Hono()

adminGroupRoutes.post('/', adminGroupController.create)
adminGroupRoutes.get('/', adminGroupController.list)
adminGroupRoutes.get('/:id', adminGroupController.get)
adminGroupRoutes.patch('/:id', adminGroupController.update)
adminGroupRoutes.delete('/:id', adminGroupController.remove)
