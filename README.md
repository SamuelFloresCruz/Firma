# Firma Clara

Laboratorio universitario para crear y verificar evidencias de firma digital en PDF, P7S, XML y JWS. La aplicación está construida con Next.js, React y TypeScript, y se puede desplegar gratuitamente en Vercel. Supabase es opcional y se utiliza solo para autenticación e historial.

> Este proyecto es didáctico. No emite certificados legales ni reemplaza PAdES, CAdES, XAdES, una TSA o la infraestructura de certificación boliviana.

## Funcionalidad

- Generación local de pares RSA 2048 mediante Web Crypto.
- Firma y verificación de archivos sin enviarlos al servidor.
- JWS compacto RS256 estándar.
- Contenedores académicos verificables para PDF, P7S y XML.
- Detección conservadora de firmas externas: se reportan como indeterminadas.
- Rechazo de archivos que ya contienen una firma para evitar firmas superpuestas incompatibles.
- Protección criptográfica del contenido y de los metadatos del firmante en las nuevas evidencias.
- Historial local de metadatos y huellas, nunca del contenido.
- Autenticación e historial remoto opcionales con Supabase.
- Diseño responsivo y accesible.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Comprobaciones de producción:

```bash
npm run typecheck
npm run build
npm start
```

La aplicación funciona sin Supabase en **Modo local**.

## Conectar Supabase

1. Crea un proyecto gratuito en Supabase.
2. Abre **SQL Editor**.
3. Copia y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql).
4. Ve a **Project Settings → API**.
5. Copia el `Project URL` y la clave pública `anon`/`publishable`.
6. Duplica `.env.example` como `.env.local`.
7. Completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

8. Reinicia `npm run dev`.

El encabezado cambiará de **Modo local** a **Entrar**. La clave `service_role` no se necesita y nunca debe exponerse con el prefijo `NEXT_PUBLIC_`.

### Configuración de autenticación

En **Authentication → URL Configuration** configura:

- Site URL local: `http://localhost:3000`
- Redirect URL local: `http://localhost:3000/**`
- Después del despliegue agrega: `https://TU-SITIO.vercel.app/**`

Para una demostración rápida puedes desactivar temporalmente la confirmación de correo en **Authentication → Providers → Email**. Para una presentación pública es mejor mantenerla activa.

### Qué guarda Supabase

La tabla `activities` contiene:

- Acción realizada.
- Formato.
- Nombre y tamaño del archivo.
- Estado de la operación.
- Huella SHA-256.
- Fecha.

No almacena documentos, llaves privadas ni contenido firmado. Las políticas RLS permiten que cada usuario vea únicamente sus propios registros.

## Desplegar en Vercel

1. Sube el proyecto a un repositorio personal de GitHub.
2. En Vercel elige **Add New → Project** e importa el repositorio.
3. Vercel detectará Next.js automáticamente.
4. Si conectaste Supabase, agrega las dos variables de `.env.local` en **Settings → Environment Variables**.
5. Pulsa **Deploy**.
6. Agrega la URL final a las Redirect URLs de Supabase.

No subas `.env.local` al repositorio. Ya está excluido mediante `.gitignore`.

## Formatos del laboratorio

| Salida | Implementación |
|---|---|
| PDF | Evidencia académica añadida después del EOF; el PDF sigue siendo visualizable. No es PAdES. |
| P7S | Contenedor JSON de firma separada. Requiere el original. No es CMS/CAdES. |
| XML | Envoltorio XML Firma Clara con contenido, manifiesto y firma. No es XAdES. |
| JWS | Compact Serialization con RS256, JWK pública y metadatos académicos. |

Esta separación es intencional: evita afirmar compatibilidad normativa que un proyecto exclusivamente TypeScript no implementa.

## Seguridad académica

- Las llaves solo permanecen en memoria hasta recargar o cerrar la pestaña.
- La llave privada se genera como no exportable mediante Web Crypto.
- La llave pública se incorpora a cada evidencia para hacerla autocontenida.
- Una llave incluida por el propio firmante prueba integridad, no identidad legal.
- La aplicación rechaza `alg: none` y solo acepta RS256 en JWS.
- Los archivos externos no compatibles nunca reciben un resultado “válido”.

## Estructura

```text
app/                  páginas Next.js
components/           interfaz y proveedores de estado
lib/crypto.ts         firma, verificación y llaves
lib/history.ts        historial local/Supabase
lib/supabase/         cliente opcional
supabase/schema.sql   tablas, índices y políticas RLS
types/                contratos TypeScript
```
# Firma
