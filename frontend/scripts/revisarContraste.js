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

/** @param {string} primero Primer color de la configuración.
 * @param {string} segundo Segundo color de la configuración.
 * @param {number} proporcion Peso del primer color en sRGB.
 * @returns {string} Mezcla para comprobar etiquetas sobre superficies reales. */
function mezclar(primero, segundo, proporcion) {
  const canales = (color) => color.slice(1).match(/.{2}/g).map((canal) => parseInt(canal, 16))
  const a = canales(primero)
  const b = canales(segundo)
  return '#' + a.map((valor, indice) => Math.round(valor * proporcion + b[indice] * (1 - proporcion)).toString(16).padStart(2, '0')).join('')
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
const colores = INSTITUCION.colores
const mezclas = []
for (const estado of ['exito', 'advertencia', 'error', 'textoSecundario']) {
  for (const superficie of ['superficie', 'fondo']) mezclas.push([
    `etiqueta ${estado}/${superficie}`,
    mezclar(colores[estado], colores.texto, 0.85),
    mezclar(colores[estado], colores[superficie], 0.12),
  ])
}
mezclas.push(['aviso de error', colores.error, mezclar(colores.error, colores.superficie, 0.12)])
mezclas.push(['paso/superficie', colores.advertencia, mezclar(colores.advertencia, colores.superficie, 0.12)])
for (const [etiqueta, texto, fondo] of mezclas) {
  const relacion = contraste(texto, fondo)
  const cumple = relacion >= 4.5
  if (!cumple) fallidas += 1
  process.stdout.write(`${cumple ? '✔' : '✘'} ${etiqueta}: ${relacion.toFixed(2)}:1 (mínimo 4.5:1)\n`)
}
const total = pares.length + mezclas.length
process.stdout.write(`Contraste: ${total - fallidas}/${total} pares correctos.\n`)
if (fallidas) process.exitCode = 1
