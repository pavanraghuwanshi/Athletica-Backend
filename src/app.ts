import { Hono } from 'hono'
import { errorMiddleware } from './middlewares/error.middleware'
import { notFoundMiddleware } from './middlewares/not-found.middleware'
import { registerRoutes } from './routes'

const app = new Hono()

registerRoutes(app)

app.notFound(notFoundMiddleware)
app.onError(errorMiddleware)

export default app
