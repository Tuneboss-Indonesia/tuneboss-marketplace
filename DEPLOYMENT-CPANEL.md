# Deploy marketplace ke cPanel

Deployment produksi berjalan otomatis dari branch `main` repository organisasi.

## Endpoint sementara

- Frontend: `https://marketplace.tuneboss-landing.dasrams.biz.id`
- API: `https://api-marketplace.tuneboss-landing.dasrams.biz.id`

## GitHub Actions secrets

Secrets disimpan di repository organisasi:

- `CPANEL_SSH_HOST`
- `CPANEL_SSH_USER`
- `CPANEL_SSH_KEY`
- `CPANEL_SSH_PORT`

`CPANEL_SSH_KEY` berisi private key SSH. Password cPanel, database, dan JWT tidak
disimpan di GitHub.

## Server

- Frontend: `/home/tunm2447/apps/tuneboss-marketplace/frontend`
- Backend: `/home/tunm2447/apps/tuneboss-marketplace/backend`
- Database: MariaDB `tunm2447_marketplace`
- Runtime: CloudLinux Node.js 22

Backend membaca konfigurasi produksi dari file `.env` di server. Workflow tidak
menimpa file tersebut atau folder unggahan.

## Alur deployment

1. Buat perubahan di fork.
2. Buat pull request ke repository organisasi.
3. Setelah PR di-merge ke `main`, GitHub Actions menjalankan lint, typecheck, dan build.
4. Workflow mengunggah artefak, menjalankan migrasi database, lalu me-restart dua aplikasi Node.

## DNS dan SSL

Subdomain `tuneboss-landing.dasrams.biz.id` harus didelegasikan ke nameserver
cPanel berikut:

- `ns1.rumahweb.com`
- `ns2.rumahweb.com`
- `ns3.rumahweb.net`
- `ns4.rumahweb.net`

Setelah DNS sehat, jalankan AutoSSL di cPanel. Jangan aktifkan Force HTTPS sebelum
sertifikat valid terpasang.
