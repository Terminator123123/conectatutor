import Usuario from './Usuario.js'
import { RolUsuario } from './enums.js'

/** Usuario responsable de verificar los perfiles de tutor. */
export default class Administrador extends Usuario {
  #dependencia

  /**
   * Crea un administrador con sus datos comunes y dependencia.
   * @param {object} datos Datos del administrador.
   * @param {string} [datos.id] Identificador persistido, si se está reconstruyendo.
   * @param {string} datos.nombre Nombre del administrador.
   * @param {string} datos.correoInstitucional Correo institucional.
   * @param {string} datos.dependencia Dependencia a la que pertenece.
   */
  constructor({ id, nombre, correoInstitucional, dependencia }) {
    super({ id, nombre, correoInstitucional })
    this.#dependencia = dependencia
  }

  /**
   * Obtiene la dependencia del administrador.
   * @returns {string} Dependencia registrada.
   */
  getDependencia() {
    return this.#dependencia
  }

  /**
   * Responde el rol propio de esta subclase.
   * @returns {string} Rol ADMINISTRADOR.
   */
  getRol() {
    return RolUsuario.ADMINISTRADOR
  }

  /**
   * Delega la aprobación en el perfil de tutor.
   * @param {import('./PerfilTutor.js').default} perfil Perfil que se verifica.
   * @returns {void}
   */
  verificarTutor(perfil) {
    perfil.marcarVerificado()
  }

  /**
   * Delega el rechazo y su motivo en el perfil de tutor.
   * @param {import('./PerfilTutor.js').default} perfil Perfil que se rechaza.
   * @param {string} motivo Explicación del rechazo.
   * @returns {void}
   */
  rechazarTutor(perfil, motivo) {
    perfil.marcarRechazado(motivo)
  }

  /**
   * Serializa el administrador con el discriminador de su subclase.
   * @returns {{id: string, nombre: string, correoInstitucional: string, tipo: string, dependencia: string}} Datos persistibles.
   */
  toJSON() {
    return {
      ...super.toJSON(),
      tipo: RolUsuario.ADMINISTRADOR,
      dependencia: this.#dependencia,
    }
  }

  /**
   * Reconstruye un administrador conservando su identificador.
   * @param {{id: string, nombre: string, correoInstitucional: string, dependencia: string}} datos Datos persistidos.
   * @param {object} [_contexto] Contexto de reconstrucción; no requiere resolver referencias.
   * @returns {Administrador} Instancia reconstruida.
   */
  static desdeJSON(datos, _contexto) {
    return new Administrador(datos)
  }
}
