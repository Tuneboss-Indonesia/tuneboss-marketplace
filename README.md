# TuneBoss Marketplace

Marketplace TuneBoss.

## Structure

```txt
backend/   Express + TypeScript + Drizzle + Neon Postgres
frontend/  Astro + React + Tailwind
```

Each app is managed from its own folder.

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate

cd ../frontend
npm install
cp .env.example .env
```

## Development

Run backend:

```bash
cd backend
npm run dev
```

Run frontend:

```bash
cd frontend
npm run dev
```

Default URLs:

```txt
Backend:  http://localhost:8000
Frontend: http://localhost:4321
```

## Checks

```bash
cd backend
npm run lint
npm run typecheck
npm run build

cd ../frontend
npm run lint
npm run doctor
npx @santi020k/astro-doctor
npx astro check
npm run typecheck
npm run build
```
