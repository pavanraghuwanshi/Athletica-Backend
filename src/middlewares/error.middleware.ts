import type { ErrorHandler } from 'hono'

export const errorMiddleware: ErrorHandler = (error, context) => {
  console.error(error)

  return context.json(
    {
      message: 'Internal Server Error',
    },
    500,
  )
}
