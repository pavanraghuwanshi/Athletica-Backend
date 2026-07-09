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
- `GET /auth/register` - browser alias for Google sign-in
  ```txt
  Open this URL in browser: http://localhost:3000/auth/register
  ```
- `POST /auth/register` - email/password registration
  ```json
  { "name": "Pavan", "email": "pavan@example.com", "password": "secret123" }
  ```
- `POST /auth/login` - email/password login
  ```json
  { "email": "pavan@example.com", "password": "secret123" }
  ```
- `GET /auth/google/start` - redirect user to Google login page
  ```txt
  Open this URL in browser: http://localhost:3000/auth/google/start
  ```
- `GET /auth/google/callback` - Google redirects here after login
  ```txt
  Google Console redirect URI: http://localhost:3000/auth/google/callback
  ```
- `POST /auth/google` - frontend Google button login/register option
  ```json
  { "idToken": "google-id-token-from-frontend" }
  ```
- `GET /auth/me` - current user from bearer token
  ```txt
  Authorization: Bearer <token>
  ```

Set these environment variables:

```txt
JWT_SECRET=your-long-random-secret
MONGODB_URI=mongodb+srv://parenteye367:parenteye90@cluster0.o60im.mongodb.net/schoolmanagement?retryWrites=true&w=majority
MONGODB_DB_NAME=AtheleticaDB
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
FRONTEND_AUTH_REDIRECT_URL=http://localhost:5173/auth/callback
```

User data is stored in MongoDB collection `AtheleticaDB.users`.

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

There are two supported Google login styles:

- Backend redirect flow: browser opens `GET /auth/google`, user logs in on Google, backend callback returns JSON or redirects to `FRONTEND_AUTH_REDIRECT_URL?token=<jwt>`.
- Frontend button flow: frontend gets Google `idToken` and sends it to `POST /auth/google`; backend verifies it and returns the app JWT.
