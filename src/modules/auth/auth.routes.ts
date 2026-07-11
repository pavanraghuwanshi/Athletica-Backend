import { Hono } from 'hono'
import { authController } from './auth.controller'

export const authRoutes = new Hono()

authRoutes.post('/register', authController.register)
authRoutes.post('/login', authController.login)
authRoutes.get('/google', authController.googleStart)
authRoutes.get('/google/callback', authController.googleCallback)
authRoutes.post('/apple', authController.appleAuth)
