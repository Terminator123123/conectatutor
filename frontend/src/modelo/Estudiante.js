import Usuario from './Usuario.js'
import PerfilTutor from './PerfilTutor.js'
import Sesion from './Sesion.js'
import ErrorDeNegocio from './ErrorDeNegocio.js'
import { RolUsuario } from './enums.js'

/** Usuario que cursa un programa y puede activar un perfil de tutor propio. */
export default class Estudiante extends Usuario {
  #semestre
  #programa
  #perfilTutor

  /**
   * Crea un estudiante sin perfil de tutor activo.
   * @param {object} datos Datos del estudiante.
   * @param {string} [datos.id] Identificador persistido, si se está reconstruyendo.
   * @param {string} datos.nombre Nombre del estudiante.
   * @param {string} datos.correoInstitucional Correo institucional.
   * @param {number} datos.semestre Semestre que cursa.
   * @param {import('./Programa.js').default} datos.programa Programa académico.
   */
  constructor({ id, nombre, correoInstitucional, semestre, programa }) {
    super({ id, nombre, correoInstitucional })
    this.#semestre = semestre
    this.#programa = programa
    this.#perfilTutor = null
  }

  /**
   * Responde el rol propio de esta subclase.
   * @returns {string} Rol ESTUDIANTE.
   */
  getRol() {
    return RolUsuario.ESTUDIANTE
  }

  /**
   * Obtiene el semestre del estudiante.
   * @returns {number} Semestre registrado.
   */
  getSemestre() {
    return this.#semestre
  }

  /**
   * Obtiene el programa académico del estudiante.
   * @returns {import('./Programa.js').default} Programa que cursa.
   */
  getPrograma() {
    return this.#programa
  }

  /**
   * Obtiene el perfil de tutor, si se ha activado.
   * @returns {PerfilTutor|null} Perfil perteneciente al estudiante.
   */
  getPerfilTutor() {
    return this.#perfilTutor
  }

  /**
   * Comprueba si el estudiante ya cuenta con perfil de tutor.
   * @returns {boolean} Verdadero si existe un perfil propio.
   */
  esTutor() {
    return this.#perfilTutor !== null
  }

  /**
   * Crea el perfil de tutor una sola vez y conserva su relación de pertenencia.
   * @param {string} biografia Presentación del estudiante como tutor.
   * @returns {PerfilTutor} Perfil recién activado o el que ya existía.
   */
  activarPerfilTutor(biografia) {
    if (!this.#perfilTutor) {
      this.#perfilTutor = new PerfilTutor({ estudiante: this, biografia })
    }

    return this.#perfilTutor
  }

  /**
   * Solicita una sesión validando las reglas R1, R2, R3 y R4.
   * @param {PerfilTutor} tutor Perfil del tutor solicitado.
   * @param {import('./Materia.js').default} materia Materia de la sesión.
   * @param {import('./FranjaHoraria.js').default} franja Franja solicitada.
   * @param {Date|string} fecha Fecha de la sesión.
   * @param {string} tema Tema que se desea estudiar.
   * @returns {Sesion} Sesión creada en estado PENDIENTE.
   * @throws {ErrorDeNegocio} Con R1 si se solicita a sí mismo, R2 si no se ofrece la materia,
   * R3 si la franja no está disponible o R4 si el tutor no está verificado.
   */
  solicitarSesion(tutor, materia, franja, fecha, tema) {
    if (tutor.getEstudiante().getId() === this.getId()) {
      throw new ErrorDeNegocio('R1', 'No puedes solicitarte una tutoría a ti mismo.')
    }

    if (!tutor.ofrece(materia)) {
      throw new ErrorDeNegocio('R2', 'El tutor no ofrece la materia solicitada.')
    }

    if (!tutor.estaDisponible(franja)) {
      throw new ErrorDeNegocio('R3', 'La franja solicitada no está disponible con este tutor.')
    }

    if (!tutor.estaVerificado()) {
      throw new ErrorDeNegocio('R4', 'Solo puedes solicitar tutorías a tutores verificados.')
    }

    return new Sesion({ solicitante: this, tutor, materia, franja, fecha, tema })
  }

  /**
   * Serializa el estudiante y la referencia a su programa.
   * La pertenencia del perfil se guarda mediante estudianteId en perfilesTutor.
   * @returns {{id: string, nombre: string, correoInstitucional: string, tipo: string, semestre: number, programaId: string}} Datos persistibles.
   */
  toJSON() {
    return {
      ...super.toJSON(),
      tipo: RolUsuario.ESTUDIANTE,
      semestre: this.#semestre,
      programaId: this.#programa.getId(),
    }
  }

  /**
   * Reconstruye un estudiante antes de cargar la colección de perfiles de tutor.
   * PerfilTutor.desdeJSON restablece después la composición mediante activarPerfilTutor.
   * @param {{id: string, nombre: string, correoInstitucional: string, semestre: number, programaId: string}} datos Datos persistidos.
   * @param {{buscarPrograma: function(string): import('./Programa.js').default}} contexto Resolución de programas.
   * @returns {Estudiante} Instancia reconstruida, todavía sin su perfil de tutor.
   */
  static desdeJSON(datos, contexto) {
    return new Estudiante({
      id: datos.id,
      nombre: datos.nombre,
      correoInstitucional: datos.correoInstitucional,
      semestre: datos.semestre,
      programa: contexto.buscarPrograma(datos.programaId),
    })
  }
}
