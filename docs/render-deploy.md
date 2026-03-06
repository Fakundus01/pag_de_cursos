# Render deployment

This repo is now prepared for a Render Blueprint deployment with three resources:
- `starcraft-academy-web`: static frontend built from `frontend`
- `starcraft-academy-api`: Flask backend served by Gunicorn
- `starcraft-academy-db`: PostgreSQL database for production data

The backend upload flow uses a persistent disk in Render:
- disk name: `starcraft-media`
- mount path: `/var/data/starcraft-media`
- upload root env: `MEDIA_UPLOAD_ROOT=/var/data/starcraft-media/uploads`

## Why the backend is not free

The backend service is set to `starter` because Render persistent disks are attached to paid web services. If you remove uploads or move them to an external object store/CDN later, you can revisit the plan choice.

## Variables to fill in Render

Render will ask you for these values when you create the Blueprint:
- `BACKEND_PUBLIC_URL`
  Example: `https://starcraft-academy-api.onrender.com`
- `FRONTEND_PUBLIC_URL`
  Example: `https://starcraft-academy-web.onrender.com`
- `FRONTEND_ORIGINS`
  Example: `https://starcraft-academy-web.onrender.com`
- `VITE_API_URL`
  Example: `https://starcraft-academy-api.onrender.com/api`

## Recommended production secrets after first deploy

Add these in the Render dashboard for the backend service before opening the site to users:
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `ENABLE_DEMO_PAYMENTS=false`
- `SEED_DEMO_USERS=false`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_ADMIN_NAME`

For real email delivery also add:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_USE_TLS=true`
- `SMTP_USE_SSL=false`

## Deploy flow

1. Commit and push `render.yaml` and the runtime/dependency changes.
2. Open the Blueprint link in Render.
3. Fill the four required URLs above.
4. Apply the Blueprint.
5. After the first deploy finishes, add the payment and SMTP secrets in the backend service.
6. Test:
   - `GET /api/health`
   - frontend login/register
   - admin media upload
   - course purchase flow

## Blueprint link

https://dashboard.render.com/blueprint/new?repo=https://github.com/Fakundus01/pag_de_cursos
