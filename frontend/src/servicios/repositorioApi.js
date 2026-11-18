import { crearClienteApi, ErrorApi, sesionDelToken } from './api.js'
import { fechaEnColombia } from './agenda.js'
import { materiaDesdeApi, perfilDesdeApi, programaDesdeApi, reprogramacionDesdeApi, sesionDesdeApi, usuarioDesdeApi } from './mapeoApi.js'
import { EstadoSesion, EstadoVerificacion, RolUsuario } from '../modelo/enums.js'

const esIdPersistido = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
const idValido = (id) => {
  if (!esIdPersistido(id)) throw new TypeError('El identificador de la API no es válido')
  return id
}
const sinPermiso = () => new ErrorApi('No tienes permiso para consultar o modificar datos de otra cuenta', { status: 403 })

export function crearRepositorioApi({ cliente = crearClienteApi() } = {}) {
  const pedir = cliente.peticion
  let revisionAcceso = 0
  // Materias ya leídas del catálogo, para convertir sesiones si una consulta posterior falla
  const materiasLeidas = new Map()

  function cerrarSesion() {
    revisionAcceso += 1
    cliente.cerrarSesion()
  }

  async function cuentaPropia() {
    return (await pedir('/auth/yo')).usuario
  }

  async function exigirCuenta(id) {
    const cuenta = await cuentaPropia()
    if (id !== undefined && cuenta.id !== id) throw sinPermiso()
    return cuenta
  }

  async function conPerfilPropio(datos) {
    if (datos.tipo === RolUsuario.ESTUDIANTE && datos.perfilTutor) {
      const perfil = await pedir('/tutores/mi-perfil')
      return perfilDesdeApi({ ...perfil, estudiante: datos }).getEstudiante()
    }
    return usuarioDesdeApi(datos)
  }

  async function autenticar(ruta, datos) {
    const revision = ++revisionAcceso
    const resultado = await pedir(ruta, { metodo: 'POST', datos, autenticada: false })
    if (revision !== revisionAcceso) throw new ErrorApi('La solicitud de acceso ya no está vigente. Vuelve a iniciar sesión')
    usuarioDesdeApi(resultado.usuario)
    cliente.guardarToken(resultado.token)
    const usuario = await conPerfilPropio(resultado.usuario)
    if (revision !== revisionAcceso) throw new ErrorApi('La solicitud de acceso ya no está vigente. Vuelve a iniciar sesión')
    return usuario
  }

  async function convertirSesiones(datos, respaldo = []) {
    if (datos.length === 0) return []
    try {
      const catalogo = await pedir('/materias')
      const conocidas = new Set(catalogo.map((materia) => materia.id))
      const faltantes = [...new Set(datos.map((sesion) => sesion.materia.id))].filter((id) => !conocidas.has(id))
      // Una materia retirada del catálogo sigue perteneciendo a sus sesiones históricas
      const retiradas = await Promise.all(faltantes.map((id) => pedir(`/materias/${idValido(id)}`, { autenticada: false })))
      const materias = [...catalogo, ...retiradas].map((materia) => materiaDesdeApi(materia))
      for (const materia of materias) materiasLeidas.set(materia.getId(), materia)
      return datos.map((sesion) => sesionDesdeApi(sesion, { materias }))
    } catch (error) {
      // Una mutación ya confirmada no debe presentarse como fallida porque falló esta consulta auxiliar:
      // se convierte con las materias ya conocidas y solo se propaga el error si falta alguna
      const disponibles = new Map(materiasLeidas)
      for (const materia of respaldo) disponibles.set(materia.getId(), materia)
      if (!datos.every((sesion) => disponibles.has(sesion.materia?.id))) throw error
      return datos.map((sesion) => sesionDesdeApi(sesion, { materias: [...disponibles.values()] }))
    }
  }

  async function convertirSesion(datos, respaldo) {
    return (await convertirSesiones([datos], respaldo))[0]
  }

  async function leerSesion(id) {
    return pedir(`/sesiones/${idValido(id)}`)
  }

  return {
    async listarProgramas() {
      return (await pedir('/programas', { autenticada: false })).map(programaDesdeApi)
    },

    async listarMaterias(programaId, { incluirInactivas = false } = {}) {
      const datos = await pedir('/materias', { parametros: { programa: programaId, incluirInactivas } })
      return datos.map((materia) => materiaDesdeApi(materia))
    },

    async guardarMateria(materia) {
      const datos = { codigo: materia.getCodigo(), nombre: materia.getNombre(), programa: materia.getPrograma().getId() }
      const existe = esIdPersistido(materia.getId())
      return materiaDesdeApi(await pedir(existe ? `/materias/${materia.getId()}` : '/materias', { metodo: existe ? 'PUT' : 'POST', datos }))
    },

    async desactivarMateria(id) {
      const datos = await pedir(`/materias/${idValido(id)}`, { metodo: 'DELETE' })
      return materiaDesdeApi(datos)
    },

    async listarTutoresVerificados({ materiaId, programaId, sede, dia, precioMaximo, soloGratuitas, calificacionMinima } = {}) {
      const datos = await pedir('/tutores', { parametros: { materia: materiaId, programa: programaId, sede, dia, precioMaximo, soloGratuitas, calificacionMinima } })
      return datos.map((perfil) => perfilDesdeApi(perfil))
    },

    async obtenerPerfilTutor(id) {
      try {
        return perfilDesdeApi(await pedir(`/tutores/${idValido(id)}`))
      } catch (error) {
        if (error.status === 404) return null
        throw error
      }
    },

    async obtenerResumenTutor(id) {
      const datos = await pedir(`/tutores/${idValido(id)}`)
      return {
        perfil: perfilDesdeApi(datos), promedio: datos.promedio, totalCalificaciones: datos.totalCalificaciones,
        tutoriasCompletadas: datos.tutoriasCompletadas, resenas: datos.resenas,
      }
    },

    async obtenerOcupacionTutor(id) {
      return pedir(`/tutores/${idValido(id)}/ocupacion`)
    },

    async listarPerfilesPendientes() {
      return (await pedir('/coordinacion/perfiles')).map((perfil) => perfilDesdeApi(perfil))
    },

    async listarPerfilesTutor() {
      const listas = await Promise.all(Object.values(EstadoVerificacion).map((estado) => pedir('/coordinacion/perfiles', { parametros: { estado } })))
      return listas.flat().map((perfil) => perfilDesdeApi(perfil))
    },

    async guardarPerfilTutor(perfil) {
      const cuenta = await exigirCuenta()
      let datos
      if (cuenta.tipo === RolUsuario.ADMINISTRADOR) {
        const estado = perfil.getEstadoVerificacion()
        const ruta = `/coordinacion/perfiles/${idValido(perfil.getId())}`
        if (estado === EstadoVerificacion.VERIFICADO) datos = await pedir(`${ruta}/verificar`, { metodo: 'PATCH' })
        else if (estado === EstadoVerificacion.RECHAZADO) datos = await pedir(`${ruta}/rechazar`, { metodo: 'PATCH', datos: { motivo: perfil.getMotivoRechazo() } })
        else throw new ErrorApi('Coordinación solo puede verificar o rechazar el perfil', { status: 409 })
      } else {
        if (perfil.getEstudiante().getId() !== cuenta.id) throw sinPermiso()
        datos = await pedir('/tutores/mi-perfil', {
          metodo: 'PUT', datos: {
            biografia: perfil.getBiografia(), tarifaHora: perfil.getTarifaHora(),
            materias: perfil.getMaterias().map((materia) => materia.getId()), disponibilidad: perfil.getDisponibilidad().map((franja) => franja.toJSON()),
          },
        })
        // El dueño se arma con su cuenta completa: así la pantalla puede mostrar lo guardado sin otra lectura
        return perfilDesdeApi({ ...datos, estudiante: cuenta })
      }
      return perfilDesdeApi(datos)
    },

    async obtenerSesion(id) {
      let datos
      try {
        datos = await leerSesion(id)
      } catch (error) {
        if (error.status === 404) return null
        throw error
      }
      return convertirSesion(datos)
    },

    async listarSesiones() {
      return convertirSesiones(await pedir('/sesiones'))
    },

    async listarSesionesDe(usuarioId) {
      await exigirCuenta(usuarioId)
      return convertirSesiones(await pedir('/sesiones'))
    },

    async listarSesionesDelTutor(perfilId) {
      idValido(perfilId)
      const cuenta = await exigirCuenta()
      if (cuenta.tipo !== RolUsuario.ADMINISTRADOR && cuenta.perfilTutor?.id !== perfilId) throw sinPermiso()
      const datos = await pedir('/sesiones', { parametros: { papel: 'TUTOR' } })
      return convertirSesiones(datos.filter((sesion) => sesion.tutor.id === perfilId))
    },

    // `encuesta` ({ motivos, otro }) acompaña una cancelación: las razones marcadas se cuentan en los reportes.
    async guardarSesion(sesion, { encuesta } = {}) {
      if (!esIdPersistido(sesion.getId())) {
        return convertirSesion(await pedir('/sesiones', {
          metodo: 'POST', datos: {
            tutor: sesion.getTutor().getId(), materia: sesion.getMateria().getId(),
            fecha: fechaEnColombia(sesion.getFecha()), franja: sesion.getFranja().toJSON(), tema: sesion.getTema(),
          },
        }), [sesion.getMateria()])
      }
      const actual = await leerSesion(sesion.getId())
      const franja = sesion.getFranja().toJSON()
      const mismoHorario = actual.fecha === fechaEnColombia(sesion.getFecha()) && ['dia', 'horaInicio', 'horaFin'].every((campo) => actual.franja[campo] === franja[campo])
      if (!mismoHorario || actual.tema !== sesion.getTema() || actual.materia.id !== sesion.getMateria().getId()
        || actual.tutor.id !== sesion.getTutor().getId() || actual.solicitante.id !== sesion.getSolicitante().getId()) {
        throw new ErrorApi('Para cambiar el horario debes proponer una reprogramación; los demás datos de la solicitud se conservan', { status: 409 })
      }
      const ruta = `/sesiones/${sesion.getId()}`
      const estado = sesion.getEstado()
      if (estado !== actual.estado) {
        if (sesion.getCalificacion()) throw new ErrorApi('Finaliza la sesión antes de guardar su calificación', { status: 409 })
        const acciones = {
          [EstadoSesion.CONFIRMADA]: 'confirmar', [EstadoSesion.RECHAZADA]: 'rechazar',
          [EstadoSesion.CANCELADA]: 'cancelar', [EstadoSesion.FINALIZADA]: 'finalizar',
        }
        const accion = acciones[estado]
        if (!accion) throw new ErrorApi('La transición de la sesión no es válida', { status: 409, regla: 'R5' })
        return convertirSesion(await pedir(`${ruta}/${accion}`, { metodo: 'PATCH', datos: accion === 'cancelar' && encuesta ? { motivos: encuesta.motivos, ...(encuesta.motivos.includes('OTRO') ? { motivo: encuesta.otro.trim() } : {}) }
          : ['rechazar', 'cancelar'].includes(accion) ? { motivo: sesion.getMotivo() } : undefined }), [sesion.getMateria()])
      }
      const nota = sesion.getCalificacion()
      if (nota && !actual.calificacion) {
        const guardada = await pedir(`${ruta}/calificacion`, { metodo: 'POST', datos: { puntaje: nota.getPuntaje(), resena: nota.getResena() } })
        return convertirSesion(guardada, [sesion.getMateria()])
      }
      if (nota?.getPuntaje() !== actual.calificacion?.puntaje || nota?.getResena() !== actual.calificacion?.resena) {
        throw new ErrorApi('La calificación ya guardada no se puede modificar', { status: 409, regla: 'R6' })
      }
      return convertirSesion(actual, [sesion.getMateria()])
    },

    async obtenerReprogramacion(id) {
      return reprogramacionDesdeApi((await leerSesion(id)).reprogramacion)
    },

    async proponerReprogramacion(id, { fecha, franja, motivo }) {
      const datos = await pedir(`/sesiones/${idValido(id)}/reprogramacion`, {
        metodo: 'PUT', datos: { fecha: fecha instanceof Date ? fechaEnColombia(fecha) : fecha, franja: franja.toJSON?.() ?? franja, motivo },
      })
      return reprogramacionDesdeApi(datos.reprogramacion)
    },

    async responderReprogramacion(id, acepta) {
      if (typeof acepta !== 'boolean') throw new TypeError('Indica si aceptas la propuesta')
      return convertirSesion(await pedir(`/sesiones/${idValido(id)}/reprogramacion`, { metodo: 'PATCH', datos: { acepta } }))
    },

    async listarFavoritos(usuarioId) {
      await exigirCuenta(usuarioId)
      return (await pedir('/favoritos')).map((perfil) => perfil.id)
    },

    async alternarFavorito(usuarioId, perfilId) {
      await exigirCuenta(usuarioId)
      idValido(perfilId)
      const favoritos = await pedir('/favoritos')
      return (await pedir(`/favoritos/${perfilId}`, { metodo: favoritos.some((perfil) => perfil.id === perfilId) ? 'DELETE' : 'PUT' })).map((perfil) => perfil.id)
    },

    async quitarFavorito(usuarioId, perfilId) {
      await exigirCuenta(usuarioId)
      return (await pedir(`/favoritos/${idValido(perfilId)}`, { metodo: 'DELETE' })).map((perfil) => perfil.id)
    },

    // Campana (RQF022): avisos guardados por la API y recordatorios de las sesiones.
    async listarNotificaciones() {
      return pedir('/notificaciones')
    },

    async marcarNotificacionesLeidas() {
      await pedir('/notificaciones/leidas', { metodo: 'PATCH' })
    },

    async obtenerMetricas() {
      return pedir('/coordinacion/metricas')
    },

    async obtenerUsuario(id) {
      return conPerfilPropio(await exigirCuenta(id))
    },

    // Primer ingreso de una cuenta creada por Coordinación (RQF001, RQF002, RQNF009).
    async completarPrimerAcceso({ claveNueva, quiereSerTutor, aceptaTratamientoDatos }) {
      const { usuario } = await pedir('/auth/yo/primer-acceso', {
        metodo: 'POST', datos: { claveNueva, quiereSerTutor: quiereSerTutor === true, aceptaTratamientoDatos: aceptaTratamientoDatos === true },
      })
      return conPerfilPropio(usuario)
    },

    // Coordinación crea la cuenta de un estudiante; la contraseña inicial es su documento.
    async crearCuentaEstudiante({ nombre, correoInstitucional, documento, semestre, sede, programa }) {
      const { usuario } = await pedir('/coordinacion/cuentas', {
        metodo: 'POST', datos: { nombre, correoInstitucional, documento, semestre: Number(semestre), sede, programa },
      })
      return usuarioDesdeApi(usuario)
    },

    async cambiarClave(claveActual, claveNueva) {
      await pedir('/auth/yo/clave', { metodo: 'PUT', datos: { claveActual, claveNueva } })
    },

    async guardarFoto(imagen) {
      await pedir('/auth/yo/foto', { metodo: 'PUT', datos: { imagen } })
    },

    async quitarFoto() {
      await pedir('/auth/yo/foto', { metodo: 'DELETE' })
    },

    async guardarUsuario(usuario) {
      await exigirCuenta(usuario.getId())
      const datos = { nombre: usuario.getNombre() }
      if (usuario.getRol() === RolUsuario.ESTUDIANTE) Object.assign(datos, { semestre: usuario.getSemestre(), sede: usuario.getSede(), programa: usuario.getPrograma().getId() })
      return conPerfilPropio((await pedir('/auth/yo', { metodo: 'PATCH', datos })).usuario)
    },

    async registrarCuenta(datos) {
      return autenticar('/auth/registro', {
        nombre: datos.nombre, correoInstitucional: datos.correoInstitucional, clave: datos.clave, semestre: datos.semestre,
        sede: datos.sede, programa: datos.programa?.getId?.() ?? datos.programa,
        quiereSerTutor: datos.quiereSerTutor === true, aceptaTratamientoDatos: datos.aceptaTratamientoDatos === true,
      })
    },

    async iniciarSesion(correoInstitucional, clave) {
      return autenticar('/auth/ingreso', { correoInstitucional, clave })
    },

    // Recuperación de acceso por correo: no usa ni envía la sesión actual.
    async pedirRecuperacion(correoInstitucional) {
      await pedir('/auth/recuperacion', { metodo: 'POST', datos: { correoInstitucional }, autenticada: false })
    },

    async comprobarEnlaceRecuperacion(token) {
      await pedir('/auth/recuperacion/comprobar', { metodo: 'POST', datos: { token }, autenticada: false })
    },

    async restablecerClave(token, clave) {
      await pedir('/auth/recuperacion/restablecer', { metodo: 'POST', datos: { token, clave }, autenticada: false })
    },

    async obtenerSesionActual() {
      const token = cliente.obtenerToken()
      if (!token) return null
      const revision = cliente.revisionSesion?.()
      try {
        const usuario = await conPerfilPropio(await cuentaPropia())
        // Una renovación cambia el token pero no la sesión; un cierre o un ingreso distinto sí la cambian.
        const actual = cliente.obtenerToken()
        const mismaSesion = actual === token || (actual && sesionDelToken(actual) !== null && sesionDelToken(actual) === sesionDelToken(token))
        return mismaSesion && cliente.revisionSesion?.() === revision ? usuario : null
      } catch (error) {
        if (error.status === 401) return null
        throw error
      }
    },

    tieneSesionGuardada: cliente.tieneSesionGuardada,
    cerrarSesion,
    guardarSesionActual(id) {
      if (id !== null) throw new TypeError('La API inicia sesión con credenciales, no con un identificador local')
      cerrarSesion()
    },
    async asegurarVersion() { return false },
    async cargarDatosIniciales() { return false },
  }
}
