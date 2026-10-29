/** Identifica una regla de negocio incumplida mediante su código y mensaje. */
export default class ErrorDeNegocio extends Error {
  #codigo

  /**
   * Crea un error con un mensaje preparado para mostrarse al usuario.
   * @param {string} codigo Código de la regla incumplida, de R1 a R10.
   * @param {string} mensaje Explicación en español de la regla incumplida.
   */
  constructor(codigo, mensaje) {
    super(mensaje)
    this.name = 'ErrorDeNegocio'
    this.#codigo = codigo
  }

  /**
   * Consulta la regla de negocio incumplida.
   * @returns {string} Código de la regla.
   */
  getCodigo() {
    return this.#codigo
  }

  /**
   * Convierte el error en datos aptos para persistencia.
   * @returns {{codigo: string, mensaje: string}} Código y mensaje del error.
   */
  toJSON() {
    return {
      codigo: this.#codigo,
      mensaje: this.message,
    }
  }

  /**
   * Reconstruye un error conservando su código y mensaje.
   * @param {{codigo: string, mensaje: string}} datos Datos guardados.
   * @param {object} [_contexto] Contexto de reconstrucción; no requiere resolver referencias.
   * @returns {ErrorDeNegocio} Instancia reconstruida.
   */
  static desdeJSON(datos, _contexto) {
    return new ErrorDeNegocio(datos.codigo, datos.mensaje)
  }
}
