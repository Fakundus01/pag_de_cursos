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
