import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { errorMiddleware } from './middlewares/error.middleware'
import { notFoundMiddleware } from './middlewares/not-found.middleware'
import { registerRoutes } from './routes'

const app = new Hono()

app.use('*', cors({ origin: '*' }))

registerRoutes(app)

app.notFound(notFoundMiddleware)
app.onError(errorMiddleware)

export default app
