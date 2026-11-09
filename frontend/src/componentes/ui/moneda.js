// Comparte el formato de pesos colombianos entre las vistas.
const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/** @param {number} valor Pesos. @returns {string} Moneda sin espacio tras el símbolo. */
export function formatearMoneda(valor) {
  return pesos.format(valor).replace(/\$\s*/u, '$')
}

/** @param {string} texto Importe con o sin separadores. @returns {number|null} Importe o null para gratuidad; NaN si no es numérico. */
export function interpretarMoneda(texto) {
  if (texto.trim() === '') return null
  return Number(texto.replace(/\$/gu, '').replace(/\s/gu, '').replace(/\./gu, '').replace(',', '.'))
}
