# ConectaTutor Uniguajira — Entrega 2

## 1. Qué es ConectaTutor Uniguajira

ConectaTutor conecta a estudiantes de la Universidad de La Guajira con estudiantes tutores de su comunidad. Complementa el servicio del Área de Permanencia: permite organizar la oferta, solicitar y gestionar tutorías, calificar el acompañamiento y consultar cifras agregadas por sede.

## 2. Tecnologías y requisitos

React, Vite, React Router, Bootstrap 5 y Bootstrap Icons. La aplicación usa JavaScript con clases ES6 para el dominio y componentes React para la interfaz.

Requiere Node.js **20.19 o superior en la rama 20, o 22.12 o superior**, según la [compatibilidad oficial de Vite](https://vite.dev/guide/), y npm. Usa un navegador moderno con Web Crypto y almacenamiento local. Web Locks serializa las reservas entre pestañas cuando está disponible; se mantiene la relectura previa si esa API falta.

## 3. Instalación y scripts

Desde la carpeta `frontend`:

```sh
npm install
npm run dev
```

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática. |
| `npm run build` | Genera la aplicación para producción. |
| `npm run preview` | Sirve localmente la compilación generada. |
| `npm run lint` | Revisa el código con Oxlint. |
| `npm run probar-modelo` | Ejecuta las 80 pruebas de dominio y persistencia. |
| `npm run revisar-contraste` | Comprueba los 16 pares de colores del tema. |

Al publicar, el servidor debe responder con `index.html` a las direcciones de la aplicación para que BrowserRouter resuelva las rutas al recargar.

## 4. Estructura de carpetas

```text
src/
  config/               Datos institucionales y aplicación del tema.
  modelo/               Clases del dominio, enumeraciones y reglas de negocio.
  servicios/            Persistencia, autenticación, agenda, métricas y validaciones.
  datos/                Cuentas y oferta de demostración.
  contexto/             Estado y operaciones de autenticación compartidos.
  hooks/                Títulos de las pantallas.
  paginas/              Pantallas y sus consultas y acciones.
    sesiones/           Solicitudes propias y tutorías ofrecidas.
  componentes/
    layout/             Navegación, guardas de rutas, estructura y límite de errores.
    ui/                 Controles reutilizables de presentación.
    sesiones/           Modal de motivo compartido.
  estilos/              Tema visual y composiciones adaptables.
  App.jsx               Once rutas de la aplicación.
  main.jsx              Entrada, estilos, tema y proveedores.
scripts/                Pruebas del modelo y contraste.
public/                 Logos institucionales y favicon.
```

## 5. Arquitectura

**Modelo → servicios → contexto → páginas → componentes.** El modelo conserva las reglas y sus errores en español. El repositorio reconstruye instancias a partir de datos persistidos y ofrece operaciones asíncronas; autenticación registra e inicia sesión, agenda maneja fechas colombianas y ocupación, y métricas calcula cifras y CSV sin datos personales.

El contexto comparte la sesión. Las páginas consultan los servicios y convierten las instancias en valores de presentación. Los componentes de `ui/` reciben textos, números, opciones y callbacks; no conocen clases del dominio ni el repositorio, lo que permite reutilizarlos y mostrarlos en `/componentes`.

Antes de modificar una sesión o perfil, las páginas releen su estado. Coordinación impide sobrescribir una revisión ya resuelta. La versión `ct.version` permite renovar datos antiguos antes de restaurar la sesión. Un límite de errores mantiene la navegación disponible cuando falla el render de una pantalla y ofrece un reintento.

## 6. Modelo de dominio

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
| `ServicioAutenticacion` | Registro, acceso y cierre de sesión; pertenece a servicios. |

Un estudiante tiene un perfil de tutor opcional por composición; ser tutor no crea otra subclase. Las clases mantienen atributos privados, getters y serialización explícita. Las enumeraciones congeladas representan roles, estados y días.

| Regla | Condición | Método que la hace cumplir |
|---|---|---|
| R1 | No solicitarse una tutoría a sí mismo. | `Estudiante.solicitarSesion` |
| R2 | La materia pertenece a la oferta del tutor. | `Estudiante.solicitarSesion` y `PerfilTutor.ofrece` |
| R3 | La franja coincide con disponibilidad publicada. | `Estudiante.solicitarSesion` y `PerfilTutor.estaDisponible` |
| R4 | Solo se solicita a perfiles verificados. | `Estudiante.solicitarSesion` |
| R5 | Solo se permiten las transiciones definidas. | `Sesion.confirmar`, `rechazar`, `cancelar`, `finalizar` |
| R6 | Solo se califica una sesión finalizada, una sola vez. | `Sesion.calificar` |
| R7 | El puntaje es un entero entre 1 y 5. | Constructor de `Calificacion` |
| R8 | El correo pertenece al dominio institucional. | `ServicioAutenticacion.validarCorreoInstitucional` |
| R9 | La disponibilidad del tutor no se solapa. | `PerfilTutor.agregarFranja` y `FranjaHoraria.seSolapaCon` |
| R10 | La gratuidad usa tarifa nula; una tarifa de pago debe ser positiva. | `PerfilTutor` al crear y reconstruir con `desdeJSON` |

## 7. Pantallas

| Pantalla | Ruta o ubicación | Rol |
|---|---|---|
| P0 Inicio | `/` | Público; contenido según el rol. |
| P1 Registro | `/registro` | Invitado. |
| P2 Ingreso | `/ingresar` | Invitado. |
| P3 Búsqueda de tutores | `/tutores` | Estudiante. |
| P4 Perfil del tutor | `/tutores/:id` | Estudiante. |
| P5 Solicitud | `/tutores/:id/solicitar` | Estudiante. |
| P6 Mis sesiones | `/sesiones?vista=solicitudes` y `?vista=doy` | Estudiante; segunda pestaña con perfil de tutor. |
| P7 Calificación | Modal dentro de `/sesiones` | Solicitante de una tutoría finalizada. |
| P8 Mi perfil | `/perfil` | Estudiante. |
| P9 Coordinación | `/admin/verificacion?vista=perfiles` y `?vista=panel` | Coordinación. |

El catálogo `/componentes` y la pantalla 404 completan las once rutas. La cancelación y los motivos se presentan en modales sin crear rutas adicionales. El destino protegido conserva la búsqueda de la URL al pedir ingreso.

## 8. Usuarios de prueba y recorridos

### Usuarios de prueba

Las siete cuentas se cargan solas la primera vez. Todas usan la contraseña `Demo1234`. Los correos utilizan el dominio actual de `src/config/institucion.js`.

Felipe Castaño tiene una tutoría finalizada sin calificar, para probar la calificación.

| Nombre | Correo | Rol | Perfil de tutor |
|---|---|---|---|
| Andrea Salcedo | andrea.salcedo@uniguajira.edu.co | Estudiante | Verificado |
| Bruno Valdés | bruno.valdes@uniguajira.edu.co | Estudiante | Verificado |
| Carolina Rueda | carolina.rueda@uniguajira.edu.co | Estudiante | Verificado |
| Diego Manrique | diego.manrique@uniguajira.edu.co | Estudiante | Pendiente |
| Elena Lozano | elena.lozano@uniguajira.edu.co | Estudiante | Sin perfil |
| Felipe Castaño | felipe.castano@uniguajira.edu.co | Estudiante | Sin perfil |
| Gabriela Montes | gabriela.montes@uniguajira.edu.co | Coordinación | No aplica |

La sesión se conserva al recargar y se cierra con **Salir**. Los datos incompatibles con la versión actual se reinician automáticamente; se vuelve a cargar la demostración sin afectar otras aplicaciones.

### Recorrido del solicitante

1. Ingresa con Elena Lozano y `Demo1234`. En **Buscar tutores**, la sede inicial es Riohacha; puedes combinar sede, programa, materia y día o buscar por nombre sin tildes.
2. Abre el perfil de **Andrea Salcedo** y pulsa **Solicitar tutoría**. Elige una materia, una fecha y franja libre, y escribe un tema de 10 a 300 caracteres.
3. Envía la solicitud: aparece el aviso de envío y la tutoría **Pendiente** en **Mis sesiones → Mis solicitudes → Próximas**. Al recargar permanece guardada. Puedes cancelarla indicando un motivo de al menos cinco caracteres.
4. Sal e ingresa con **Felipe Castaño** y `Demo1234`. En **Mis sesiones → Historial**, pulsa **Calificar** en la tutoría finalizada con **Bruno Valdés**, elige las estrellas y, si quieres, escribe una reseña de hasta 300 caracteres.
5. Envía la calificación y consulta el perfil de Bruno (en búsqueda, selecciona Maicao o Todas las sedes). El promedio y el total se actualizan; la reseña aparece sin identificar a quien la escribió.


### Recorrido del tutor y de Coordinación

1. Ingresa con **Elena Lozano**, abre **Mi perfil**, escribe una biografía de 20 a 500 caracteres y pulsa **Activar perfil de tutor**. Agrega una materia y un horario disponible.
2. Sal e ingresa con **Gabriela Montes**. En **Coordinación → Perfiles por verificar**, revisa el perfil de Elena y pulsa **Verificar**. Puedes filtrar la lista por sede.
3. Sal e ingresa con **Felipe Castaño**. En **Buscar tutores**, elige **Todas las sedes**, busca a Elena y solicita una tutoría en una franja libre.
4. Sal e ingresa con Elena. En **Mis sesiones → Sesiones que doy**, pulsa **Aceptar**. Después, pulsa **Marcar como realizada** y confirma la realización.
5. Sal e ingresa con Felipe. En **Mis sesiones → Historial**, califica esa tutoría. El promedio y el total de Elena cambian en la búsqueda y en su perfil público; Elena ve la calificación y la reseña en **Sesiones que doy → Historial**.
6. Para probar un rechazo, Gabriela rechaza el perfil pendiente de **Diego Manrique** con un motivo de al menos cinco caracteres. Diego lo ve en **Mi perfil**, corrige su oferta y pulsa **Pedir nueva revisión**. Gabriela vuelve a verlo en los perfiles pendientes.
7. En **Coordinación → Panel de permanencia**, consulta las cifras por sede y descarga el CSV. El panel muestra solo cifras agregadas, sin nombres ni datos individuales de estudiantes. Los estudiantes atendidos cuentan una sola vez si tienen varias tutorías realizadas.

Todas las cuentas de prueba usan `Demo1234`. Las pestañas conservan la vista en la URL al recargar. Una franja ocupada se vuelve a comprobar al enviar la solicitud; el tutor tampoco puede aceptar otra tutoría en un horario ya confirmado.


## 9. Datos institucionales

La única fuente de datos institucionales es `src/config/institucion.js`: nombre, dominio, paleta, fuentes, logos, sedes, canales de Permanencia y tratamiento de datos. Los programas y materias de la demostración conservan sus fuentes institucionales en los datos iniciales.

La dependencia verificadora está marcada **PROPUESTA** y requiere confirmación. Sigue **PENDIENTE UNIGUAJIRA** la gratuidad definitiva; `tutoriasGratuitas` es `null` y la interfaz presenta las tutorías como gratuitas. No se han inventado datos para cerrar esos pendientes.

## 10. Accesibilidad y responsive

Se revisaron las pantallas en 375, 768 y 1280 px. La navegación móvil reserva 64 px; la acción fija del perfil público queda sobre esa barra. Los enlaces y controles tienen al menos 44 px de área táctil, y la tabla por sede desplaza su contenido dentro de su contenedor sin ensanchar la página.

La aplicación incluye salto al contenido, títulos de página, etiquetas y errores asociados, foco visible, pestañas con flechas y selección conservada en la URL, avisos de estado y modales con foco contenido, Escape y retorno del foco. Las transiciones respetan `prefers-reduced-motion`.

El script de contraste comprueba los colores de la configuración: mínimo 4,5:1 para texto y 3:1 para la estrella gráfica. Los 16 pares superan su umbral. El nombre del usuario se muestra desde 992 px para que la cabecera de 768 px mantenga una sola fila. Las reseñas públicas son anónimas, muestran primero las cinco más recientes y permiten abrir el resto.

## 11. Hacia la Entrega 3

La transición consiste en reemplazar la implementación de `src/servicios/repositorio.js` por llamadas a la API de Express, conservando su interfaz asíncrona y la reconstrucción del dominio. Las páginas y los componentes siguen consumiendo las mismas operaciones; la persistencia y las garantías de concurrencia se trasladan al servidor.
