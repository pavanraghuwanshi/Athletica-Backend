import type { Context } from 'hono'
import { getHealthMessage } from './health.service'

export const healthController = {
  index: (context: Context) => {
    return context.text(getHealthMessage())
  },
}
