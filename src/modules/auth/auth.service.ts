import { sign, verify } from 'hono/jwt'
import { env } from '../../config/env'
import type {
  AppleAuthInput,
  AuthProvider,
  AuthUserResponse,
  GoogleAuthInput,
  GoogleTokenResponse,
  LoginInput,
  RegisterInput,
  User,
} from './auth.types'
import { userStore } from './auth.store'

const tokenExpiresInSeconds = 60 * 60 * 24 * 7

type AuthErrorStatusCode = 400 | 401 | 403 | 404 | 409

type GoogleTokenInfo = {
  aud?: string
  sub?: string
  email?: string
  email_verified?: string
  name?: string
  given_name?: string
}

type AppleJwtHeader = {
  alg?: string
  kid?: string
}

type AppleJwtPayload = {
  iss?: string
  aud?: string
  exp?: number
  sub?: string
  email?: string
  email_verified?: boolean | string
}

type AppleJwk = JsonWebKey & {
  kid?: string
  alg?: string
}

type AppleJwksResponse = {
  keys?: AppleJwk[]
}

let appleJwksCache:
  | {
      expiresAt: number
      keys: AppleJwk[]
    }
  | undefined

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: AuthErrorStatusCode,
  ) {
    super(message)
  }
}

const normalizeEmail = (email?: string) => {
  return email?.trim().toLowerCase() ?? ''
}

const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const toUserResponse = (user: User): AuthUserResponse => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    providers: user.providers,
    role: user.role ?? 'user',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

const createToken = async (user: User) => {
  const now = Math.floor(Date.now() / 1000)

  return sign(
    {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + tokenExpiresInSeconds,
    },
    env.jwtSecret,
  )
}

const addProvider = (providers: AuthProvider[], provider: AuthProvider) => {
  return providers.includes(provider) ? providers : [...providers, provider]
}

const createAuthResponse = async (user: User) => {
  return {
    user: toUserResponse(user),
    token: await createToken(user),
  }
}

const getGoogleRedirectUri = () => {
  if (!env.googleRedirectUri) {
    throw new AuthError('Google redirect URI is not configured', 400)
  }

  return env.googleRedirectUri
}

const ensureGoogleOAuthConfig = () => {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new AuthError('Google sign-in is not configured', 400)
  }
}

const buildGoogleAuthorizationUrl = (state?: string) => {
  ensureGoogleOAuthConfig()

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizationUrl.searchParams.set('client_id', env.googleClientId)
  authorizationUrl.searchParams.set('redirect_uri', getGoogleRedirectUri())
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('scope', 'openid email profile')
  authorizationUrl.searchParams.set('prompt', 'select_account')

  if (state?.trim()) {
    authorizationUrl.searchParams.set('state', state.trim())
  }

  return authorizationUrl.toString()
}

const exchangeGoogleCodeForIdToken = async (code?: string) => {
  const authorizationCode = code?.trim()

  if (!authorizationCode) {
    throw new AuthError('Google authorization code is required', 400)
  }

  ensureGoogleOAuthConfig()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: authorizationCode,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  const tokenResponse = (await response.json()) as GoogleTokenResponse

  if (!response.ok || !tokenResponse.id_token) {
    throw new AuthError(
      tokenResponse.error_description || tokenResponse.error || 'Google authorization failed',
      401,
    )
  }

  return tokenResponse.id_token
}

const verifyGoogleIdToken = async (idToken?: string) => {
  const token = idToken?.trim()

  if (!token) {
    throw new AuthError('Google ID token is required', 400)
  }

  if (!env.googleClientIds.length) {
    throw new AuthError('Google sign-in is not configured', 400)
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
  )

  if (!response.ok) {
    throw new AuthError('Invalid Google ID token', 401)
  }

  const tokenInfo = (await response.json()) as GoogleTokenInfo
  const email = normalizeEmail(tokenInfo.email)

  if (!tokenInfo.aud || !env.googleClientIds.includes(tokenInfo.aud)) {
    throw new AuthError('Google token audience is invalid', 401)
  }

  if (tokenInfo.email_verified !== 'true') {
    throw new AuthError('Google email is not verified', 401)
  }

  if (!tokenInfo.sub || !validateEmail(email)) {
    throw new AuthError('Google token profile is invalid', 401)
  }

  return {
    email,
    googleId: tokenInfo.sub,
    name: tokenInfo.name?.trim() || tokenInfo.given_name?.trim() || email.split('@')[0],
  }
}

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(paddedBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

const getRoleForEmail = (email: string) => {
  return env.superAdminEmail && email === env.superAdminEmail ? 'superAdmin' : 'user'
}

const decodeJwtPart = <T>(value: string) => {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T
  } catch {
    throw new AuthError('Invalid Apple identity token', 401)
  }
}

const getAppleJwks = async () => {
  const now = Date.now()

  if (appleJwksCache && appleJwksCache.expiresAt > now) {
    return appleJwksCache.keys
  }

  const response = await fetch('https://appleid.apple.com/auth/keys')

  if (!response.ok) {
    throw new AuthError('Apple sign-in verification is unavailable', 401)
  }

  const jwks = (await response.json()) as AppleJwksResponse

  if (!jwks.keys?.length) {
    throw new AuthError('Apple sign-in verification is unavailable', 401)
  }

  appleJwksCache = {
    expiresAt: now + 60 * 60 * 1000,
    keys: jwks.keys,
  }

  return jwks.keys
}

const verifyAppleIdentityToken = async (identityToken?: string) => {
  const token = identityToken?.trim()

  if (!token) {
    throw new AuthError('Apple identity token is required', 400)
  }

  if (!env.appleClientIds.length) {
    throw new AuthError('Apple sign-in is not configured', 400)
  }

  const tokenParts = token.split('.')

  if (tokenParts.length !== 3) {
    throw new AuthError('Invalid Apple identity token', 401)
  }

  const [encodedHeader, encodedPayload, encodedSignature] = tokenParts
  const header = decodeJwtPart<AppleJwtHeader>(encodedHeader)
  const payload = decodeJwtPart<AppleJwtPayload>(encodedPayload)

  if (header.alg !== 'RS256' || !header.kid) {
    throw new AuthError('Invalid Apple identity token', 401)
  }

  const keys = await getAppleJwks()
  const key = keys.find((appleKey) => appleKey.kid === header.kid && appleKey.alg === 'RS256')

  if (!key) {
    throw new AuthError('Invalid Apple identity token', 401)
  }

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    key,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  )
  const isSignatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!isSignatureValid) {
    throw new AuthError('Invalid Apple identity token', 401)
  }

  if (payload.iss !== 'https://appleid.apple.com') {
    throw new AuthError('Apple token issuer is invalid', 401)
  }

  if (!payload.aud || !env.appleClientIds.includes(payload.aud)) {
    throw new AuthError('Apple token audience is invalid', 401)
  }

  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AuthError('Apple identity token is expired', 401)
  }

  const email = normalizeEmail(payload.email)
  const isEmailVerified = payload.email_verified === true || payload.email_verified === 'true'

  if (!payload.sub) {
    throw new AuthError('Apple token profile is invalid', 401)
  }

  return {
    appleId: payload.sub,
    email: validateEmail(email) && isEmailVerified ? email : '',
  }
}

export const authService = {
  getGoogleAuthorizationUrl: (state?: string) => {
    return buildGoogleAuthorizationUrl(state)
  },

  googleCallback: async (code?: string) => {
    const idToken = await exchangeGoogleCodeForIdToken(code)

    return authService.googleAuth({ idToken })
  },

  register: async (input: RegisterInput) => {
    const email = normalizeEmail(input.email)
    const password = input.password?.trim() ?? ''
    const name = input.name?.trim() || email.split('@')[0]

    if (!validateEmail(email)) {
      throw new AuthError('Valid email is required', 400)
    }

    if (password.length < 6) {
      throw new AuthError('Password must be at least 6 characters', 400)
    }

    const existingUser = await userStore.findByEmail(email)
    const passwordHash = await Bun.password.hash(password)
    const now = new Date().toISOString()

    if (existingUser) {
      if (existingUser.passwordHash) {
        throw new AuthError('User already registered with email password', 409)
      }

      existingUser.name = name
      existingUser.passwordHash = passwordHash
      existingUser.providers = addProvider(existingUser.providers, 'email')
      existingUser.updatedAt = now
      existingUser.role = getRoleForEmail(email)

      return createAuthResponse(await userStore.save(existingUser))
    }

    const user = await userStore.save({
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash,
      providers: ['email'],
      role: getRoleForEmail(email),
      createdAt: now,
      updatedAt: now,
    })

    return createAuthResponse(user)
  },

  login: async (input: LoginInput) => {
    const email = normalizeEmail(input.email)
    const password = input.password ?? ''

    if (!validateEmail(email) || !password) {
      throw new AuthError('Email and password are required', 400)
    }

    const user = await userStore.findByEmail(email)

    if (!user?.passwordHash) {
      throw new AuthError('Invalid email or password', 401)
    }

    const isPasswordValid = await Bun.password.verify(password, user.passwordHash)

    if (!isPasswordValid) {
      throw new AuthError('Invalid email or password', 401)
    }

    const configuredRole = getRoleForEmail(email)

    if (user.role !== configuredRole) {
      user.role = configuredRole
      user.updatedAt = new Date().toISOString()

      return createAuthResponse(await userStore.save(user))
    }

    return createAuthResponse(user)
  },

  googleAuth: async (input: GoogleAuthInput) => {
    const { email, googleId, name } = await verifyGoogleIdToken(input.idToken)

    const existingUser = await userStore.findByEmail(email)
    const now = new Date().toISOString()

    if (existingUser) {
      existingUser.name = name
      existingUser.googleId = googleId
      existingUser.providers = addProvider(existingUser.providers, 'google')
      existingUser.updatedAt = now
      existingUser.role = getRoleForEmail(email)

      return createAuthResponse(await userStore.save(existingUser))
    }

    const user = await userStore.save({
      id: crypto.randomUUID(),
      name,
      email,
      googleId,
      providers: ['google'],
      role: getRoleForEmail(email),
      createdAt: now,
      updatedAt: now,
    })

    return createAuthResponse(user)
  },

  appleAuth: async (input: AppleAuthInput) => {
    const { appleId, email } = await verifyAppleIdentityToken(input.identityToken)
    const name = input.name?.trim()
    const existingAppleUser = await userStore.findByAppleId(appleId)
    const now = new Date().toISOString()

    if (existingAppleUser) {
      existingAppleUser.name = name || existingAppleUser.name
      existingAppleUser.appleId = appleId
      existingAppleUser.providers = addProvider(existingAppleUser.providers, 'apple')
      existingAppleUser.updatedAt = now
      existingAppleUser.role = getRoleForEmail(existingAppleUser.email)

      return createAuthResponse(await userStore.save(existingAppleUser))
    }

    if (!email) {
      throw new AuthError('Apple email is required for first sign-in', 400)
    }

    const existingEmailUser = await userStore.findByEmail(email)

    if (existingEmailUser) {
      existingEmailUser.name = name || existingEmailUser.name
      existingEmailUser.appleId = appleId
      existingEmailUser.providers = addProvider(existingEmailUser.providers, 'apple')
      existingEmailUser.updatedAt = now
      existingEmailUser.role = getRoleForEmail(email)

      return createAuthResponse(await userStore.save(existingEmailUser))
    }

    const user = await userStore.save({
      id: crypto.randomUUID(),
      name: name || email.split('@')[0],
      email,
      appleId,
      providers: ['apple'],
      role: getRoleForEmail(email),
      createdAt: now,
      updatedAt: now,
    })

    return createAuthResponse(user)
  },

  getUserFromToken: async (token: string) => {
    try {
      const payload = await verify(token, env.jwtSecret, 'HS256')
      const userId = payload.sub

      if (typeof userId !== 'string') {
        throw new AuthError('Invalid token', 401)
      }

      const user = await userStore.findById(userId)

      if (!user) {
        throw new AuthError('User not found', 404)
      }

      return toUserResponse(user)
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }

      throw new AuthError('Invalid token', 401)
    }
  },
}
