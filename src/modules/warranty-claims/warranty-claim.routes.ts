import { Hono } from 'hono'
import { warrantyClaimController } from './warranty-claim.controller'

export const warrantyClaimRoutes = new Hono()

warrantyClaimRoutes.get('/', warrantyClaimController.listAll)
warrantyClaimRoutes.get('/:id', warrantyClaimController.getById)
warrantyClaimRoutes.post('/', warrantyClaimController.create)
warrantyClaimRoutes.put('/:id', warrantyClaimController.update)
warrantyClaimRoutes.delete('/:id', warrantyClaimController.delete)
warrantyClaimRoutes.get('/images/:filename', warrantyClaimController.getBillImage)
