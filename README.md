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


To view available shapes:
```
npm run view-shapes
```