# Auth Email Flows

Quedo armado el flujo de verificacion de email y recuperacion de contrasena para frontend + backend.

## Endpoints

- `POST /api/auth/register`
  - Crea la cuenta.
  - Si `EMAIL_VERIFICATION_REQUIRED=true`, no inicia sesion automaticamente.
  - Genera token de verificacion, envia email y devuelve `pendingVerification`.

- `GET /api/auth/verify-email?token=...`
  - Verifica el email, consume el token y deja la sesion iniciada.
  - Es idempotente para evitar falsos errores por dobles requests del navegador o React en desarrollo.

- `POST /api/auth/resend-verification`
  - Reenvia el email de verificacion si la cuenta existe y sigue pendiente.

- `POST /api/auth/request-password-reset`
  - Genera token de reset y envia el enlace por email.
  - Respuesta generica para no depender de enumeracion de cuentas en produccion.

- `POST /api/auth/reset-password`
  - Valida el token, actualiza la contrasena y consume el token.

## Frontend

Rutas nuevas:

- `/verificar-email`
- `/recuperar-contrasena`
- `/restablecer-contrasena`

El registro ya no asume `register -> login` cuando la verificacion esta activa. Login tambien bloquea acceso si el email sigue pendiente y ofrece reenviar el enlace.

## Configuracion

Variables nuevas en `backend/.env.example`:

- `EMAIL_VERIFICATION_REQUIRED`
- `EMAIL_VERIFICATION_TOKEN_HOURS`
- `PASSWORD_RESET_TOKEN_MINUTES`
- `EMAIL_DELIVERY_MODE`
- `EMAIL_DEV_PREVIEW`
- `EMAIL_SUBJECT_PREFIX`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`
- `EMAIL_PREVIEW_LOG_PATH`

## Modo dev y produccion

- Si no configuras `SMTP_HOST`, el backend cae en `EMAIL_DELIVERY_MODE=log` y escribe los correos en `backend/instance/email_previews.log`.
- Si `EMAIL_DEV_PREVIEW=true`, el frontend muestra el link directo de verificacion/reset para desarrollo local.
- En produccion conviene usar `EMAIL_DELIVERY_MODE=smtp` y `EMAIL_DEV_PREVIEW=false`.

## Rate limiting asociado

Se agregaron limites especificos para estos flujos:

- `RATE_LIMIT_AUTH_VERIFY_EMAIL`
- `RATE_LIMIT_AUTH_RESEND_VERIFICATION`
- `RATE_LIMIT_AUTH_PASSWORD_RESET`
- `RATE_LIMIT_AUTH_RESET_PASSWORD`

## Compatibilidad

- Los usuarios viejos sin fila en `EmailStatus` se marcan como verificados una sola vez al bootstrap para no romper cuentas ya existentes.
- Los usuarios nuevos si quedan sujetos a verificacion real.
