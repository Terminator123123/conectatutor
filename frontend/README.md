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
  componentes/
    layout/             layout, navegación y pie de página
    ui/                 reservado para el Bloque 4
  paginas/              once pantallas provisionales
  estilos/              global.css
  App.jsx               rutas
  main.jsx              tema, estilos y BrowserRouter
scripts/                reservado para el Bloque 3
public/                 recursos estáticos
```

## Configuración institucional

`src/config/institucion.js` es la única fuente de nombres institucionales, dominio, logo, colores y tipografía. Sus valores TEMPORAL y PENDIENTE UNIGUAJIRA requieren confirmación institucional. `tema.js` genera las variables CSS `--ct-*`; Vite toma el título HTML de `INSTITUCION.nombreApp`.

Las rutas usan BrowserRouter. Al publicar, el servidor debe responder con `index.html` para las rutas del frontend. La ruta `/componentes` es provisional y las rutas de tutor reciben el identificador mediante `useParams`.
