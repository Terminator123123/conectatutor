import ErrorDeNegocio from './ErrorDeNegocio.js'

/** Calificación de una sesión, con puntaje sujeto a la regla R7. */
export default class Calificacion {
  #id
  #puntaje
  #resena
  #fecha

  /**
   * Crea una calificación con identificador y fecha actuales.
   * @param {Object} datos Datos de la calificación.
   * @param {number} datos.puntaje Entero de 1 a 5.
   * @param {string} [datos.resena=''] Reseña del estudiante.
   * @throws {ErrorDeNegocio} Con código R7 si el puntaje no es un entero de 1 a 5.
   */
  constructor({ puntaje, resena = '' }) {
    if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) {
      throw new ErrorDeNegocio('R7', 'El puntaje debe ser un número entero entre 1 y 5.')
    }

    this.#id = crypto.randomUUID()
    this.#puntaje = puntaje
    this.#resena = resena
    this.#fecha = new Date()
  }

  /**
   * Obtiene el identificador de la calificación.
   * @returns {string} Identificador único.
   */
  getId() {
    return this.#id
  }

  /**
   * Obtiene el puntaje validado.
   * @returns {number} Entero de 1 a 5.
   */
  getPuntaje() {
    return this.#puntaje
  }

  /**
   * Obtiene la reseña del estudiante.
   * @returns {string} Texto de la reseña.
   */
  getResena() {
    return this.#resena
  }

  /**
   * Obtiene una copia de la fecha para preservar el estado privado.
   * @returns {Date} Fecha de creación de la calificación.
   */
  getFecha() {
    return new Date(this.#fecha)
  }

  /**
   * Serializa la calificación para guardarla embebida en una sesión.
   * @returns {{id: string, puntaje: number, resena: string, fecha: string}} Datos con fecha ISO.
   */
  toJSON() {
    return {
      id: this.#id,
      puntaje: this.#puntaje,
      resena: this.#resena,
      fecha: this.#fecha.toISOString(),
    }
  }

  /**
   * Reconstruye una calificación conservando su identificador y fecha.
   * @param {{id: string, puntaje: number, resena: string, fecha: string}} datos Calificación serializada.
   * @param {object} [_contexto] Contexto de reconstrucción; no requiere resolver referencias.
   * @returns {Calificacion} Instancia reconstruida.
   * @throws {ErrorDeNegocio} Con código R7 si el puntaje guardado no es válido.
   */
  static desdeJSON(datos, _contexto) {
    const calificacion = new Calificacion(datos)
    calificacion.#id = datos.id
    calificacion.#fecha = new Date(datos.fecha)
    return calificacion
  }
}
