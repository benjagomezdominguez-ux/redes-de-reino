# Redes de Reino

Landing page institucional de Redes de Reino (Salta, Argentina). Next.js 16
(App Router) + TypeScript + Tailwind CSS v4.

## Requisitos

- Node.js 24+ y npm.
- Una cuenta de Supabase con acceso al proyecto (para el formulario de
  contacto/membresía).

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
    robots.ts, sitemap.ts, manifest.ts, icon*, opengraph-image.jpg
                   # recursos globales, no dependen del idioma
  components/
    sections/     # Navbar, Hero, AboutChurch, Pastors, Membership,
                   # BibleStudies, Activities, Giving, Contact, Footer
    ui/            # Primitivas reutilizables (Container, Button, SectionHeading,
                   # LanguageSwitcher, Reveal)
  i18n/
    routing.ts     # locales soportados, default, prefijo de URL
    request.ts     # carga de mensajes + fallback a español
    navigation.ts  # helpers de next-intl (no usado activamente hoy)
  lib/
    site-config.ts # Datos estructurales/nombres propios (NO textos traducibles)
    supabase/      # Cliente de Supabase (server-only)
    actions/       # Server Actions (ej. envío del formulario de contacto)
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

El formulario de contacto/membresía (sección "Contacto") persiste en la
tabla `contact_submissions` de Supabase. Row Level Security está activo:
el rol público (`anon`) solo puede insertar — nadie puede leer, editar ni
borrar submissions vía API. Los pastores revisan los mensajes desde el
Table Editor del dashboard de Supabase con su propia cuenta.

Cambios de schema van como una nueva migración en `supabase/migrations/`
y se aplican con:

```bash
npx supabase link --project-ref <project-ref>   # una sola vez
npx supabase db push
```

`SUPABASE_SECRET_KEY` está configurada pero sin uso todavía — queda
reservada para el día que haya un panel de administración que necesite
saltarse RLS (ver "Administración" en las recomendaciones futuras).

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
Reino`, `Ariel Gómez`, `Gabriela de Gómez`) y los nombres de los estudios
bíblicos (`Columnas`, `Bases`, `Protocolo`) se mantienen iguales en los
tres idiomas — no hay una traducción oficial de esos programas, e
inventarla violaría la regla de no inventar contenido.

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

- Fotos y biografías de los pastores (`pastors`).
- Estudios bíblicos reales: título, profesor, día, horario (`bibleStudies`).
- Actividades reales de la iglesia (`activities`).
- Datos de contacto: WhatsApp, Instagram, Facebook, YouTube, email,
  dirección, horarios (`contact`).
- Datos de diezmos y ofrendas: alias, CBU, banco (`giving`).

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

- Contenido real listado arriba (pastores, estudios, actividades,
  contacto, diezmos).
- Fotografías profesionales para pastores, hero y actividades.
- Dominio propio (hoy el sitio vive en el subdominio `.vercel.app`) —
  requiere que el cliente compre/apunte un dominio.
