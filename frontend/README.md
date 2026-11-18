# ConectaTutor Uniguajira — frontend

Aplicación React 19 con Vite y Bootstrap 5. Consume la API de `../backend` con `fetch`. La instalación completa, las cuentas de demostración y las pruebas están en el [README principal](../README.md).

## Scripts

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run lint` | Revisión estática con oxlint |
| `npm run probar-modelo` | Pruebas de las clases del dominio |
| `npm run revisar-contraste` | Contraste de colores del tema (WCAG AA) |

La dirección de la API se define en `.env` con `VITE_API_URL`. Por defecto es `http://localhost:3000/api`.

## Estructura

```text
src/
  config/        Datos institucionales (sedes, logos, correos de permanencia).
  modelo/        Clases del dominio, enumeraciones y reglas de negocio.
  servicios/     Cliente HTTP (api.js), repositorio sobre la API, conversión de respuestas,
                 agenda, métricas, validaciones, traducción y rutas por rol.
  contexto/      Sesión compartida (ingreso, cierre, restauración y expiración).
  hooks/         Título de cada pantalla.
  paginas/       Pantallas.
  componentes/
    layout/      Navegación, guardas de rutas, pie de página, selector de idioma, guardia de pestaña única.
    ui/          Controles reutilizables (botones, campos, tarjetas, carga y errores).
    cuenta/      Foto de perfil y cambio de contraseña.
    sesiones/    Modal de motivo compartido.
  estilos/       Tema visual y composiciones adaptables.
scripts/         Pruebas del cliente HTTP, del modelo y del contraste.
public/          Logos institucionales, sellos del pie de página y favicon.
```

## Arquitectura

El flujo es **modelo → servicios → contexto → páginas → componentes**.

- **Cliente HTTP.** `servicios/api.js` agrega el token y guarda el que la API renueva en cada uso. Cierra la sesión cuando el servidor responde 401. Sin conexión, reintenta solas las consultas, pero nunca repite una acción que cambia datos.
- **Repositorio.** `servicios/repositorioApi.js` convierte las respuestas en instancias del dominio con `mapeoApi.js`. Las páginas trabajan solo con esas clases.
- **Componentes `ui/`.** Reciben textos, números y funciones; no conocen el dominio ni la API. El catálogo de componentes está en `/componentes`.

Reglas de sesión y acceso:

- La sesión vence tras 30 minutos sin uso.
- Solo puede haber una pestaña y una sesión activas por cuenta.
- Una cuenta creada por Coordinación pasa por `/primer-acceso` antes de usar la aplicación.

## Modelo de dominio

| Clase | Responsabilidad |
|---|---|
| `Usuario` | Base abstracta: identidad, correo y contrato polimórfico del rol. |
| `Estudiante` | Programa, semestre, sede, activación del perfil y solicitud de tutorías. |
| `Administrador` | Verificación y rechazo de perfiles desde Coordinación. |
| `PerfilTutor` | Oferta, disponibilidad, biografía, revisión y promedio. |
| `FranjaHoraria` | Día e intervalo; igualdad y detección de solapamientos. |
| `Programa` | Programa académico. |
| `Materia` | Asignatura y su programa. |
| `Sesion` | Participantes, materia, fecha, estado, motivo y calificación. |
| `Calificacion` | Puntaje, reseña y fecha. |
| `ErrorDeNegocio` | Error con código de la regla incumplida. |
| `ServicioAutenticacionApi` | Acceso y cierre de sesión contra la API; pertenece a servicios. |

Un estudiante tiene un perfil de tutor opcional por composición; ser tutor no crea otra subclase. Las clases mantienen atributos privados, getters y serialización explícita. Las enumeraciones congeladas representan roles, estados y días.

| Regla | Condición | Método que la hace cumplir |
|---|---|---|
| R1 | No solicitarse una tutoría a sí mismo. | `Estudiante.solicitarSesion` |
| R2 | La materia pertenece a la oferta del tutor. | `Estudiante.solicitarSesion` y `PerfilTutor.ofrece` |
| R3 | La franja coincide con disponibilidad publicada. | `Estudiante.solicitarSesion` y `PerfilTutor.estaDisponible` |
| R4 | Solo se solicita a perfiles verificados. | `Estudiante.solicitarSesion` |
| R5 | Solo se permiten las transiciones definidas. | `Sesion.confirmar`, `rechazar`, `cancelar`, `finalizar` |
| R6 | El puntaje es un entero entre 1 y 5. | Constructor de `Calificacion` |
| R7 | Solo se califica una sesión finalizada, una sola vez. | `Sesion.calificar` |
| R8 | La fecha de la solicitud no está en el pasado. | `Estudiante.solicitarSesion` |
| R9 | La disponibilidad del tutor no se solapa. | `PerfilTutor.agregarFranja` y `FranjaHoraria.seSolapaCon` |
| R10 | La gratuidad usa tarifa nula; una tarifa de pago debe ser positiva. | `PerfilTutor` al crear y reconstruir con `desdeJSON` |
