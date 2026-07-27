# Deploy ke cPanel via SSH/rsync

Panduan ini untuk repo `tuneboss-marketplace`.

## Struktur Repo

- `frontend/` = Astro frontend
- `backend/` = Express API

## Target Deploy

- frontend hasil build Astro ke subdomain utama atau subdomain khusus
- backend hasil build Express ke subdomain API/backend

## Secret GitHub

Tambahkan secret ini:

- `CPANEL_SSH_HOST`
- `CPANEL_SSH_USER`
- `CPANEL_SSH_KEY`
- `CPANEL_SSH_PORT` optional
- `CPANEL_FRONTEND_DIR`
- `CPANEL_BACKEND_DIR`

## Contoh Path

```text
CPANEL_FRONTEND_DIR=/home/cpaneluser/frontend.domain.com
CPANEL_BACKEND_DIR=/home/cpaneluser/backend.domain.com
```

## Alur Workflow

Saat push ke `main`, workflow akan:

1. install dependency frontend dan backend
2. jalankan typecheck
3. build frontend dan backend
4. sync hasil build ke server via SSH/rsync

Frontend yang dikirim adalah folder `dist/` dari Astro. Backend yang dikirim adalah hasil build TypeScript Express.

## Catatan Penting

- `.env` tidak ikut dikirim
- backend tetap perlu `.env` produksi di server
- frontend Astro yang dikirim adalah hasil `dist/`
- pastikan server cPanel mendukung Node.js untuk backend
