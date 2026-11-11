/**
 * Error con código de estado HTTP.
 *
 * Los servicios y middlewares lanzan un HttpError cuando algo sale mal
 * (por ejemplo, 404 si el recurso no existe) y el middleware manejarErrores
 * lo convierte en una respuesta JSON: { mensaje, errores?, regla? }.
 */
export class HttpError extends Error {
  /**
   * @param {number} status Código de estado HTTP.
   * @param {string} mensaje Explicación en español para quien consume la API.
   * @param {string[]} [errores] Detalle de cada dato inválido, si aplica.
   * @param {string} [regla] Regla de negocio incumplida (R1 a R10), si aplica.
   */
  constructor(status, mensaje, errores, regla) {
    super(mensaje)
    this.name = 'HttpError'
    this.status = status
    this.errores = errores
    this.regla = regla
  }
}
