import ErrorDeNegocio from '../modelo/ErrorDeNegocio.js'

export default class ServicioAutenticacionApi {
  #repositorio
  #dominioCorreo

  constructor(repositorio, dominioCorreo) {
    if (typeof dominioCorreo !== 'string' || !dominioCorreo.trim() || /[\s@]/.test(dominioCorreo.trim())) {
      throw new TypeError('El dominio institucional debe ser un texto válido sin espacios ni arrobas')
    }
    this.#repositorio = repositorio
    this.#dominioCorreo = dominioCorreo.trim().toLowerCase()
  }

  validarCorreoInstitucional(correo) {
    if (typeof correo !== 'string') return false
    const partes = correo.trim().toLowerCase().split('@')
    return !/\s/.test(correo.trim()) && partes.length === 2 && partes[0].length > 0 && partes[1] === this.#dominioCorreo
  }

  registrar(datos) {
    if (!this.validarCorreoInstitucional(datos?.correoInstitucional)) throw new ErrorDeNegocio('R8', 'Usa un correo del dominio institucional para registrarte')
    return this.#repositorio.registrarCuenta(datos)
  }

  iniciarSesion(correo, clave) {
    if (!this.validarCorreoInstitucional(correo)) throw new ErrorDeNegocio('R8', 'Usa tu correo del dominio institucional para iniciar sesión')
    return this.#repositorio.iniciarSesion(correo, clave)
  }

  cerrarSesion() {
    this.#repositorio.cerrarSesion()
  }

  toJSON() {
    return { dominioCorreo: this.#dominioCorreo }
  }
}
