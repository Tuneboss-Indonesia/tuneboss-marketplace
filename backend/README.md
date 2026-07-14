# TuneBoss Backend 

Express API for TuneBoss Marketplace.

## Stack

- Express
- TypeScript
- Drizzle ORM
- Neon Postgres
- Zod

## Environment

Copy the example env file:

```bash
cp .env.example .env
```

Required values:

```env
DATABASE_URL="postgresql://..."
FRONTEND_ORIGIN="http://localhost:4321"
PORT="8000"
```

Production integrations:

```env
ADMIN_ORIGIN="https://admin.example.com"
EMAIL_FROM="TuneBoss <noreply@example.com>"
RESEND_API_KEY="re_..."
XENDIT_SECRET_KEY="xnd_..."
XENDIT_WEBHOOK_TOKEN="same-token-as-xendit-callback-token"
```

Before public paid traffic, verify:

- `GET /api/ready` returns `{ "ok": true }` from the deployed API.
- `FRONTEND_ORIGIN` exactly matches the customer site origin used in Xendit redirects.
- `ADMIN_ORIGIN` exactly matches the separate admin panel origin if used.
- Xendit callback URL points to `POST /api/webhooks/xendit` and sends `x-callback-token` matching `XENDIT_WEBHOOK_TOKEN`.
- A staging invoice can be created, paid, and reflected as `paid` in `/api/orders/:id`.
- Resend accepts the sender domain and shipped/delivered emails arrive in a test inbox.

## Database

Generate a migration after schema changes:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

## Development

```bash
npm install
npm run dev
```

Health check:

```txt
GET http://localhost:8000/api/health
GET http://localhost:8000/api/ready
```

Auth endpoints:

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```
