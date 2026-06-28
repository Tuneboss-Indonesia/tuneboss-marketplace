# TuneBoss Frontend

Astro frontend for TuneBoss Marketplace.

## Stack

- Astro
- React
- Tailwind CSS
- TypeScript

## Environment

Copy the example env file:

```bash
cp .env.example .env
```

Default API URL:

```env
PUBLIC_API_URL="http://localhost:8000/api"
```

## Development

```bash
npm install
npm run dev
```

Default URL:

```txt
http://localhost:4321
```

## Checks

```bash
npm run lint
npm run doctor
npx @santi020k/astro-doctor
npx astro check
npm run typecheck
npm run build
```

`npm run doctor` runs React Doctor locally with score/telemetry disabled.
`npx @santi020k/astro-doctor --no-score` runs Astro Doctor locally to check Astro anti-patterns and performance issues.
