/** Representa un programa académico de la institución. */
export default class Programa {
  #id
  #nombre
  #facultad

  /**
   * Crea un programa con un identificador único.
   * @param {object} datos Datos del programa.
   * @param {string} datos.nombre Nombre del programa.
   * @param {string} datos.facultad Facultad a la que pertenece.
   */
  constructor({ nombre, facultad }) {
    this.#id = crypto.randomUUID()
    this.#nombre = nombre
    this.#facultad = facultad
  }

  /**
   * Consulta el identificador del programa.
   * @returns {string} Identificador único.
   */
  getId() {
    return this.#id
  }

  /**
   * Consulta el nombre del programa.
   * @returns {string} Nombre del programa.
   */
  getNombre() {
    return this.#nombre
  }

  /**
   * Consulta la facultad del programa.
   * @returns {string} Nombre de la facultad.
   */
  getFacultad() {
    return this.#facultad
  }

  /**
   * Convierte el programa en datos aptos para persistencia.
   * @returns {{id: string, nombre: string, facultad: string}} Datos del programa.
   */
  toJSON() {
    return {
      id: this.#id,
      nombre: this.#nombre,
      facultad: this.#facultad,
    }
  }

  /**
   * Reconstruye un programa y conserva su identificador persistido.
   * @param {{id: string, nombre: string, facultad: string}} datos Datos guardados.
   * @param {object} [_contexto] Contexto de reconstrucción; no requiere resolver referencias.
   * @returns {Programa} Instancia reconstruida.
   */
  static desdeJSON(datos, _contexto) {
    const programa = new Programa(datos)
    programa.#id = datos.id
    return programa
  }
}
