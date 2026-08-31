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

## Probar desde el celular (misma Wi-Fi)

`next dev` ya escucha en todas las interfaces de red por defecto en esta
versión de Next.js (lo confirma su propio banner al arrancar, línea
`Network:`) — no hace falta ningún flag ni tocar `npm run dev` para eso.

Para abrir el sitio desde un iPhone/Android conectado a la misma red Wi-Fi
que la Mac, **usar el hostname mDNS de la Mac, no su IP**:

```
http://<nombre-de-tu-mac>.local:3000
```

El nombre exacto es el que muestra `scutil --get LocalHostName`, o
Configuración del Sistema → General → Uso compartido, campo "Nombre local".

**Por qué el hostname `.local` y no la IP (ej. `192.168.1.23:3000`)**:
la IP cambia según la red/router, así que nunca se puede hardcodear (regla
del proyecto). Pero además — esto se verificó en vivo contra el proyecto
real con `admin.generateLink()` — Supabase Auth **rechaza silenciosamente
cualquier IP-literal como host de redirect** (salvo `127.0.0.1`, que tiene
una excepción especial) y cae de vuelta al `site_url` por defecto, aunque
esa IP esté en `additional_redirect_urls`. Un hostname `.local` no es un
literal de IP, no cambia con la red, y sí es aceptado — por eso todo el
código (`src/lib/security/request-origin.ts`) y la config de Supabase
(`supabase/config.toml`) usan ese mecanismo en vez de una IP.

Dos cosas más hacían falta para que esto funcionara de punta a punta,
ambas ya resueltas en el código:

- **`next.config.ts`**: `allowedDevOrigins: ["*.local"]` — en modo
  desarrollo, Next.js bloquea con 403 cualquier Server Action (login,
  registro, etc.) que llegue desde un origen que no sea `localhost` a
  menos que esté explícitamente permitido acá. No tiene efecto en
  producción.
- **`src/lib/security/request-origin.ts`**: los links de confirmación de
  cuenta / recuperación de contraseña se construyen a partir del header
  `Host` de la request real (nunca de una constante fija), así que
  apuntan de vuelta a lo que sea que el visitante esté usando —
  `localhost`, el hostname `.local`, o el dominio de producción.

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
    [locale]/(protected)/     # route group (no aparece en la URL) — su layout
                   # exige sesión activa. Adentro: account, biblioteca,
                   # pedidos, libros/checkout
    [locale]/admin/           # su layout exige sesión + rol admin.
                   # admin, admin/books(+/new, /[id]/edit), admin/users,
                   # admin/orders(+/[id])
    [locale]/login, [locale]/signup, [locale]/forgot-password,
    [locale]/reset-password, [locale]/403
                   # autenticación (Supabase Auth) y control de acceso
    auth/callback/route.ts
                   # intercambia el código de un link de email (confirmación
                   # de cuenta o recuperación de contraseña) por una sesión
                   # real — fuera de [locale] a propósito, ver middleware.ts
    api/books/[productId]/download
                   # única puerta de acceso a un archivo digital comprado
    api/webhooks/payments/route.ts
                   # esqueleto del webhook de pago online — 503 hasta que
                   # haya un proveedor configurado, nunca un 200 falso
    robots.ts, sitemap.ts, manifest.ts, icon*, opengraph-image.jpg
                   # recursos globales, no dependen del idioma
  components/
    sections/     # Navbar, Hero, Gallery, Schedule, Pastors, Books, Footer
    ui/            # Primitivas reutilizables (Container, Button, SectionHeading,
                   # LanguageSwitcher, Reveal, CinematicGallery, MeetingSchedule,
                   # BookCard, AddToCartButton, CartView, CheckoutView, AuthForm,
                   # ForgotPasswordForm, ResetPasswordForm, AdminPagination,
                   # BookForm, BookStatusButtons, TransferProofForm,
                   # AdminPaymentReviewActions)
  i18n/
    routing.ts     # locales soportados, default, prefijo de URL
    request.ts     # carga de mensajes + fallback a español
    navigation.ts  # helpers de next-intl (redirect localizado tras login/signup)
  lib/
    site-config.ts # Datos estructurales/nombres propios (NO textos traducibles)
    supabase/      # Clientes de Supabase + guards — ver "Autenticación" abajo
    security/      # safeRedirectPath() — evita open-redirects en `next`
    actions/       # Server Actions (auth, checkout, payments, admin-books, admin-payments)
    cart/          # Carrito de compra (React Context + localStorage)
    books/         # Queries de catálogo + resolución de acceso digital
    checkout/      # Lista de países para el selector de facturación
    payments/      # Interfaz PaymentProvider — ver "Tienda de libros"
    admin/         # Queries del panel de administración (via cliente de sesión + RLS)
messages/
  es.json, en.json, pt.json   # Todo el texto traducible de la UI
e2e/
  i18n.spec.ts     # Tests E2E multidioma (Playwright)
  auth.spec.ts     # Tests E2E de rutas protegidas, login/signup/recuperación,
                   # y que el webhook de pagos nunca finge estar configurado
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

La configuración de Auth (Site URL, Redirect URLs, y todo lo demás bajo
`[auth]`) también vive como código en `supabase/config.toml` y se aplica
con `npx supabase config push`. **Importante**: ese comando reemplaza la
sección `[auth]` completa en el proyecto remoto — un campo que falte en
el archivo vuelve al default del propio CLI, no se queda como estaba en
el dashboard (esto pasó de verdad: un primer push con un archivo
incompleto desactivó sin querer la confirmación de email y el MFA que ya
estaban activos). Por eso el archivo declara explícitamente cada campo de
`[auth]`, no solo el que se está cambiando — si se edita, mantener esa
misma disciplina.

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

## Autenticación, roles y panel de administración

"Iniciar sesión" es un sistema real (Supabase Auth), no solo visual. Hay
tres niveles de acceso: público, usuario autenticado, y administrador.

**Login/registro** (`/login`, `/signup`): email + contraseña, con
mostrar/ocultar contraseña, y un flujo de recuperación completo
(`/forgot-password` → email → `/auth/callback` intercambia el código del
link por una sesión real → `/reset-password`). `/forgot-password` siempre
muestra el mismo mensaje de éxito exista o no esa cuenta — nunca permite
adivinar qué emails están registrados. El registro pide nombre/apellido
además de email/contraseña y nunca deja repetir un email (lo rechaza
Supabase Auth). Requiere confirmar el email antes de poder iniciar sesión
(configuración por defecto del proyecto).

**A dónde apuntan los links de email (confirmación de cuenta, recuperar
contraseña)**: nunca a una URL fija. `signUp()` y `requestPasswordReset()`
(`src/lib/actions/auth.ts`) construyen `emailRedirectTo`/`redirectTo` a
partir de `getRequestOrigin()` (`src/lib/security/request-origin.ts`),
que lee el header `Host` real de la request — así el link vuelve a
`localhost`, al hostname `.local` de la Mac, o al dominio de producción,
según desde dónde se haya pedido, nunca a un valor hardcodeado. `/auth/callback`
hace lo mismo para su propio redirect (no confiar en el `origin` que da
`new URL(request.url)` en una Route Handler — Next.js lo normaliza a la
dirección interna del server en vez de conservar el `Host` real que mandó
el cliente; esto se detectó en vivo y es la causa exacta de por qué los
links de confirmación terminaban en `localhost` sin importar desde dónde
se los abriera).

Para que Supabase efectivamente acepte esas URLs (si no, las reemplaza
en silencio por el `site_url` por defecto — ver `supabase/config.toml`,
que declara `site_url` y `additional_redirect_urls` como código y se
aplica con `npx supabase config push`), production/localhost/`*.local`
tienen que estar en la lista de Redirect URLs — ver "Probar desde el
celular" más arriba para el detalle completo de por qué se usa un
hostname `.local` en vez de una IP ahí también.

**Sesión**: cookies HttpOnly manejadas por `@supabase/ssr` — nunca
localStorage, nunca un token armado a mano. `middleware.ts` refresca la
sesión en cada request.

**Rutas protegidas**: `src/app/[locale]/(protected)/` agrupa `/account`,
`/biblioteca`, `/pedidos` y `/libros/checkout` bajo un único layout que
llama a `requireUser()` — sin sesión activa, redirige a `/login?next=...`.
`middleware.ts` hace la misma redirección más rápido (solo mirando la
cookie), pero es una mejora de UX, no el control real: aunque se la
saltee, el layout server-side igual bloquea. `/account` ("Mi Cuenta")
muestra nombre, apellido, email, y enlaces a Mis Pedidos / Mi Biblioteca —
nunca datos administrativos.

**Roles**: tabla `profiles` (1:1 con `auth.users`, creada automáticamente
por un trigger en el signup) con `role` (`user` | `admin`) y `status`
(`active` | `inactive`). Un usuario **no puede** cambiarse el rol a sí
mismo: además de que la Server Action de perfil nunca expone ese campo, un
trigger en Postgres (`protect_profile_privileges_trigger`) revierte
cualquier intento de `UPDATE profiles SET role = ...` que llegue de un
usuario autenticado normal por la API — verificado en vivo con una cuenta
de prueba real intentando exactamente ese `UPDATE` (ver "Tests" abajo).

**Cómo se crea un administrador** (rule 14 — nunca vía `/signup`): no hay
ningún mecanismo en la interfaz para auto-asignarse `admin`. Se hace a
mano, una vez, desde el SQL Editor de Supabase (contexto ya privilegiado,
el único que el trigger deja pasar):

```sql
update public.profiles set role = 'admin' where email = 'el-email-real@ejemplo.com';
```

**Panel admin** (`/admin`, layout con `requireAdmin()` — sesión + rol
`admin`, si no redirige a `/403`): dashboard con usuarios registrados,
compras confirmadas, pedidos pendientes y libros vendidos — todo calculado
en vivo desde la base de datos, nunca hardcodeado. `/admin/users` lista
usuarios (nombre, email, fecha de registro, estado), paginado de a 20.
`/admin/orders` lista pedidos (email del comprador, cantidad de ítems,
total, fecha, estado), también paginado; `/admin/orders/[id]` muestra el
detalle completo — productos, precios, y la dirección de envío cuando el
pedido la tiene. Nunca muestra contraseñas, tokens ni datos de pago.
`/admin/*` lleva `noindex` (metadata + `robots.txt`) para no quedar
indexado por buscadores.

Las queries de `/admin/*` corren con el cliente de sesión (no el admin/
service-role) — el acceso lo dan políticas RLS nuevas ("Admins can view
all ...") condicionadas a `is_admin(auth.uid())`, así que incluso un bug
en `requireAdmin()` no alcanzaría para leer datos ajenos: Postgres
revalida el rol en cada query, no solo la página.

**Base de datos**: migración `20260831000000_add_profiles_and_roles.sql`
agrega `profiles`, la función `is_admin()` (`SECURITY DEFINER`, patrón
recomendado por Supabase para chequeos de rol sin recursión de RLS), el
trigger anti-escalada, el trigger que crea el perfil al registrarse, y las
policies de lectura para admins sobre `orders`/`order_items`/
`shipping_addresses`.

**Tests de seguridad ejecutados en vivo** (cuentas reales creadas y
borradas en el mismo proceso, contra el proyecto de Supabase real):
1. Usuario normal intenta `UPDATE profiles SET role='admin'` en su propia
   fila vía REST, con su propio JWT → el trigger lo revierte, el rol en la
   base sigue siendo `user`. **PASS**.
2. Usuario normal autenticado navega a `/admin` y a `/admin/users` en un
   browser real → termina en `/403` en ambos casos. **PASS**.
3. Cuenta promovida a `admin` (vía el `UPDATE` de bootstrap de arriba)
   navega a `/admin` → llega al dashboard, con conteos reales, y ve a
   ambos usuarios de prueba en `/admin/users`. **PASS**.

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
posición en la página). Es una tienda digital+física real: catálogo
gestionado por admins, carrito, checkout con impuestos calculados en
servidor, dos métodos de pago (transferencia bancaria — funcional hoy —
y pago online — arquitectura lista, sin proveedor conectado), y descarga
de archivos digitales que solo se desbloquea cuando el pago fue
verificado de verdad, nunca porque el comprador lo dijo.

**Catálogo y su administración** (`/admin/books`): los administradores
crean/editan libros desde una UI real (`BookForm.tsx` + las Server
Actions en `lib/actions/admin-books.ts`) — título, autor, categoría,
descripción, idioma, tipo (`digital` / `fisico` / `digital_fisico`),
precio en USD, stock, portada y archivo digital. La portada se sube al
bucket público `book-covers`; el archivo digital, al bucket privado
`book-files`. Publicar/despublicar es un toggle. Nada de esto está
hardcodeado — el catálogo vive en la tabla `products`, hoy vacío a
propósito (regla del proyecto: no inventar libros, precios ni stock).
Reemplazar el archivo o la portada de un libro ya publicado no rompe las
compras existentes — la relación de la compra sigue siendo con el mismo
`product_id`.

**Carrito**: `lib/cart/CartContext.tsx`, React Context + `localStorage`,
sin tabla en el servidor — el precio que se ve ahí es solo para mostrar,
nunca se envía al servidor como fuente de verdad.

**Checkout** (`libros/checkout`): pide país de facturación siempre
(hasta para una compra puramente digital, porque de ahí sale el cálculo
de impuestos) y dirección física solo si el carrito tiene algo `fisico`
o `digital_fisico`. Elegís método de pago — transferencia bancaria o
pago online — y el resumen muestra subtotal, impuestos y total antes de
confirmar. Requiere estar autenticado.

**Precio e impuestos, calculados en servidor (la regla más importante)**:
el cliente nunca envía un precio, un total ni un impuesto. `checkout.ts`
solo manda `product_id` + `modality` + `quantity` + `payment_method` +
`billing_country` a la función Postgres `create_order()`
(`SECURITY DEFINER`), que bloquea la fila del producto (`for update`),
vuelve a leer el precio desde `products`, calcula impuestos contra la
tabla `tax_rules` (país + tasa; sin regla configurada = 0%, nunca una
tasa inventada — ver "Contenido pendiente"), descuenta stock de forma
atómica, y genera la referencia legible del pedido (`RR-2026-000123`).
Verificado en `lib/actions/checkout.test.ts` (incluye un test que
confirma que ni un payload con un precio forjado logra llegar al RPC) y
en vivo contra el proyecto real.

**Transferencia bancaria — funciona de verdad hoy**: el checkout muestra
el CBU, el monto exacto y la referencia del pedido. El comprador puede
declarar opcionalmente el número de operación, el monto y adjuntar un
comprobante (`payment-proofs`, bucket privado) — eso queda registrado,
pero **nunca confirma el pago por sí solo** (rule 21). El pedido queda
`pending` hasta que un administrador lo revisa en `/admin/orders/[id]` y
llama a `admin_confirm_bank_transfer()`, que:
- verifica que quien llama sea admin (`is_admin(auth.uid())`, no un
  botón oculto en el frontend);
- rechaza confirmar si el monto que el comprador declaró es menor al
  monto adeudado (rule 23) — un admin no puede aprobar por error un pago
  incompleto;
- recién ahí marca el pedido `paid` y llama a `grant_digital_access()`.

`admin_reject_bank_transfer()` existe para el caso contrario. Ambas
funciones son idempotentes: revisar el mismo pago dos veces la segunda
vez falla con "Payment already reviewed" — verificado en vivo.

**Pago online — arquitectura lista, sin proveedor conectado**: no existe
ninguna integración de pagos configurada en este proyecto (no hay
Mercado Pago, Stripe, ni ninguna otra) — por regla del proyecto, no se
inventó una. `lib/payments/provider.ts` define la interfaz
`PaymentProvider` (crear checkout, verificar webhook) de la que dependería
el resto del sistema, y `isOnlinePaymentConfigured()` — hoy siempre
`false` — es lo que hace que el checkout muestre "Pagar online" como
deshabilitado ("Próximamente") en vez de simular un pago que no existe.
`src/app/api/webhooks/payments/route.ts` ya está el esqueleto del
webhook (idempotencia vía `payment_events`, nunca confía en el monto que
manda el webhook sin comparar contra el pedido) pero devuelve `503`
mientras no haya provider — verificado con un test e2e que específicamente
comprueba que nunca miente con un `200`.

**Acceso a archivos digitales**: nunca son públicos. El bucket de Storage
`book-files` es privado (`public: false`). `lib/books/digital-access.ts`
es el único camino de acceso: verifica sesión → verifica que exista una
fila en `digital_entitlements` para ese usuario y ese producto (consultada
con el cliente de sesión, con RLS activo, a propósito — así ni un bug de
la app puede filtrar acceso entre usuarios) → recién ahí firma una URL
temporal (60 segundos) con el cliente admin. `digital_entitlements` es el
registro explícito de "quién compró qué" — incluye `payment_id`, así que
queda trazable exactamente qué pago desbloqueó qué acceso — no una
inferencia. Se otorga vía `grant_digital_access()`, llamada solo por
`admin_confirm_bank_transfer()` o (una vez configurado) el webhook de
pago — nunca porque el usuario volvió al sitio o pulsó "Ya pagué".

Test de seguridad crítico (`digital-access.test.ts`, 6/6 verde): un usuario
autenticado que no compró el producto — o cuyo pago nunca se confirmó —
recibe `no_entitlement` y jamás llega a pedirle una URL al Storage.
Verificado además en vivo, de punta a punta, contra el proyecto real: un
libro creado y publicado por un admin real, comprado por un comprador
real vía transferencia, con el archivo denegado (403) hasta que un admin
real lo confirmó — y con un segundo usuario real confirmando que nunca
tuvo acceso a nada de esto.

**Pedidos y biblioteca**: `Mis Pedidos` (`/pedidos`) lista los pedidos del
usuario — referencia, método de pago, subtotal/impuestos/total, estado
(`pending`, `payment_processing`, `paid`, `processing`, `shipped`,
`delivered`, `cancelled`, `refunded`, `failed`). `Mi Biblioteca`
(`/biblioteca`) muestra los libros con entitlement `granted`, y además
una tarjeta atenuada de "Tu pago está siendo verificado" para libros
digitales de pedidos todavía no confirmados — nunca el archivo en sí.

**Auditoría**: tabla `audit_log` — quién, qué acción, sobre qué recurso,
cuándo. Se registra: creación/edición/publicación de libros, creación de
pedidos, transferencias declaradas por el comprador, y confirmación o
rechazo de pagos por un admin. Nunca se registran secretos, contraseñas
ni datos de tarjetas.

**Qué falta (deliberadamente, ver "Pendiente para producción")**:

- El pago online necesita un proveedor real configurado (`PAYMENT_PROVIDER`
  y sus credenciales) — no existía definición de cuál usar, así que no se
  inventó ninguno.
- Impuestos: la tabla `tax_rules` está vacía — no se inventó ninguna tasa
  para ningún país. Agregar una fila ahí (país + tasa) alcanza para que
  `create_order()` empiece a cobrarla, sin tocar código.
- Envío: costo, zonas, transportista y tracking quedan
  `[PENDIENTE DE CONFIGURACIÓN]` — no se inventó ningún costo de envío.
- Emails transaccionales y facturación: el schema ya soporta construirlos
  después sin re-diseñar nada, pero no están implementados.

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
- Tienda de libros: tasas de impuestos reales por país en `tax_rules` —
  hoy la tabla está vacía a propósito, así que todo cobra 0% de impuesto
  hasta que se cargue una regla real.
- Tienda de libros (opcional, no bloqueante): proveedor de email
  transaccional para confirmaciones de compra.
- Autenticación: ya existe un primer administrador real
  (`benjagomezdominguez@gmail.com`, asignado con el `UPDATE` de bootstrap
  de la sección de arriba) — repetir ese mismo paso para cualquier otra
  cuenta que también deba administrar el sitio.
- Autenticación: confirmar en el dashboard de Supabase (Auth → URL
  Configuration) que `https://redes-de-reino.vercel.app/auth/callback`
  esté en la lista de Redirect URLs — si no está, los links de
  confirmación de cuenta y recuperación de contraseña no van a funcionar
  en producción.
