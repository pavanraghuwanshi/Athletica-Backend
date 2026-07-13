import type { Context } from 'hono'
import { httpStatus } from '../../shared/http/status-codes'
import { AuthError, authService } from './auth.service'

export const getBearerToken = (context: Context) => {
  const authorizationHeader = context.req.header('Authorization') ?? ''
  const [scheme, token] = authorizationHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw new AuthError('Bearer token is required', httpStatus.unauthorized)
  }

  return token
}

export const getAuthenticatedUser = async (context: Context) => {
  return authService.getUserFromToken(getBearerToken(context))
}
