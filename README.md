# Quad Box

3D Quad N-back

![3D Quad N-back](3d-quad.jpg)

Play at https://quad-box.netlify.app

# Development
```
npm install
npm run dev
```

## Secrets / database credentials

This project is a **static frontend** (Svelte + Vite). Do **not** put a Postgres/Timescale/Tiger Cloud connection string into client-side code or any `VITE_*` variable (it would be shipped to every browser).

- **Local dev**: create a `.env.local` file (git-ignored) and put secrets there.
- **Deploy**: set secrets as environment variables in your hosting provider (e.g. Netlify site settings).

An example env template is in `env.example`.

## Real accounts + global leaderboard (Netlify Functions + Postgres)

This repo includes a small backend using **Netlify Functions** under `netlify/functions/`:

- `POST /api/init-db` (one-time) creates tables
- `POST /api/signup`, `POST /api/login`, `GET /api/me` for accounts (JWT)
- `POST /api/submit-game` logs games server-side
- `GET /api/leaderboard?category=score|minutes` returns global rankings

### Required environment variables

Set these in your hosting provider (or in `.env.local` for local testing):

- `TIMESCALE_SERVICE_URL` (or `DATABASE_URL`): your Postgres connection string (SSL required)
- `JWT_SECRET`: random secret used to sign login tokens
- `ADMIN_INIT_TOKEN`: random secret to protect `POST /api/init-db`
- `SIGHTENGINE_USER`, `SIGHTENGINE_SECRET`: required for SFW username + avatar moderation at signup

### Initialize the database

After deploying, call `POST /api/init-db` with header `X-Admin-Token: <ADMIN_INIT_TOKEN>`.


To view available shapes:
```
npm run view-shapes
```