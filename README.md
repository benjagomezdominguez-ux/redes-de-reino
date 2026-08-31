# Redes de Reino

Landing page institucional de Redes de Reino (Salta, Argentina). Next.js 16
(App Router) + TypeScript + Tailwind CSS v4.

## Requisitos

- Node.js 24+ y npm.
- Una cuenta de Supabase con acceso al proyecto (autenticación, tienda de
  libros).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar con las credenciales del proyecto Supabase
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Script              | Qué hace                                        |
| ------------------- | ------------------------------------------------ |
| `npm run dev`        | Servidor de desarrollo                           |
| `npm run build`      | Build de producción                              |
| `npm run start`      | Sirve el build de producción                     |
| `npm run lint`       | ESLint                                           |
| `npm run typecheck`  | Chequeo de tipos con TypeScript                  |
| `npm run test`       | Tests de humo (Vitest + Testing Library)         |
| `npm run test:e2e`   | Tests E2E multidioma (Playwright, ver abajo)     |
| `npm run test:i18n`  | Valida que es/en/pt tengan exactamente las mismas claves |

`npm run test:i18n && npm run lint && npm run typecheck && npm run test &&
npm run build && npm run test:e2e` debe pasar en limpio antes de cualquier
merge (ver `.github/workflows/ci.yml`).

## Estructura

```
src/
  app/
    [locale]/     # layout.tsx (html/body real) + page.tsx — todo lo visible
                   # vive acá, parametrizado por idioma
    [locale]/libros/carrito, [locale]/libros/checkout
                   # carrito y checkout de la tienda de libros
    [locale]/biblioteca, [locale]/pedidos
                   # biblioteca digital y pedidos del usuario autenticado
    [locale]/login, [locale]/signup
                   # autenticación (Supabase Auth)
    api/books/[productId]/download
                   # única puerta de acceso a un archivo digital comprado
    robots.ts, sitemap.ts, manifest.ts, icon*, opengraph-image.jpg
                   # recursos globales, no dependen del idioma
  components/
    sections/     # Navbar, Hero, Gallery, Schedule, Pastors, Books, Footer
    ui/            # Primitivas reutilizables (Container, Button, SectionHeading,
                   # LanguageSwitcher, Reveal, CinematicGallery, MeetingSchedule,
                   # BookCard, AddToCartButton, CartView, CheckoutView, AuthForm)
  i18n/
    routing.ts     # locales soportados, default, prefijo de URL
    request.ts     # carga de mensajes + fallback a español
    navigation.ts  # helpers de next-intl (redirect localizado tras login/signup)
  lib/
    site-config.ts # Datos estructurales/nombres propios (NO textos traducibles)
    supabase/      # Clientes de Supabase — ver "Tienda de libros" abajo
    actions/       # Server Actions (auth, checkout)
    cart/          # Carrito de compra (React Context + localStorage)
    books/         # Queries de catálogo + resolución de acceso digital
messages/
  es.json, en.json, pt.json   # Todo el texto traducible de la UI
e2e/
  i18n.spec.ts     # Tests E2E multidioma (Playwright)
public/
  logo.png         # Logo oficial (no modificar proporciones ni colores)
supabase/
  migrations/      # Schema versionado (SQL), aplicado con `supabase db push`
```

## Backend (Supabase)

La sección "Contacto" (y su formulario) fue eliminada del sitio, así que ya
no se generan nuevos registros. Las tablas `contact_submissions` y su
rate-limit siguen existiendo en Supabase con el historial de mensajes
recibidos mientras la sección existió — no se borraron, por si los
pastores todavía quieren revisarlos desde el Table Editor del dashboard.

Cambios de schema van como una nueva migración en `supabase/migrations/`
y se aplican con:

```bash
npx supabase link --project-ref <project-ref>   # una sola vez
npx supabase db push
```

Hay tres formas de hablarle a Supabase desde el servidor, cada una con un
propósito distinto — usar la que no corresponde es el tipo de error que
rompe el aislamiento entre usuarios:

| Cliente | Archivo | Key | Uso |
| --- | --- | --- | --- |
| Anónimo | `lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Lecturas públicas (catálogo de libros) |
| Con sesión | `lib/supabase/session.ts` | (cookies del usuario) | Todo lo que depende de "quién sos" — RLS activo |
| Admin | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Saltea RLS. Solo para firmar URLs de archivos y otorgar acceso digital tras un pago confirmado |

`SUPABASE_SERVICE_ROLE_KEY` debe ser el JWT legacy de `service_role`
(Project Settings → API), no la key nueva formato `sb_secret_...` — en este
proyecto esa key nueva no tiene privilegio de bypass de RLS.

## Idiomas (i18n)

El sitio existe en tres idiomas — Español (`/es`, default), English (`/en`)
y Português (`/pt`) — vía [next-intl](https://next-intl.dev), con routing
por prefijo de URL (`localePrefix: "always"`).

**Cómo agregar/editar un texto**: nunca hardcodear strings en un componente.
Agregar la clave a `messages/es.json` primero, después a `en.json` y
`pt.json`, y consumirla con `useTranslations()` (client) o
`getTranslations()` (server). `npm run test:i18n` falla si las tres claves
no coinciden exactamente — es la forma de detectar una traducción faltante
antes de que llegue a producción.

**Fallback**: si igual faltara una clave en inglés o portugués,
`src/i18n/request.ts` hace merge profundo contra español en vez de
mostrar `MISSING_MESSAGE` — nunca se rompe la página, como mucho se ve
español donde falte la traducción (y queda logueado en dev).

**Persistencia**: el middleware de next-intl guarda el idioma elegido en
la cookie `NEXT_LOCALE`. Importante: el selector de idioma usa `<a>`
normal (no `next/link`) a propósito — next-intl solo sincroniza esa
cookie en navegaciones de documento completas, no en transiciones
client-side de Next. El Service Worker (`public/sw.js`) también ignora
explícitamente las navegaciones por el mismo motivo: interceptarlas
cambia cómo el navegador reporta la petición al servidor y rompe esa
sincronización.

**Contenido no traducido a propósito**: nombres propios (`Redes de
Reino`, `Ariel Gómez`, `Gabriela de Gómez`) se mantienen iguales en los
tres idiomas — no hay traducción oficial de un nombre propio, e
inventarla violaría la regla de no inventar contenido.

## Tienda de libros

La sección "Membresía" fue reemplazada por "Libros" (`#libros`, misma
posición en la página). Es la base de una tienda digital+física real, no
una maqueta: catálogo en base de datos, carrito, checkout adaptativo,
autenticación, y descarga de archivos digitales protegida contra acceso
cruzado entre usuarios.

**Catálogo**: tabla `products` en Supabase (portada, título, autor,
descripción, precio digital, precio físico, stock, tipo de producto
`digital` / `fisico` / `digital_fisico`, disponibilidad). Se administra
directamente en el Table Editor de Supabase — no hay contenido hardcodeado
en el código, así que agregar/editar un libro no requiere un deploy. Hoy el
catálogo está vacío a propósito (regla del proyecto: no inventar libros,
precios ni stock); `Books.tsx` muestra un estado vacío en vez de romperse.

**Carrito**: `lib/cart/CartContext.tsx`, React Context + `localStorage`,
sin tabla en el servidor — el precio que se ve ahí es solo para mostrar,
nunca se envía al servidor como fuente de verdad.

**Checkout** (`libros/checkout`): adaptativo — pide dirección física solo
si el carrito tiene algo `fisico` o `digital_fisico`; para compras
puramente digitales nunca se pregunta. Requiere estar autenticado. El flujo
completo: producto → modalidad → carrito → datos del comprador → dirección
(si aplica) → resumen → confirmación.

**Seguridad de precio y stock (la regla más importante)**: el cliente
nunca envía un precio. `checkout.ts` solo manda `product_id` + `modality` +
`quantity` a la función Postgres `create_order()` (`SECURITY DEFINER`),
que bloquea la fila del producto (`for update`), vuelve a leer el precio
desde `products`, y descuenta stock de forma atómica — así una compra
concurrente de la última unidad no puede dejar el stock en negativo ni
vender dos veces lo mismo. Verificado en
`lib/actions/checkout.test.ts` (incluye un test que confirma que ni un
payload con un precio forjado logra llegar al RPC).

**Acceso a archivos digitales**: nunca son públicos. El bucket de Storage
`book-files` es privado (`public: false`). `lib/books/digital-access.ts`
es el único camino de acceso: verifica sesión → verifica que exista una
fila en `digital_entitlements` para ese usuario y ese producto (consultada
con el cliente de sesión, con RLS activo, a propósito — así ni un bug de
la app puede filtrar acceso entre usuarios) → recién ahí firma una URL
temporal (60 segundos) con el cliente admin. `digital_entitlements` es el
registro explícito de "quién compró qué", no una inferencia. Se otorga vía
`grant_digital_access()`, pensada para llamarse solo después de que un
pago quede confirmado (webhook), nunca porque el usuario volvió al sitio.

Test de seguridad crítico (`digital-access.test.ts`, 6/6 verde): un usuario
autenticado que no compró el producto — o cuyo pago nunca se confirmó —
recibe `no_entitlement` y jamás llega a pedirle una URL al Storage.

**Pedidos y biblioteca**: `Mis Pedidos` (`/pedidos`) lista los pedidos del
usuario con su estado (`pending`, `payment_processing`, `paid`,
`processing`, `shipped`, `delivered`, `cancelled`, `refunded`, `failed`).
`Mi Biblioteca` (`/biblioteca`) solo muestra los libros digitales donde el
usuario tiene una entitlement `granted` — nunca el catálogo completo.

**Qué falta (deliberadamente, ver "Pendiente para producción")**:

- No hay ningún proveedor de pago conectado todavía. El pedido se crea en
  estado `pending` y ahí termina el flujo implementado — no existía
  definición de qué proveedor usar (Mercado Pago, Stripe, etc.) ni
  credenciales, así que no se inventó ninguno. `create_order()` y el
  estado del pedido ya están listos para que un webhook de pago llame a
  `grant_digital_access()` / actualice el estado sin cambiar el schema.
- Envío: costo, zonas, transportista y tracking quedan
  `[PENDIENTE DE CONFIGURACIÓN]` — no se inventó ningún costo de envío.
- Emails transaccionales, facturación y panel de administración: el schema
  (`orders`, `order_items`, `shipments`, `digital_entitlements`) ya soporta
  construirlos después sin re-diseñar nada, pero no están implementados.

## Sistema de diseño

Los tokens de color en `src/app/globals.css` (`--color-primary-*`,
`--color-secondary-*`, `--color-accent-*`) se derivaron directamente del
logo oficial: navy como color primario, dorado como acento/secundario,
granate como acento de marca, y un fondo crema cálido. Tipografías:
Fraunces (títulos) + Inter (texto), autohospedadas vía `next/font`.

## Contenido pendiente

Por regla del proyecto, no se inventa información oficial. Todo lo marcado
con `[CONTENIDO PENDIENTE]` en `src/lib/site-config.ts` debe completarse
con datos reales antes de producción:

- Biografías de los pastores (fotos ya cargadas) (`pastors`).
- Horarios de reuniones reales: día, nombre y horario de cada encuentro
  (`meetings`).
- Las 4 fotos de la galería cinematográfica (`galleryImages`).

## Estado y control de versiones

Proyecto bajo Git. El último commit en `main` es la última versión estable
conocida (*last known good version*): para volver a un estado estable,
`git log` y `git checkout <hash>` o `git revert`.

## Infraestructura

- **GitHub**: `github.com/benjagomezdominguez-ux/redes-de-reino` (privado).
- **Vercel**: proyecto `redes-de-reino`, deploy automático en cada push a
  `main` → https://redes-de-reino.vercel.app
- **Supabase**: proyecto `gwapuryyqhaarmanpvci` (región us-east-2).

## Pendiente para producción

- Contenido real listado arriba (pastores, horarios, fotos de galería).
- Fotografías profesionales para pastores y hero.
- Dominio propio (hoy el sitio vive en el subdominio `.vercel.app`) —
  requiere que el cliente compre/apunte un dominio.
- Tienda de libros: catálogo real (libros, precios, stock) — hoy vacío a
  propósito.
- Tienda de libros: elegir y conectar un proveedor de pago (ej. Mercado
  Pago) — requiere una decisión de negocio y credenciales que no existían
  al construir esta base.
- Tienda de libros: costos y zonas de envío reales, y un transportista.
- Tienda de libros (opcional, no bloqueante): proveedor de email
  transaccional para confirmaciones de compra.
