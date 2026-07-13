export type AuthProvider = 'email' | 'google' | 'apple'
export type UserRole = 'user' | 'superAdmin'

export type User = {
  id: string
  name: string
  email: string
  passwordHash?: string
  googleId?: string
  appleId?: string
  providers: AuthProvider[]
  role: UserRole
  createdAt: string
  updatedAt: string
}

export type RegisterInput = {
  name?: string
  email?: string
  password?: string
}

export type LoginInput = {
  email?: string
  password?: string
}

export type GoogleAuthInput = {
  idToken?: string
}

export type AppleAuthInput = {
  identityToken?: string
  name?: string
}

export type GoogleTokenResponse = {
  id_token?: string
  error?: string
  error_description?: string
}

export type AuthUserResponse = {
  id: string
  name: string
  email: string
  providers: AuthProvider[]
  role: UserRole
  createdAt: string
  updatedAt: string
}
