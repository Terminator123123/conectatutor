# ConectaTutor Uniguajira

Plataforma web de tutorías entre pares para la Universidad de La Guajira. Un estudiante busca tutores por materia, sede o programa y solicita una sesión. El tutor la acepta o la rechaza, y al final el estudiante califica. Coordinación verifica a los tutores, administra el catálogo de materias y crea las cuentas de los estudiantes.

Proyecto de Desarrollo Web 2026-2, Línea 2. Trabajo individual de Shalem Rolón.

Prototipo en Figma: https://www.figma.com/proto/M63zFjGYVnZk1p1Y21V30r

## Arquitectura

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST con Node.js, Express 5 y MongoDB (Mongoose). Autenticación con JWT y bcrypt, documentación Swagger y pruebas con `node:test`. |
| `frontend/` | Aplicación React 19 con Vite y Bootstrap 5. Consume la API con `fetch`. Las clases del dominio están en `src/modelo/` y el acceso a la API en `src/servicios/`. |
| `entrega-1/` | Requisitos, diagramas, prototipo e informe de la primera entrega. |

El backend sigue el flujo rutas → middlewares de validación → controladores → servicios → modelos. Los errores salen siempre como JSON `{ mensaje, errores?, regla? }`.

## Requisitos

- Node.js 20.19 o superior dentro de la rama 20, o 22.12 en adelante, y npm. Es el rango que exige Vite para el frontend y el que declaran los dos `package.json`; la rama 21 queda fuera por Vite (Mongoose pide al menos 20.19).
- MongoDB es opcional en desarrollo. Si `MONGODB_URI` queda vacía, la API arranca con una base temporal en memoria y carga los datos de demostración. La primera vez descarga el binario de MongoDB para pruebas, así que tarda un poco.

## Instalación y arranque

Hacen falta dos terminales: una para la API y otra para la aplicación.

**1. API**

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Antes de arrancar, revisa `backend/.env`. Para probar en local basta con dejar `MONGODB_URI` vacía y `CLAVE_DEMO` con una contraseña de al menos 8 caracteres, con letras y números. La API queda en `http://localhost:3000/api`.

**2. Aplicación**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173`. El archivo `frontend/.env` solo define `VITE_API_URL`, la dirección de la API.

### Base de datos persistente

Para conservar los datos, pon en `MONGODB_URI` la cadena de un MongoDB local (`localhost`, `127.0.0.1` o `[::1]`); la semilla se niega a cargar datos en un servidor remoto y en cadenas con varios servidores o `replicaSet`. Después carga los datos de demostración, una sola vez:

```bash
cd backend
npm run seed
```

`npm run seed` se puede repetir: actualiza lo que existe y no duplica nada.

### Variables del backend

Todas están explicadas en `backend/.env.example`. En producción la API no arranca sin `MONGODB_URI` y `JWT_SECRETO`, y no acepta `CORS_ORIGIN=*`.

| Variable | Uso |
|---|---|
| `MONGODB_URI` | Conexión a MongoDB. Vacía en desarrollo: base en memoria. |
| `JWT_SECRETO` | Firma de los tokens. Al menos 32 caracteres al azar. |
| `CORS_ORIGIN` | Dirección del frontend. |
| `SESION_INACTIVIDAD`, `JWT_DURACION` | La sesión vence tras 30 minutos sin uso, con un tope de 2 horas. |
| `CLAVE_DEMO` | Contraseña de las cuentas de demostración. |
| `CORREO_USUARIO`, `CORREO_CLAVE_APP`, `CORREO_REMITENTE`, `FRONTEND_URL` | Envío del enlace de recuperación de contraseña con Gmail y una contraseña de aplicación. |
| `CORREO_DESVIO` | Solo desarrollo y demostraciones locales: envía todos los correos a esa dirección. La API no arranca en producción si está definida. |

Sobre la recuperación de contraseña:

- **Sin cuenta de correo en desarrollo:** el enlace se escribe en la consola de la API.
- **Sin cuenta de correo en producción:** la recuperación responde que no está disponible y no genera enlaces.

## Cuentas de demostración

Las cargan el arranque en memoria y `npm run seed`. Todas usan la contraseña definida en `CLAVE_DEMO`.

| Nombre | Correo | Rol | Perfil de tutor |
|---|---|---|---|
| Andrea Salcedo | andrea.salcedo@uniguajira.edu.co | Estudiante | Verificado, con tarifa |
| Bruno Valdés | bruno.valdes@uniguajira.edu.co | Estudiante | Verificado, gratuito |
| Carolina Rueda | carolina.rueda@uniguajira.edu.co | Estudiante | Verificado, con una calificación |
| Diego Manrique | diego.manrique@uniguajira.edu.co | Estudiante | Pendiente de verificar |
| Elena Lozano | elena.lozano@uniguajira.edu.co | Estudiante | Sin perfil |
| Felipe Castaño | felipe.castano@uniguajira.edu.co | Estudiante | Sin perfil, con una tutoría por calificar |
| Gabriela Montes | gabriela.montes@uniguajira.edu.co | Coordinación | No aplica |

## Cómo se crean las cuentas

Los estudiantes no se registran por su cuenta: Uniguajira entrega las credenciales.

1. Coordinación entra en **Cuentas** y crea la cuenta con nombre, correo institucional, documento de identidad, programa, semestre y sede.
2. El estudiante ingresa con su correo y su documento como contraseña inicial.
3. Antes de usar la aplicación debe crear una contraseña propia, elegir si solo busca ayuda o también quiere enseñar, y aceptar el tratamiento de sus datos (Ley 1581 de 2012).

Mientras no complete ese paso, la API solo le permite consultar.

La ruta `POST /api/auth/registro` sigue disponible en la API para pruebas, pero la aplicación no la usa.

### Primera cuenta de Coordinación

Una base nueva, como la de producción, no tiene registro abierto ni cuentas de demostración: hace falta crear una vez la primera cuenta de Coordinación, que después crea las de los estudiantes desde la aplicación. Desde `backend/`, con `MONGODB_URI` apuntando a esa base (en `backend/.env` o en el entorno), en PowerShell:

```powershell
$env:COORDINACION_NOMBRE = 'Nombre Apellido'
$env:COORDINACION_CORREO = 'nombre.apellido@uniguajira.edu.co'
npm run crear-coordinacion
```

El script pide la contraseña dos veces sin mostrarla (mínimo 8 caracteres, con letras y números) y la guarda cifrada. `COORDINACION_DEPENDENCIA` es opcional; si no se indica, queda la dependencia que verifica a los tutores. Si la base ya tiene una cuenta de Coordinación, no crea otra y termina con código 1. Sin terminal interactiva, la contraseña puede ir en `COORDINACION_CLAVE`.

## Recorrido rápido

Es el recorrido de desarrollo y pruebas, con las cuentas de demostración. En producción no se crean cuentas de demostración ni existe el registro abierto.

1. Sin iniciar sesión, la página principal muestra los tutores con sus filtros.
2. Al pulsar **Solicitar sesión** pide ingresar. Ingresa con Elena y vuelve a la solicitud.
3. Elige fecha, franja y tema, y envía la solicitud.
4. En otro navegador, ingresa con Andrea. En **Solicitudes**, acepta la sesión y después márcala como finalizada.
5. Vuelve a Elena: en **Mis sesiones**, califica la tutoría y el promedio de Andrea se actualiza.

Solo puede haber una sesión abierta por cuenta. Si la misma cuenta ingresa en otro navegador, la sesión anterior se cierra.

## Despliegue

- **Base de datos:** MongoDB Atlas. En Network Access debe permitirse `0.0.0.0/0` para que el servicio de la API pueda conectarse.
- **API (Railway):** carpeta raíz `backend`, comando de inicio `npm start`. Variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRETO`, `CORS_ORIGIN` (dirección exacta del frontend, nunca `*`), `FRONTEND_URL`, `CLAVE_DEMO` y las de correo.
- **Frontend (Vercel):** carpeta raíz `frontend`, comando `npm run build`, salida `dist`, variable `VITE_API_URL` con la dirección pública de la API terminada en `/api`. `vercel.json` redirige todas las rutas a `index.html`.
- **Primera cuenta:** con la base de producción vacía, crea la cuenta de Coordinación con `npm run crear-coordinacion` (ver «Primera cuenta de Coordinación»). En producción no se cargan datos de demostración.
- **Comprobación:** `/api/salud` y `/api/docs` de la API responden, y el ingreso funciona desde un celular con una cuenta ya aprovisionada.

## Documentación de la API

- **Swagger:** `http://localhost:3000/api/docs`. El JSON está en `/api/docs.json`.
- **Colección HTTP:** `backend/pruebas/Coleccion ConectaTutor.json`, en formato Postman. La prueba `coleccion.test.js` la ejecuta completa.
- **Salud:** `GET /api/salud`.

## Pruebas

```bash
cd backend && npm test          # API, contratos con Swagger, colección y cliente del frontend
cd frontend && npm run lint     # Revisión estática
cd frontend && npm run build    # Compilación de producción
cd frontend && npm run probar-modelo
cd frontend && node --test scripts/api.test.js scripts/agenda.test.js scripts/mapeoApi.test.js
```

Las pruebas del backend usan siempre una base en memoria y nunca tocan la base configurada.

## Limitaciones conocidas

- **Chat, pagos y recordatorios:** fuera del alcance acordado.
- **Funciones de demostración:** el material adjunto y los reportes de perfiles no se guardan en el servidor.
- **Idioma wayuunaiki:** el traductor automático no lo admite, así que el selector solo muestra un aviso.
- **Correo:** la recuperación de contraseña necesita una cuenta de Gmail configurada.
