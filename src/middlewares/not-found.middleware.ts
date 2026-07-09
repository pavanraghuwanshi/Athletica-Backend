import type { NotFoundHandler } from 'hono'

export const notFoundMiddleware: NotFoundHandler = (context) => {
  return context.json(
    {
      message: 'Route not found',
    },
    404,
  )
}
