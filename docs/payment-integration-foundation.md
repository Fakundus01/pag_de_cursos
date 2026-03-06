# Payment Integration Foundation

Se dejo una base de integracion para pasar del unlock inmediato a un checkout real sin rehacer backend.

## Endpoints

- `POST /api/courses/<slug>/checkout`
  - Crea una compra `pending` para un curso premium.
  - Devuelve `purchase` + `checkout` con `reference`, `statusUrl`, `webhookPath`, `nextAction` y `successUrl`.

- `GET /api/payments/<reference>`
  - Permite consultar el estado del pago para la compra del usuario autenticado.

- `POST /api/payments/webhooks/<provider>`
  - Recibe la confirmacion del proveedor y cambia la compra a `paid` o `failed`.
  - Si llega `paid`, desbloquea el curso, actualiza enrollment y cierra el referido si aplica.

## Configuracion

Variables nuevas en `backend/.env.example`:

- `PAYMENT_WEBHOOK_SECRET`
- `SESSION_COOKIE_*`
- `SESSION_LIFETIME_DAYS`

## Flujo recomendado

1. Front crea checkout con `POST /api/courses/<slug>/checkout`.
2. Redirige o confirma tarjeta segun `checkout.nextAction`.
3. El proveedor llama a `POST /api/payments/webhooks/<provider>` con la referencia.
4. Front consulta `GET /api/payments/<reference>` hasta ver `paid`.
5. El curso queda desbloqueado y ya aparece en perfil/home.

## Nota

El boton actual de compra rapida sigue existiendo para desarrollo y demo. La base nueva sirve para integrar Mercado Pago o un procesador de tarjetas real en el siguiente paso.
