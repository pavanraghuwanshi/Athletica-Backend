import type { Hono } from 'hono'
import { authRoutes } from '../modules/auth/auth.routes'
import { healthRoutes } from '../modules/health/health.routes'

export const registerRoutes = (app: Hono) => {
  app.route('/', healthRoutes)
  app.route('/auth', authRoutes)
}
