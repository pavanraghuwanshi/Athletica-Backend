import { Hono } from 'hono'
import { usersController } from './users.controller'

export const usersRoutes = new Hono()

usersRoutes.get('/', usersController.list)
usersRoutes.get('/:id', usersController.get)
