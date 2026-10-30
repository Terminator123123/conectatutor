// Comprueba el contraste WCAG de los pares del tema institucional.
import { INSTITUCION } from '../src/config/institucion.js'

/**
 * Calcula luminancia relativa sRGB según WCAG.
 * @param {string} color Color hexadecimal de la configuración.
 * @returns {number} Luminancia entre cero y uno.
 */
function luminancia(color) {
  const canales = color.slice(1).match(/.{2}/g).map((canal) => {
    const valor = parseInt(canal, 16) / 255
    return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4
  })
  return canales[0] * 0.2126 + canales[1] * 0.7152 + canales[2] * 0.0722
}

/**
 * Obtiene la relación entre el color claro y el oscuro.
 * @param {string} texto Color del primer plano.
 * @param {string} fondo Color del fondo.
 * @returns {number} Relación de contraste sin redondear.
 */
function contraste(texto, fondo) {
  const valores = [luminancia(texto), luminancia(fondo)].sort((a, b) => b - a)
  return (valores[0] + 0.05) / (valores[1] + 0.05)
}

const pares = [
  ['texto', 'fondo'], ['texto', 'superficie'], ['textoSecundario', 'fondo'], ['textoSecundario', 'superficie'],
  ['superficie', 'primario'], ['primario', 'fondo'], ['exito', 'superficie'], ['advertencia', 'superficie'],
  ['error', 'superficie'], ['estrella', 'superficie', 3],
  ['primario', 'superficie'], ['primario', 'primarioSuave'], ['superficie', 'primarioOscuro'],
  ['acento', 'superficie'], ['texto', 'primarioSuave'], ['textoSecundario', 'primarioSuave'],
]
let fallidas = 0
for (const [texto, fondo, minimo = 4.5] of pares) {
  const relacion = contraste(INSTITUCION.colores[texto], INSTITUCION.colores[fondo])
  const cumple = relacion >= minimo
  if (!cumple) fallidas += 1
  process.stdout.write(`${cumple ? '✔' : '✘'} ${texto}/${fondo}: ${relacion.toFixed(2)}:1 (mínimo ${minimo}:1)\n`)
}
process.stdout.write(`Contraste: ${pares.length - fallidas}/${pares.length} pares correctos.\n`)
if (fallidas) process.exitCode = 1
