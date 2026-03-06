# Backend foundation schema

## Objetivo

Esta base deja el backend preparado para crecer sin rehacer el dominio principal.

## Entidades nuevas

- `Purchase`: compra de un curso, con proveedor, referencia externa, montos, moneda y estado.
- `Referral`: relacion entre usuario que invita y usuario invitado, con porcentaje de recompensa y estado.
- `SectionContent`: bloques de contenido por seccion para soportar documento, video, actividad, quiz y juego.

## Lo que sigue igual para no romper el MVP actual

- `User`, `Course`, `CourseSection`, `Enrollment`, `Progress`, `Comment` y `PaymentMethod` mantienen sus columnas existentes.
- El frontend actual sigue consumiendo el mismo contrato principal de cursos, auth, perfil y admin.

## Mejoras operativas

- `DATABASE_URL` ahora acepta SQLite local o PostgreSQL usando `psycopg`.
- `FRONTEND_ORIGINS` permite configurar CORS sin tocar codigo.
- La seed crea de forma aditiva cursos, compras, referidos y bloques de contenido demo.

## Notas

- Aun no hay migraciones formales. Si mas adelante cambian columnas existentes, conviene sumar `Flask-Migrate` o una estrategia equivalente.
- Las tarjetas siguen siendo demo; en la siguiente fase hay que reemplazar esto por tokens del gateway de pago.
