/** Representa una materia perteneciente a un programa académico. */
export default class Materia {
  #id
  #codigo
  #nombre
  #programa

  /**
   * Crea una materia y la vincula con su programa.
   * @param {object} datos Datos de la materia.
   * @param {string} datos.codigo Código de la materia.
   * @param {string} datos.nombre Nombre de la materia.
   * @param {import('./Programa.js').default} datos.programa Programa asociado.
   */
  constructor({ codigo, nombre, programa }) {
    this.#id = crypto.randomUUID()
    this.#codigo = codigo
    this.#nombre = nombre
    this.#programa = programa
  }

  /**
   * Consulta el identificador de la materia.
   * @returns {string} Identificador único.
   */
  getId() {
    return this.#id
  }

  /**
   * Consulta el código de la materia.
   * @returns {string} Código de la materia.
   */
  getCodigo() {
    return this.#codigo
  }

  /**
   * Consulta el nombre de la materia.
   * @returns {string} Nombre de la materia.
   */
  getNombre() {
    return this.#nombre
  }

  /**
   * Consulta el programa al que pertenece la materia.
   * @returns {import('./Programa.js').default} Programa asociado.
   */
  getPrograma() {
    return this.#programa
  }

  /**
   * Convierte la materia en datos con la referencia al programa por identificador.
   * @returns {{id: string, codigo: string, nombre: string, programaId: string}} Datos persistibles.
   */
  toJSON() {
    return {
      id: this.#id,
      codigo: this.#codigo,
      nombre: this.#nombre,
      programaId: this.#programa.getId(),
    }
  }

  /**
   * Reconstruye una materia resolviendo su programa mediante el contexto.
   * @param {{id: string, codigo: string, nombre: string, programaId: string}} datos Datos guardados.
   * @param {{buscarPrograma: function(string): import('./Programa.js').default}} contexto Resolución de referencias.
   * @returns {Materia} Instancia reconstruida con su programa.
   */
  static desdeJSON(datos, contexto) {
    const materia = new Materia({
      codigo: datos.codigo,
      nombre: datos.nombre,
      programa: contexto.buscarPrograma(datos.programaId),
    })
    materia.#id = datos.id
    return materia
  }
}
