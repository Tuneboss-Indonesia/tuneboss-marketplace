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
