import type { Context } from 'hono'
import { env } from '../../config/env'
import { httpStatus } from '../../shared/http/status-codes'
import { AuthError, authService } from './auth.service'
import type { AppleAuthInput, GoogleAuthInput, LoginInput, RegisterInput } from './auth.types'
import { getBearerToken } from './auth.guard'
import { personInfoStore } from '../person-info/person-info.store'

const getJsonBody = async <T>(context: Context) => {
  try {
    return (await context.req.json()) as T
  } catch {
    throw new AuthError('Valid JSON body is required', httpStatus.badRequest)
  }
}

const handleAuthError = (context: Context, error: unknown) => {
  if (error instanceof AuthError) {
    return context.json({ message: error.message }, error.statusCode)
  }

  throw error
}

export const authController = {
  googleStart: async (context: Context) => {
    try {
      const state = context.req.query('state')
      const authorizationUrl = authService.getGoogleAuthorizationUrl(state)

      return context.redirect(authorizationUrl)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  googleCallback: async (context: Context) => {
    try {
      const error = context.req.query('error')

      if (error) {
        throw new AuthError(`Google sign-in failed: ${error}`, httpStatus.unauthorized)
      }

      const result = await authService.googleCallback(context.req.query('code'))

      if (env.frontendAuthRedirectUrl) {
        const redirectUrl = new URL(env.frontendAuthRedirectUrl)
        redirectUrl.searchParams.set('token', result.token)

        return context.redirect(redirectUrl.toString())
      }

      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  register: async (context: Context) => {
    try {
      const body = await getJsonBody<RegisterInput>(context)
      const result = await authService.register(body)

      return context.json(result, httpStatus.created)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  login: async (context: Context) => {
    try {
      const body = await getJsonBody<LoginInput>(context)
      const result = await authService.login(body)

      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  googleAuth: async (context: Context) => {
    try {
      const body = await getJsonBody<GoogleAuthInput>(context)
      const result = await authService.googleAuth(body)

      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  appleAuth: async (context: Context) => {
    try {
      const body = await getJsonBody<AppleAuthInput>(context)
      const result = await authService.appleAuth(body)

      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  me: async (context: Context) => {
    try {
      const user = await authService.getUserFromToken(getBearerToken(context))
      const personInfo = await personInfoStore.getByUserId(user.id)

      return context.json({ user, personInfo }, httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  logout: async (context: Context) => {
    try {
      return context.json(await authService.logout(getBearerToken(context)), httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },

  deleteAccount: async (context: Context) => {
    try {
      const body = await getJsonBody<{ confirmation?: string }>(context)
      const result = await authService.deleteAccount(
        getBearerToken(context),
        body.confirmation,
      )

      return context.json(result, httpStatus.ok)
    } catch (error) {
      return handleAuthError(context, error)
    }
  },
}
