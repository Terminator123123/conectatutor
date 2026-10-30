<!-- Guía de instalación y estructura del frontend académico. -->
# Plataforma de tutorías académicas

Frontend para conectar estudiantes con tutores de su institución. El bloque base incorpora React, Vite, Bootstrap, navegación y configuración institucional centralizada. Las pantallas permanecen en construcción; el modelo de dominio y los flujos se implementan en bloques posteriores.

## Requisitos

Node.js 20+ y npm, con una versión de Node compatible con el Vite instalado. La verificación de este bloque se realizó con Node.js 26.2.0 y npm 11.13.0.

## Instalación y ejecución

Desde la carpeta del proyecto:

```sh
npm install
npm run dev
```

## Verificación y compilación

```sh
npm run lint
npm run build
```

Para revisar la compilación localmente: `npm run preview`.

## Estructura

```text
src/
  config/               institucion.js y tema.js
  modelo/               reservado para el Bloque 3
  servicios/            reservado para el Bloque 3
  datos/                reservado para el Bloque 3
  contexto/             reservado para el Bloque 5
  componentes/layout/   layout, navegación y pie de página
  componentes/ui/       UI kit reutilizable (ver /componentes)
  paginas/              once pantallas provisionales
  estilos/              global.css
  App.jsx               rutas
  main.jsx              tema, estilos y BrowserRouter
scripts/                reservado para el Bloque 3
```

## Configuración institucional

`src/config/institucion.js` es la única fuente de nombres institucionales, dominio, logo, colores y tipografía. Datos oficiales de Uniguajira extraídos de uniguajira.edu.co el 2026-10-29. Pendiente: si las tutorías son gratuitas y confirmar la dependencia verificadora. `tema.js` genera las variables CSS `--ct-*`; Vite toma el título HTML de `INSTITUCION.nombreApp`.

Las rutas usan BrowserRouter. Al publicar, el servidor debe responder con `index.html` para las rutas del frontend. La ruta `/componentes` es provisional y las rutas de tutor reciben el identificador mediante `useParams`.

## Usuarios de prueba

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

Para reiniciar los datos, borra las claves `ct.*` del `localStorage` del navegador y recarga la aplicación. La sesión se conserva al recargar y se elimina con **Salir**.

## Recorrido del solicitante

1. Ingresa con Elena Lozano y `Demo1234`. En **Buscar tutores**, la sede inicial es Riohacha; puedes combinar sede, programa, materia y día o buscar por nombre sin tildes.
2. Abre el perfil de **Andrea Salcedo** y pulsa **Solicitar tutoría**. Elige una materia, una fecha y franja libre, y escribe un tema de 10 a 300 caracteres.
3. Envía la solicitud: aparece el aviso de envío y la tutoría **Pendiente** en **Mis sesiones → Mis solicitudes → Próximas**. Al recargar permanece guardada. Puedes cancelarla indicando un motivo de al menos cinco caracteres.
4. Sal e ingresa con **Felipe Castaño** y `Demo1234`. En **Mis sesiones → Historial**, pulsa **Calificar** en la tutoría finalizada con **Bruno Valdés**, elige las estrellas y, si quieres, escribe una reseña de hasta 300 caracteres.
5. Envía la calificación y consulta el perfil de Bruno (en búsqueda, selecciona Maicao o Todas las sedes). El promedio y el total se actualizan; la reseña aparece sin identificar a quien la escribió.
