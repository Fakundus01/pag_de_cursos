# Starcraft Academy: huecos del prompt y prioridades

## 1. Lo que ya esta cubierto en el repo

- Front con `Vite + React + Tailwind + TypeScript`.
- Back con `Flask + SQLAlchemy + SQLite`.
- Navbar, home, cursos, quienes somos, contactanos, login, registro, perfil y admin.
- Documento gratis visible y cursos premium bloqueados.
- Auth por cookie de sesion.
- Perfil con progreso, cursos recomendados, completados, trofeos y tarjetas simuladas.
- Comentarios y estrellas por curso.
- Chat guiado flotante.
- i18n base en `es`, `en` y `pt`.
- Admin con metricas y placeholders para FAQ/base IA.

## 2. Lo que el prompt todavia no define lo suficiente

### Modelo de negocio

- Si los cursos pagos son compra unica, membresia o ambas.
- Moneda principal: `USD`, `ARS` o multimoneda.
- Reglas de cupones y si el `10%` por referidos acumula con otras promos.
- Politica de reembolso y cancelaciones.

### Auth y seguridad

- "Validacion de email" hoy puede significar regex o verificacion real por email.
- Falta definir recuperacion de contrasena, expiracion de sesion y doble factor si hiciera falta.
- Roles: hoy hay `admin` y alumno; falta decidir si existira `superadmin`, editores o moderadores.

### Cursos y contenido

- Tipos de contenido exactos por seccion: documento, video, quiz, juego, actividad IA.
- Regla de finalizacion: que cuenta como "seccion completa".
- Flujo de publicacion: borrador, publicado, archivado.
- Donde se suben y guardan videos, imagenes y documentos.

### IA y actividades

- Si las actividades IA se generan al vuelo o desde un banco precomputado.
- Como se entrena o alimenta la base de conocimiento de StarCraft.
- Limites de costo, moderacion y revision humana de respuestas.
- Diferencia entre chat guiado FAQ y chat con LLM real.

### Pagos

- Render/Vercel no resuelve pagos; hace falta decidir proveedor principal por pais.
- Mercado Pago puede cubrir Argentina; Visa/Mastercard normalmente entran via la pasarela, no como integracion aparte.
- Las tarjetas no deben guardarse crudas en SQL: hay que usar tokens del gateway.

### Admin y analitica

- Faltan definiciones de metricas: ingreso bruto/neto, usuarios activos diarios/mensuales, conversion a pago.
- Falta definir moderacion de comentarios y valoraciones.
- Falta decidir si el admin podra editar tambien traducciones, landing y precios.

### Internacionalizacion

- Hoy solo la UI base esta traducida; falta decidir si tambien se traducen cursos, comentarios del sistema y contenido IA.

## 3. Lo que falta implementar respecto al prompt

### Critico para MVP

- Verificacion real de email.
- Flujo real de compra y desbloqueo.
- Persistencia real de tarjetas tokenizadas.
- Referidos reales con relacion entre invitador e invitado.
- Dashboard admin persistente, no solo visual.
- CRUD real de cursos, secciones, materiales y estados.

### Importante

- Password reset.
- Formularios evaluativos propios.
- Minijuegos para medir aprendizaje.
- Base de conocimiento editable por admin.
- Chat guiado administrable desde backend.
- Traduccion completa de todas las vistas.

### Deseable despues

- Actividades IA personalizadas por nivel o progreso.
- Recomendaciones mas inteligentes.
- Badges/trofeos mas ricos.
- Analitica avanzada de cohortes y conversion.

## 4. Decisiones recomendadas para cerrar el prompt

- Deploy: `Render` para este stack actual. `Vercel` sirve bien para el front, pero Flask + sesiones + SQL quedan mas naturales en Render.
- Base de datos: `SQLite` solo para local/dev. En produccion conviene `PostgreSQL`.
- Pagos: arrancar con `Mercado Pago` como gateway principal; Visa y Mastercard entran por ahi.
- Email: usar verificacion por token y proveedor transaccional.
- Media: guardar archivos en storage externo, no dentro del repo ni de la DB.
- Referidos: crear modelo explicito `referrer -> referred user -> reward granted`.
- IA: empezar con FAQ guiada + generacion controlada de actividades, no con un chat libre desde el dia uno.

## 5. Roadmap sugerido

### Fase 1: base firme

- Pasar de `SQLite` a configuracion lista para `PostgreSQL`.
- Cerrar modelo de datos de usuarios, compras, referidos y contenidos.
- Definir storage de assets y estrategia de deploy en Render.

### Fase 2: monetizacion y acceso

- Verificacion de email.
- Compra, webhook, desbloqueo y comprobante.
- Perfil con metodos de pago tokenizados y referidos reales.

### Fase 3: aprendizaje y admin

- CRUD admin completo de cursos/secciones/materiales.
- Formularios, quizzes y minijuegos.
- Moderacion de comentarios y ratings.
- Analitica real del dashboard.

### Fase 4: IA e iteracion

- Base de conocimiento editable.
- Actividades variables con IA.
- Recomendaciones y trofeos avanzados.
- Soporte guiado fuera de horario con fallback humano.

## 6. Primer ajuste tecnico ya hecho

Se agrego sincronizacion de estado entre pestanas en el front para que el flujo pedido de abrir el curso en `_blank`, completar secciones y volver a la pagina principal refleje mejor el progreso, el perfil y el estado de acceso al recuperar foco o al cambiar sesion en otra pestana.
