// Aplica los colores y la tipografía institucionales como variables CSS.
import { INSTITUCION } from './institucion.js'

export function aplicarTema() {
  const raiz = document.documentElement

  Object.entries(INSTITUCION.colores).forEach(([nombre, valor]) => {
    const nombreVariable = nombre.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)
    raiz.style.setProperty(`--ct-${nombreVariable}`, valor)
  })
  raiz.style.setProperty('--ct-fuente', INSTITUCION.tipografia)
}
