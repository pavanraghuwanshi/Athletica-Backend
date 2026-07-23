import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { errorMiddleware } from './middlewares/error.middleware'
import { notFoundMiddleware } from './middlewares/not-found.middleware'
import { registerRoutes } from './routes'


const app = new Hono()

app.use('*', cors({ origin: '*' }))
// Large wearable-data payloads are highly repetitive JSON. Compress them when
// the client advertises support (gzip, Brotli, or zstd) to reduce transfer time.
app.use('*', compress())


registerRoutes(app)

app.notFound(notFoundMiddleware)
app.onError(errorMiddleware)

export default app
