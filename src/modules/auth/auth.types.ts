export type AuthProvider = 'email' | 'google'

export type User = {
  id: string
  name: string
  email: string
  passwordHash?: string
  googleId?: string
  providers: AuthProvider[]
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
  createdAt: string
  updatedAt: string
}
