export const env = {
  nodeEnv: Bun.env.NODE_ENV ?? 'development',
  port: Number(Bun.env.PORT ?? 3000),
  jwtSecret: Bun.env.JWT_SECRET ?? 'change-this-secret',
  mongoUri: Bun.env.MONGODB_URI ?? '',
  mongoDbName: Bun.env.MONGODB_DB_NAME ?? 'AtheleticaDB',
  googleClientId: Bun.env.GOOGLE_CLIENT_ID ?? '',
  googleClientIds: (Bun.env.GOOGLE_CLIENT_IDS ?? Bun.env.GOOGLE_CLIENT_ID ?? '')
    .split(',')
    .map((clientId) => clientId.trim())
    .filter(Boolean),
  googleClientSecret: Bun.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri: Bun.env.GOOGLE_REDIRECT_URI ?? '',
  frontendAuthRedirectUrl: Bun.env.FRONTEND_AUTH_REDIRECT_URL ?? '',
  appleClientIds: (Bun.env.APPLE_CLIENT_IDS ?? '')
    .split(',')
    .map((clientId) => clientId.trim())
    .filter(Boolean),
  superAdminEmail: (Bun.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase(),
}
