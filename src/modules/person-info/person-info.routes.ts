import { Hono } from 'hono'
import { personInfoController } from './person-info.controller'

export const personInfoRoutes = new Hono()

personInfoRoutes.get('/', personInfoController.get)
personInfoRoutes.post('/', personInfoController.save)
personInfoRoutes.put('/', personInfoController.save)
personInfoRoutes.delete('/', personInfoController.delete)
