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

| Script             | Qué hace                                   |
| ------------------ | ------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                      |
| `npm run build`     | Build de producción                         |
| `npm run start`     | Sirve el build de producción                |
| `npm run lint`      | ESLint                                      |
| `npm run typecheck` | Chequeo de tipos con TypeScript             |
| `npm run test`      | Tests de humo (Vitest + Testing Library)    |

`npm run lint && npm run typecheck && npm run test && npm run build` debe
pasar en limpio antes de cualquier merge (ver `.github/workflows/ci.yml`).

## Estructura

```
src/
  app/            # Rutas (App Router), layout raíz, metadata, iconos
  components/
    sections/     # Navbar, Hero, AboutChurch, Pastors, Membership,
                   # BibleStudies, Activities, Giving, Contact, Footer
    ui/            # Primitivas reutilizables (Container, Button, SectionHeading)
  lib/
    site-config.ts # Contenido del sitio (nav, pastores, estudios, contacto...)
    supabase/      # Cliente de Supabase (server-only)
    actions/       # Server Actions (ej. envío del formulario de contacto)
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
