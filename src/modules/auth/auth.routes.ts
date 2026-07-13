import { Hono } from 'hono'
import { authController } from './auth.controller'

export const authRoutes = new Hono()

authRoutes.post('/register', authController.register)
authRoutes.post('/login', authController.login)
authRoutes.get('/register', authController.googleStart)
authRoutes.get('/google', authController.googleStart)
authRoutes.get('/google/start', authController.googleStart)
authRoutes.get('/google/callback', authController.googleCallback)
authRoutes.post('/google', authController.googleAuth)
authRoutes.post('/apple', authController.appleAuth)
authRoutes.get('/me', authController.me)
authRoutes.post('/logout', authController.logout)
authRoutes.delete('/account', authController.deleteAccount)
