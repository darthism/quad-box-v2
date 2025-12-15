const { query } = require('./_db.cjs')
const { json, methodNotAllowed } = require('./_http.cjs')

function requireAdmin(event) {
  const token = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token']
  const expected = process.env.ADMIN_INIT_TOKEN || ''
  if (!expected || !token || token !== expected) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
}

const SQL = `
create extension if not exists pgcrypto;

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  avatar_mime text,
  avatar_bytes bytea,
  created_at timestamptz not null default now()
);

create table if not exists game_log (
  id bigserial primary key,
  user_id uuid references app_user(id) on delete cascade,
  username text not null,
  status text not null,
  title text,
  mode text,
  nback int,
  modalities int,
  trial_time_ms int,
  elapsed_seconds real,
  accuracy real,
  points bigint not null default 0,
  played_at timestamptz not null default now()
);

alter table app_user add column if not exists avatar_mime text;
alter table app_user add column if not exists avatar_bytes bytea;
alter table game_log add column if not exists accuracy real;

create index if not exists game_log_username_idx on game_log(username);
create index if not exists game_log_played_at_idx on game_log(played_at desc);
create index if not exists game_log_status_idx on game_log(status);
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed()

  try {
    requireAdmin(event)
    await query(SQL)
    return json(200, { ok: true })
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'init failed', code: e?.code || null })
  }
}


