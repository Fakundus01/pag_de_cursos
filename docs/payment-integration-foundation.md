# Payment Integration Foundation

La integracion ya quedo preparada para un checkout real de Mercado Pago sin perder el modo demo.

## Endpoints

- `POST /api/courses/<slug>/checkout`
  - Crea o reutiliza una compra `pending`.
  - Si `MERCADOPAGO_ACCESS_TOKEN` esta configurado, crea una preferencia real y devuelve `checkout.redirectUrl`.
  - Si no esta configurado, sigue devolviendo el flujo demo para desarrollo.

- `GET /api/payments/<reference>`
  - Consulta el estado local de la compra.
  - Si la compra sigue `pending` y Mercado Pago esta activo, intenta sincronizar contra `GET /v1/payments/search` usando `external_reference`.

- `POST /api/payments/<reference>/confirm-demo`
  - Mantiene el unlock instantaneo solo para demo/local.

- `POST /api/payments/webhooks/<provider>`
  - Para `mercado-pago`, valida la firma `x-signature`, consulta `GET /v1/payments/{id}` y sincroniza la compra local.
  - Para webhooks demo/manuales sigue aceptando `PAYMENT_WEBHOOK_SECRET`.

## Configuracion

Variables nuevas en `backend/.env.example`:

- `FRONTEND_PUBLIC_URL`
- `BACKEND_PUBLIC_URL`
- `PAYMENT_CURRENCY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_SANDBOX_MODE`
- `MERCADOPAGO_API_BASE_URL`

## Flujo recomendado

1. Front crea checkout con `POST /api/courses/<slug>/checkout`.
2. Si viene `checkout.redirectUrl`, abre el checkout real de Mercado Pago en otra pestana.
3. Mercado Pago notifica al backend por webhook si `BACKEND_PUBLIC_URL` es HTTPS.
4. En paralelo, el front consulta `GET /api/payments/<reference>` hasta ver `paid`.
5. El curso queda desbloqueado y el estado se refleja en perfil, home y catalogo.

## Notas

- `notification_url` solo se envia automaticamente si `BACKEND_PUBLIC_URL` usa `https://`.
- Aunque el webhook no este disponible en local, el polling puede sincronizar el pago usando la busqueda por `external_reference`.
- Visa y Mastercard se procesan dentro del checkout de Mercado Pago, por eso el front mantiene la seleccion pero redirige al mismo checkout real.


## Endurecimiento previo a deploy

- `ENABLE_DEMO_PAYMENTS=false` apaga `/api/courses/<slug>/purchase` y `/api/payments/<reference>/confirm-demo` en producci?n.
- `SEED_DEMO_USERS=false` evita crear usuarios demo y compras seed en producci?n.
- `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` permiten bootstrapear el primer admin sin depender del usuario demo.
- `FLASK_DEBUG=false` queda como default para no exponer debug por error.
- El backend agrega headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`), y suma `Strict-Transport-Security` cuando recibe trafico HTTPS.
- Verificacion de email y recuperacion de contrasena ya quedaron activas; el detalle de endpoints y SMTP esta en `docs/auth-email-flows.md`.


## CSRF

- El frontend obtiene un token de sesion desde `GET /api/auth/csrf` o `GET /api/auth/me`.
- Cada `POST`, `PATCH` o `PUT` envia `X-CSRF-Token`.
- Los webhooks de proveedores quedan exentos porque no vienen del navegador.
- Este esquema funciona tambien cuando frontend y backend viven en dominios distintos.

## Rate limiting

- El backend ya limita por IP o usuario segun el endpoint para bajar abuso en auth, soporte, comentarios, admin y checkouts.
- Variables nuevas en `backend/.env.example`: `RATE_LIMIT_SUPPORT_CHAT`, `RATE_LIMIT_AUTH_LOGIN`, `RATE_LIMIT_AUTH_REGISTER`, `RATE_LIMIT_CHECKOUT`, `RATE_LIMIT_PURCHASE`, `RATE_LIMIT_DEMO_CONFIRM`, `RATE_LIMIT_PROGRESS`, `RATE_LIMIT_COMMENTS`, `RATE_LIMIT_ACTIVITY_GENERATION` y `RATE_LIMIT_ADMIN_WRITE`, con sus respectivas ventanas `*_WINDOW`.
- Cuando un cliente supera el limite, la API responde `429` con `Retry-After` y `retryAfterSeconds`.
- Implementacion actual: memoria del proceso. Para varias instancias en Render conviene mover estos contadores a Redis o a un store compartido antes de escalar horizontalmente.
