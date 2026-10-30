// Registra y autentica cuentas institucionales con contraseñas resumidas.
import ErrorDeNegocio from '../modelo/ErrorDeNegocio.js'
import Estudiante from '../modelo/Estudiante.js'

/** Registra y autentica usuarios mediante el repositorio y el dominio institucional. */
export default class ServicioAutenticacion {
  #repositorio
  #dominioCorreo
  /** @type {string[]|null} Sedes admitidas, si se restringe el registro. */
  #sedes

  /**
   * Configura la persistencia y el dominio admitido para los correos.
   * @param {object} repositorio Repositorio de usuarios, credenciales y sesión actual.
   * @param {string} dominioCorreo Dominio institucional sin arroba.
   * @param {string[]|null} [sedes=null] Lista opcional de sedes admitidas.
   * @throws {TypeError} Si el dominio está vacío o contiene espacios o arrobas.
   */
  constructor(repositorio, dominioCorreo, sedes = null) {
    if (
      typeof dominioCorreo !== 'string' ||
      dominioCorreo.trim() === '' ||
      /[\s@]/.test(dominioCorreo.trim())
    ) {
      throw new TypeError('El dominio institucional debe ser un texto válido sin espacios ni arrobas.')
    }

    this.#repositorio = repositorio
    this.#dominioCorreo = dominioCorreo.trim().toLowerCase()
    this.#sedes = sedes
  }

  /**
   * Comprueba que el correo tenga una sola arroba y el dominio institucional exacto.
   * @param {string} correo Correo que se valida.
   * @returns {boolean} Verdadero si el correo cumple la regla R8.
   */
  validarCorreoInstitucional(correo) {
    if (typeof correo !== 'string') return false

    const correoNormalizado = correo.trim().toLowerCase()
    const partes = correoNormalizado.split('@')

    return (
      !/\s/.test(correoNormalizado) &&
      partes.length === 2 &&
      partes[0].length > 0 &&
      partes[1] === this.#dominioCorreo
    )
  }

  /**
   * Registra un estudiante con correo institucional único y contraseña resumida.
   * @param {object} datos Datos del nuevo estudiante.
   * @param {string} datos.nombre Nombre del estudiante.
   * @param {string} datos.correoInstitucional Correo institucional.
   * @param {string} datos.clave Contraseña de la cuenta.
   * @param {number} datos.semestre Semestre que cursa.
   * @param {string} datos.sede Sede del estudiante.
   * @param {import('../modelo/Programa.js').default} datos.programa Programa académico.
   * @returns {Promise<Estudiante>} Estudiante guardado sin iniciar una sesión.
   * @throws {ErrorDeNegocio} Con código R8 si el correo no pertenece al dominio institucional.
   * @throws {TypeError} Si los datos o la contraseña no tienen el formato requerido.
   * @throws {Error} Si ya existe una cuenta con el correo indicado.
   */
  async registrar(datos) {
    if (datos === null || typeof datos !== 'object') {
      throw new TypeError('Los datos de registro deben ser un objeto.')
    }

    const { nombre, correoInstitucional, clave, semestre, programa, sede } = datos

    if (!this.validarCorreoInstitucional(correoInstitucional)) {
      throw new ErrorDeNegocio('R8', 'Usa un correo del dominio institucional para registrarte.')
    }

    if (this.#sedes !== null && !this.#sedes.includes(sede)) {
      throw new TypeError('Selecciona una sede válida.')
    }

    const correoNormalizado = correoInstitucional.trim().toLowerCase()
    const existente = await this.#repositorio.buscarUsuarioPorCorreo(correoNormalizado)

    if (existente) {
      throw new Error('Ya existe una cuenta registrada con este correo institucional.')
    }

    const claveHash = await this.#calcularHash(clave)
    const estudiante = new Estudiante({
      nombre,
      correoInstitucional: correoNormalizado,
      semestre,
      programa,
      sede,
    })

    await this.#repositorio.guardarUsuario(estudiante, claveHash)
    return estudiante
  }

  /**
   * Verifica las credenciales y guarda el identificador de la sesión actual.
   * @param {string} correo Correo institucional de la cuenta.
   * @param {string} clave Contraseña introducida.
   * @returns {Promise<import('../modelo/Usuario.js').default>} Usuario autenticado.
   * @throws {ErrorDeNegocio} Con código R8 si el correo no pertenece al dominio institucional.
   * @throws {TypeError} Si la contraseña no es un texto no vacío.
   * @throws {Error} Si el correo o la contraseña no corresponden a una cuenta.
   */
  async iniciarSesion(correo, clave) {
    if (!this.validarCorreoInstitucional(correo)) {
      throw new ErrorDeNegocio('R8', 'Usa tu correo del dominio institucional para iniciar sesión.')
    }

    const correoNormalizado = correo.trim().toLowerCase()
    const claveHash = await this.#calcularHash(clave)
    const usuario = await this.#repositorio.buscarUsuarioPorCorreo(correoNormalizado)

    if (!usuario || this.#repositorio.obtenerClaveHash(usuario.getId()) !== claveHash) {
      throw new Error('El correo o la contraseña no son correctos.')
    }

    this.#repositorio.guardarSesionActual(usuario.getId())
    return usuario
  }

  /**
   * Elimina el identificador de la sesión autenticada.
   * @returns {void}
   */
  cerrarSesion() {
    this.#repositorio.guardarSesionActual(null)
  }

  /**
   * Serializa únicamente la configuración, sin credenciales ni repositorio.
   * @returns {{dominioCorreo: string}} Configuración del servicio.
   */
  toJSON() {
    return { dominioCorreo: this.#dominioCorreo }
  }

  /**
   * Reconstruye el servicio utilizando el repositorio proporcionado por el contexto.
   * @param {{dominioCorreo: string}} datos Configuración guardada.
   * @param {{repositorio: object}} contexto Repositorio que utilizará el servicio.
   * @returns {ServicioAutenticacion} Servicio reconstruido.
   * @throws {TypeError} Si el dominio guardado no es válido.
   */
  static desdeJSON(datos, contexto) {
    return new ServicioAutenticacion(contexto.repositorio, datos.dominioCorreo)
  }

  /**
   * Calcula el resumen hexadecimal de una contraseña.
   * @param {string} clave Contraseña que se resume.
   * @returns {Promise<string>} Hash SHA-256 hexadecimal.
   * @throws {TypeError} Si la contraseña no es un texto no vacío.
   */
  async #calcularHash(clave) {
    if (typeof clave !== 'string' || clave.length === 0) {
      throw new TypeError('La contraseña debe ser un texto no vacío.')
    }

    // Hash SHA-256 para esta demo académica.
    const datos = new TextEncoder().encode(clave)
    const resumen = await crypto.subtle.digest('SHA-256', datos)

    return Array.from(new Uint8Array(resumen), (octeto) => octeto.toString(16).padStart(2, '0')).join('')
  }
}
