// Aplica los colores y la tipografía institucionales como variables CSS.
import { INSTITUCION } from './institucion.js'

/** @returns {void} Variables CSS y enlace de las fuentes institucionales aplicados al documento. */
export function aplicarTema() {
  const raiz = document.documentElement

  Object.entries(INSTITUCION.colores).forEach(([nombre, valor]) => {
    const nombreVariable = nombre.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)
    raiz.style.setProperty(`--ct-${nombreVariable}`, valor)
  })
  raiz.style.setProperty('--ct-fuente', INSTITUCION.tipografia)
  raiz.style.setProperty('--ct-fuente-titulos', INSTITUCION.tipografiaTitulos)

  if (!document.getElementById('ct-fuentes')) {
    const fuentes = document.createElement('link')
    fuentes.id = 'ct-fuentes'
    fuentes.rel = 'stylesheet'
    fuentes.href = INSTITUCION.urlFuentes
    document.head.appendChild(fuentes)
  }
}
