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

## Common API details

Base URL: `http://localhost:3000`

Authenticated endpoints require:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Auth APIs

Base path: `/api/auth`

- `GET /api/` - server health check. No payload or authorization required.
- `GET /api/auth/google` - redirect user to Google login page
  ```txt
  Open this URL in browser: http://localhost:3000/api/auth/google
  ```
- `GET /api/auth/register` - browser alias for Google sign-in
  ```txt
  Open this URL in browser: http://localhost:3000/api/auth/register
  ```
- `POST /api/auth/register` - email/password registration
  ```json
  { "name": "Pavan", "email": "pavan@example.com", "password": "secret123" }
  ```
- `POST /api/auth/login` - email/password login
  ```json
  { "email": "pavan@example.com", "password": "secret123" }
  ```
- `GET /api/auth/google/start` - redirect user to Google login page. Optional query: `?state=<frontend-state>`.
  ```txt
  Open this URL in browser: http://localhost:3000/api/auth/google/start
  ```
- `GET /api/auth/google/callback?code=<google-code>` - Google redirects here after login. No JSON payload.
  ```txt
  Google Console redirect URI: http://localhost:3000/api/auth/google/callback
  ```
- `POST /api/auth/google` - frontend Google button login/register option
  ```json
  { "idToken": "google-id-token-from-frontend" }
  ```
- `POST /api/auth/apple` - Apple login/register
  ```json
  { "identityToken": "apple-identity-token", "name": "Pavan" }
  ```
- `GET /api/auth/me` - current user from bearer token. No request payload.
  ```txt
  Authorization: Bearer <token>
  ```
- `POST /api/auth/logout` - server-side logout. No JSON payload.
  ```http
  POST /api/auth/logout
  Authorization: Bearer <token>
  ```
  The current JWT is revoked until its original expiry and cannot be used again.
- `DELETE /api/auth/account` - permanently delete the authenticated account and associated data.
  ```http
  DELETE /api/auth/account
  Authorization: Bearer <token>
  Content-Type: application/json
  ```
  ```json
  { "confirmation": "DELETE" }
  ```
  This permanently deletes the user, all records from their 14 health collections, and every sent/received data-admin request or grant. The deleted user's JWTs stop working because the user no longer exists.

Set these environment variables:

```txt
JWT_SECRET=your-long-random-secret
MONGODB_URI=mongodb+srv://parenteye367:parenteye90@cluster0.o60im.mongodb.net/schoolmanagement?retryWrites=true&w=majority
MONGODB_DB_NAME=AtheleticaDB
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
FRONTEND_AUTH_REDIRECT_URL=http://localhost:5173/auth/callback
SUPER_ADMIN_EMAIL=superadmin@example.com
```

Only the exact email in `SUPER_ADMIN_EMAIL` receives the global `superAdmin` role. Every other account keeps the `user` role. A consent-based data-admin relationship does not change either user's global role.

## Band Pro health APIs

Every health request requires `Authorization: Bearer <token>`. Each function has its own POST and GET APIs. A POST accepts one record, an array of records, or `{ "records": [...] }`. Records are upserted by authenticated user and record `id`, so uploading the same record again does not duplicate it.

### App launch bulk upload API

Use this single API when the app launches to upload all available health data. It stores every metric in its own MongoDB collection. Existing function-wise POST and GET APIs remain available.

```http
POST /api/bandpro/sync
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "syncedAt": 1786524300000,
  "heartRate": [
    {
      "id": "automatic-1786524300000",
      "heart_rate": 72,
      "recorded_at": 1786524300000,
      "heart_rates_json": [70, 72, 75],
      "source": "automatic"
    }
  ],
  "pedometer": [],
  "sleep": [],
  "bloodOxygen": [],
  "bloodGlucose": [],
  "bloodComponents": [],
  "bodyTemperature": [],
  "hrv": [
    {
      "id": "2026-07-10",
      "date": 1786406400000,
      "hrv_json": {
        "date": "2026-07-10",
        "samples": [{ "timestamp": 1786524300000, "hrv": 48 }]
      }
    }
  ],
  "stress": [],
  "met": [],
  "bloodPressure": [],
  "bodyComposition": [],
  "ecg": [],
  "sportsWorkout": []
}
```

- Every provided metric value must be an array.
- Empty or missing arrays are skipped.
- At least one metric array must contain a record.
- Records always belong to the authenticated user.

Example response:

```json
{
  "syncedAt": 1786524300000,
  "totalSaved": 2,
  "savedByMetric": {
    "heartRate": 1,
    "hrv": 1
  }
}
```

Each metric path supports:

- `POST <path>` - upload only the authenticated user's records
- `GET <path>?date=yyyy-MM-dd` - get records for a day
- `GET <path>?from=yyyy-MM-dd&to=yyyy-MM-dd&limit=500` - get records for a date range
- `GET <path>/:id` - get one record

Metric paths:

```txt
/api/bandpro/heart-rate
/api/bandpro/pedometer
/api/bandpro/sleep
/api/bandpro/blood-oxygen
/api/bandpro/blood-glucose
/api/bandpro/blood-components
/api/bandpro/body-temperature
/api/bandpro/hrv
/api/bandpro/stress
/api/bandpro/met
/api/bandpro/blood-pressure
/api/bandpro/body-composition
/api/bandpro/ecg
/api/bandpro/sports-workout
```

### MongoDB collections

Every function stores records in its own collection:

| Metric | MongoDB collection |
| --- | --- |
| `heartRate` | `bandpro_heart_rate` |
| `pedometer` | `bandpro_pedometer` |
| `sleep` | `bandpro_sleep` |
| `bloodOxygen` | `bandpro_blood_oxygen` |
| `bloodGlucose` | `bandpro_blood_glucose` |
| `bloodComponents` | `bandpro_blood_components` |
| `bodyTemperature` | `bandpro_body_temperature` |
| `hrv` | `bandpro_hrv` |
| `stress` | `bandpro_stress` |
| `met` | `bandpro_met` |
| `bloodPressure` | `bandpro_blood_pressure` |
| `bodyComposition` | `bandpro_body_composition` |
| `ecg` | `bandpro_ecg` |
| `sportsWorkout` | `bandpro_sports_workout` |

### Health GET endpoints

The following GET formats work for every metric path listed above:

```http
GET <metric-path>?date=2026-07-10
GET <metric-path>?from=2026-07-01&to=2026-07-10&limit=500
GET <metric-path>/<record-id>
GET <metric-path>?ownerEmail=user@example.com&date=2026-07-10
```

- `date`, `from`, and `to` use `yyyy-MM-dd`.
- `limit` defaults to `500` and has a maximum of `5000`.
- `ownerEmail` works only after that user grants and verifies data-admin access.
- GET endpoints have no JSON request body.

### Metric record payloads

Send the shown record to its function-wise POST endpoint. Every endpoint also accepts an array of records or `{ "records": [...] }`.

#### Heart rate

`POST /api/bandpro/heart-rate`

```json
{
  "id": "automatic-1786524300000",
  "heart_rate": 72,
  "recorded_at": 1786524300000,
  "heart_rates_json": [70, 72, 75],
  "source": "automatic"
}
```

#### Pedometer

`POST /api/bandpro/pedometer`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "total_steps": 5420,
  "distance_meters": 3800,
  "calories_kcal": 210.5,
  "hourly_json": [
    {
      "hour": 8,
      "steps": 1200,
      "distanceMeters": 800,
      "caloriesKcal": 45,
      "timestamp": 1786435200000
    }
  ]
}
```

#### Sleep

`POST /api/bandpro/sleep`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "sleep_json": {
    "date": "2026-07-10",
    "sessions": [
      {
        "startTime": 1786524300000,
        "endTime": 1786553100000,
        "totalMinutes": 480,
        "deepMinutes": 120,
        "lightMinutes": 300,
        "remMinutes": 60,
        "awakeMinutes": 0,
        "stageSegments": [
          { "startTime": 1786524300000, "endTime": 1786533100000, "stage": "light" }
        ]
      }
    ]
  }
}
```

#### Blood oxygen

`POST /api/bandpro/blood-oxygen`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "blood_oxygen_json": {
    "date": "2026-07-10",
    "average": 98,
    "min": 95,
    "max": 100,
    "samples": [{ "timestamp": 1786524300000, "oxygen": 98, "source": "automatic" }]
  }
}
```

#### Blood glucose

`POST /api/bandpro/blood-glucose`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "blood_glucose_json": {
    "date": "2026-07-10",
    "samples": [{ "timestamp": 1786524300000, "glucose": 5.5 }]
  }
}
```

#### Blood components

`POST /api/bandpro/blood-components`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "blood_components_json": {
    "date": "2026-07-10",
    "samples": [{ "timestamp": 1786524300000, "uricAcid": 350 }]
  }
}
```

#### Body temperature

`POST /api/bandpro/body-temperature`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "body_temperature_json": {
    "date": "2026-07-10",
    "samples": [{ "timestamp": 1786524300000, "temperatureCelsius": 36.6 }]
  }
}
```

#### HRV

`POST /api/bandpro/hrv`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "hrv_json": {
    "date": "2026-07-10",
    "samples": [{ "timestamp": 1786524300000, "hrv": 48 }]
  }
}
```

#### Stress

`POST /api/bandpro/stress`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "stress_json": {
    "date": "2026-07-10",
    "samples": [{ "timestamp": 1786524300000, "stress": 35 }]
  }
}
```

#### MET

`POST /api/bandpro/met`

```json
{
  "id": "2026-07-10",
  "date": 1786406400000,
  "met_json": {
    "date": "2026-07-10",
    "samples": [{ "timestamp": 1786524300000, "met": 1.5 }]
  }
}
```

#### Blood pressure

`POST /api/bandpro/blood-pressure`

```json
{
  "id": "automatic-1786524300000",
  "systolic": 120,
  "diastolic": 80,
  "recorded_at": 1786524300000,
  "source": "automatic"
}
```

#### Body composition

`POST /api/bandpro/body-composition`

```json
{
  "id": "1786524300000",
  "recorded_at": 1786524300000,
  "is_device_test": 1,
  "stature": 175,
  "weight": 70,
  "gender": 1,
  "bmi": 22.8,
  "body_fat_percentage": 15.4,
  "fat_mass": 10.78,
  "lean_body_mass": 59.22,
  "muscle_rate": 45.2,
  "muscle_mass": 31.64,
  "subcutaneous_fat": 11.2,
  "body_moisture": 60.1,
  "water_content": 42.07,
  "skeletal_muscle_rate": 35.8,
  "bone_mass": 3.1,
  "proportion_of_protein": 18.2,
  "protein_amount": 12.74,
  "basal_metabolic_rate": 1650,
  "duration": 15,
  "id_type": 1
}
```

#### ECG

`POST /api/bandpro/ecg`

```json
{
  "id": "1786524300000",
  "recorded_at": 1786524300000,
  "average_heart": 75,
  "average_hrv": 45,
  "average_qt": 380,
  "average_pwv": 1020,
  "duration_seconds": 30,
  "frequency": 512,
  "draw_frequency": 256,
  "lead_status": 1,
  "success": 1,
  "data_type": "ecg",
  "ecg_type": "standard",
  "waveform_json": [0.12, 0.15],
  "raw_waveform_json": [],
  "heart_series_json": [],
  "hrv_series_json": [],
  "rr_series_json": [],
  "qt_series_json": [],
  "pwv_series_json": [],
  "qrs_duration_ms": 85,
  "qrs_amplitude_mv": 1.2,
  "qrs_direction": "up",
  "st_amplitude_mv": 0.05,
  "sdnn": 48,
  "rmssd": 44
}
```

#### Sports workout

`POST /api/bandpro/sports-workout`

```json
{
  "id": "workout-12345",
  "mode_id": "running_mode",
  "mode_title": "Outdoor Run",
  "category_title": "Cardio",
  "sport_type": 1,
  "started_at": 1786524300000,
  "ended_at": 1786526100000,
  "summary_json": {
    "sportType": 1,
    "durationSeconds": 1800,
    "caloriesKcal": 250,
    "distanceMeters": 4000,
    "steps": 4800,
    "avgHeartRate": 145,
    "maxHeartRate": 165,
    "minHeartRate": 110
  },
  "samples_json": []
}
```

Users cannot select another owner until that owner completes the access flow below. After consent, the requester becomes that owner's data admin and can add `ownerEmail=user@example.com` to a health `GET`. Posting data for another user is never allowed.

## User data-admin access flow

All paths use the `/api/admin-access` base and require a bearer token.

### Data-admin API endpoints and payloads

- `POST /api/admin-access/requests` - request access to another user's health data.

  ```json
  { "email": "user@example.com" }
  ```

- `GET /api/admin-access/requests/sent` - list requests sent by the authenticated user. No request payload.
- `GET /api/admin-access/requests/received` - list requests received by the authenticated user. No request payload.
- `POST /api/admin-access/requests/:id/accept` - data owner accepts the request and receives a six-digit OTP in the response. No request payload.
- `POST /api/admin-access/requests/:id/reject` - data owner rejects a pending request. No request payload.
- `POST /api/admin-access/requests/:id/verify-otp` - original requester verifies the OTP.

  ```json
  { "otp": "123456" }
  ```

- `POST /api/admin-access/requests/:id/revoke` - data owner revokes active access. No request payload.

1. Any authenticated user creates a request:
   `POST /api/admin-access/requests` with `{ "email": "user@example.com" }`.
2. User views requests with `GET /api/admin-access/requests/received`.
3. User accepts with `POST /api/admin-access/requests/:id/accept`. The response shows a six-digit OTP only to that authenticated user; it expires after 10 minutes.
4. User shares the OTP with the requesting admin.
5. Requester verifies with `POST /api/admin-access/requests/:id/verify-otp` and `{ "otp": "123456" }`.
6. The requester is now that user's data admin and can read their metrics with, for example, `GET /api/bandpro/hrv?ownerEmail=user@example.com&date=2026-07-10`.
7. User can remove access at any time with `POST /api/admin-access/requests/:id/revoke`.

Other access endpoints:

- `GET /api/admin-access/requests/sent` - current user's sent requests and active grants
- `POST /api/admin-access/requests/:id/reject` - user rejects a pending request

OTPs are stored only as secret-salted SHA-256 hashes. Active access is checked on every shared health data request, so revocation takes effect immediately.

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
9. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`.
10. Copy the generated client ID into backend `GOOGLE_CLIENT_ID`.
11. Copy the generated client secret into backend `GOOGLE_CLIENT_SECRET`.
12. Set backend `GOOGLE_REDIRECT_URI` to exactly the same callback URL added in Google Console.
13. Set `FRONTEND_AUTH_REDIRECT_URL` to the frontend page that should receive the app JWT after Google login.
14. Start login by opening `/api/auth/google`; Google will redirect back to `/api/auth/google/callback`.

There are two supported Google login styles:

- Backend redirect flow: browser opens `GET /api/auth/google`, user logs in on Google, backend callback returns JSON or redirects to `FRONTEND_AUTH_REDIRECT_URL?token=<jwt>`.
- Frontend button flow: frontend gets Google `idToken` and sends it to `POST /api/auth/google`; backend verifies it and returns the app JWT.
