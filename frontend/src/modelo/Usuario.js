/** Base abstracta de los usuarios de la plataforma. */
export default class Usuario {
  #id
  #nombre
  #correoInstitucional

  /**
   * Inicializa los datos comunes de una subclase de usuario.
   * @param {object} [datos={}] Datos del usuario.
   * @param {string} [datos.id] Identificador persistido; se genera al crear un usuario.
   * @param {string} datos.nombre Nombre del usuario.
   * @param {string} datos.correoInstitucional Correo institucional.
   * @throws {Error} Si se intenta instanciar Usuario directamente.
   */
  constructor({ id = crypto.randomUUID(), nombre, correoInstitucional } = {}) {
    if (new.target === Usuario) {
      throw new Error('Usuario es abstracta')
    }

    this.#id = id
    this.#nombre = nombre
    this.#correoInstitucional = correoInstitucional
  }

  /**
   * Obtiene el identificador del usuario.
   * @returns {string} Identificador único.
   */
  getId() {
    return this.#id
  }

  /**
   * Obtiene el nombre del usuario.
   * @returns {string} Nombre registrado.
   */
  getNombre() {
    return this.#nombre
  }

  /**
   * Obtiene el correo institucional del usuario.
   * @returns {string} Correo registrado.
   */
  getCorreo() {
    return this.#correoInstitucional
  }

  /**
   * Exige que cada subclase determine su rol.
   * @returns {string} Rol implementado por la subclase.
   * @throws {Error} Si la subclase no sobrescribe este método.
   */
  getRol() {
    throw new Error('Debe implementarse en la subclase')
  }

  /**
   * Serializa los atributos comunes sin almacenar un atributo de rol.
   * @returns {{id: string, nombre: string, correoInstitucional: string}} Datos comunes.
   */
  toJSON() {
    return {
      id: this.#id,
      nombre: this.#nombre,
      correoInstitucional: this.#correoInstitucional,
    }
  }

  /**
   * Reconstruye mediante la clase concreta sobre la que se invoca el método.
   * @param {{id: string, nombre: string, correoInstitucional: string}} datos Datos persistidos.
   * @param {object} [_contexto] Contexto de reconstrucción, sin referencias comunes que resolver.
   * @returns {Usuario} Instancia de la subclase concreta.
   * @throws {Error} Si se invoca directamente sobre la clase abstracta Usuario.
   */
  static desdeJSON(datos, _contexto) {
    return new this(datos)
  }
}
