To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

## Project structure

```txt
src/
  app.ts                    # Hono app setup
  index.ts                  # Bun/Hono entrypoint
  config/                   # Environment and app configuration
    db.ts                   # Mongoose database connection
  middlewares/              # Global error and fallback middleware
  modules/                  # Feature modules
    auth/
      auth.controller.ts
      auth.routes.ts
      auth.service.ts
      auth.store.ts
      auth.types.ts
    health/
      health.controller.ts
      health.routes.ts
      health.service.ts
  routes/                   # Root route registration
  shared/                   # Shared constants, helpers, and types
```

Add each new feature inside `src/modules/<feature-name>` with its own routes, controller, and service files.

## Auth APIs

Base path: `/auth`

- `GET /auth/google` - redirect user to Google login page
  ```txt
  Open this URL in browser: http://localhost:3000/auth/google
  ```
- `GET /auth/google/callback` - Google redirects here after login
  ```txt
  Google Console redirect URI: http://localhost:3000/auth/google/callback
  ```
- `POST /auth/register` - email/password registration
  ```json
  { "name": "Pavan", "email": "pavan@example.com", "password": "secret123" }
  ```
- `POST /auth/login` - email/password login
  ```json
  { "email": "pavan@example.com", "password": "secret123" }
  ```
- `POST /auth/apple` - iOS Apple sign-in
  ```json
  { "identityToken": "apple_identity_token_from_ios", "name": "Pavan" }
  ```

Set these environment variables:

```txt
JWT_SECRET=your-long-random-secret
MONGODB_URI=mongodb+srv://parenteye367:parenteye90@cluster0.o60im.mongodb.net/schoolmanagement?retryWrites=true&w=majority
MONGODB_DB_NAME=AtheleticaDB
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
GOOGLE_CLIENT_IDS=your-google-oauth-web-client-id,your-google-oauth-ios-client-id,your-google-oauth-android-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
FRONTEND_AUTH_REDIRECT_URL=http://localhost:5173/auth/callback
APPLE_CLIENT_IDS=your-ios-bundle-id-or-apple-services-id
```

User data is stored in MongoDB collection `AtheleticaDB.users`.

Use `GOOGLE_CLIENT_ID` for the backend browser redirect flow. Use `GOOGLE_CLIENT_IDS` as a comma-separated allowlist for Android/iOS `idToken` verification when mobile tokens have different audiences.
Use `APPLE_CLIENT_IDS` as a comma-separated allowlist for Apple `identityToken` verification. For iOS native sign-in this is usually the app bundle ID; for web/service flow it is the Apple Services ID.

`name` is optional, but iOS only gives the full name on the first Apple sign-in, so send it when available.

## Google Console setup

1. Open Google Cloud Console and create/select a project.
2. Go to `APIs & Services` > `OAuth consent screen`.
3. Choose user type, add app name, support email, developer contact email, and save.
4. Add scopes for basic profile/email only: `openid`, `email`, `profile`.
5. Add test users while the app is in testing mode.
6. Go to `APIs & Services` > `Credentials` > `Create Credentials` > `OAuth client ID`.
7. Choose `Web application`.
8. Add authorized JavaScript origins, for example `http://localhost:3000`, your frontend localhost URL, and your production domain.
9. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`.
10. Copy the generated client ID into backend `GOOGLE_CLIENT_ID`.
11. Copy the generated client secret into backend `GOOGLE_CLIENT_SECRET`.
12. Set backend `GOOGLE_REDIRECT_URI` to exactly the same callback URL added in Google Console.
13. Set `FRONTEND_AUTH_REDIRECT_URL` to the frontend page that should receive the app JWT after Google login.
14. Start login by opening `/auth/google`; Google will redirect back to `/auth/google/callback`.

Supported Google login flow:

- Browser opens `GET /auth/google`, user logs in on Google, backend callback returns JSON or redirects to `FRONTEND_AUTH_REDIRECT_URL?token=<jwt>`.
