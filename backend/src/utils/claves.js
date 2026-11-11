import bcrypt from 'bcryptjs'

/**
 * Vueltas de bcrypt: cada unidad duplica el trabajo necesario para probar una contraseña.
 * bcrypt es un hash irreversible con sal: del resultado no se puede volver a la contraseña.
 */
const COSTO_HASH = 10

/** bcrypt ignora lo que pase de 72 bytes: se rechaza antes para no dar una falsa seguridad. */
const BYTES_MAXIMOS = 72

export const MENSAJE_CLAVE =
  'La contraseña debe tener al menos 8 caracteres, con letras y números, y ocupar máximo 72 bytes (las tildes y la ñ ocupan 2)'

/**
 * Indica si una contraseña sirve: al menos 8 caracteres, con letras y números,
 * y máximo 72 bytes en UTF-8. El tope es en bytes y no en caracteres porque así
 * cuenta bcrypt: una letra con tilde o una ñ ocupan 2 bytes.
 * @param {unknown} clave
 * @returns {boolean}
 */
export function esClaveAceptable(clave) {
  return (
    typeof clave === 'string' &&
    clave.length >= 8 &&
    Buffer.byteLength(clave, 'utf8') <= BYTES_MAXIMOS &&
    /\p{L}/u.test(clave) &&
    /[0-9]/.test(clave)
  )
}

/**
 * Convierte la contraseña en el hash que se guarda en la base de datos.
 * @param {string} clave
 * @returns {Promise<string>}
 */
export function cifrarClave(clave) {
  return bcrypt.hash(clave, COSTO_HASH)
}

/**
 * Comprueba una contraseña contra el hash guardado.
 *
 * bcrypt solo mira los primeros 72 bytes: sin el control de longitud, la contraseña
 * correcta seguida de cualquier texto también entraría. Por eso una contraseña más
 * larga que el límite nunca coincide. La comparación se ejecuta de todos modos para
 * que la respuesta tarde lo mismo en ambos casos.
 * @param {string} clave
 * @param {string} claveHash
 * @returns {Promise<boolean>}
 */
export async function compararClave(clave, claveHash) {
  const dentroDelLimite = Buffer.byteLength(clave, 'utf8') <= BYTES_MAXIMOS
  const coincide = await bcrypt.compare(clave, claveHash)
  return dentroDelLimite && coincide
}
