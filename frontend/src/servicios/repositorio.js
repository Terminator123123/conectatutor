import { INSTITUCION } from '../config/institucion.js'
import { crearDatosIniciales } from '../datos/datosIniciales.js'
import Administrador from '../modelo/Administrador.js'
import Estudiante from '../modelo/Estudiante.js'
import Materia from '../modelo/Materia.js'
import PerfilTutor from '../modelo/PerfilTutor.js'
import Programa from '../modelo/Programa.js'
import Sesion from '../modelo/Sesion.js'
import { EstadoVerificacion, RolUsuario } from '../modelo/enums.js'

const claves = Object.freeze({
  programas: 'ct.programas',
  materias: 'ct.materias',
  usuarios: 'ct.usuarios',
  perfilesTutor: 'ct.perfilesTutor',
  sesiones: 'ct.sesiones',
  sesionActual: 'ct.sesionActual',
})

/**
 * Crea un almacén de textos en memoria con las operaciones utilizadas de Storage.
 * @returns {{getItem: function(string): (string|null), setItem: function(string, string): void, removeItem: function(string): void}} Almacén independiente.
 */
export function almacenEnMemoria() {
  const valores = new Map()

  return {
    /**
     * Consulta un valor guardado.
     * @param {string} clave Clave consultada.
     * @returns {string|null} Texto guardado o null si no existe.
     */
    getItem(clave) {
      return valores.get(String(clave)) ?? null
    },
    /**
     * Guarda un valor como texto.
     * @param {string} clave Clave del valor.
     * @param {string} valor Texto que se guarda.
     * @returns {void}
     */
    setItem(clave, valor) {
      valores.set(String(clave), String(valor))
    },
    /**
     * Elimina únicamente la clave indicada.
     * @param {string} clave Clave que se elimina.
     * @returns {void}
     */
    removeItem(clave) {
      valores.delete(String(clave))
    },
  }
}

/**
 * Crea la persistencia del dominio con un retraso que simula una petición de red.
 * @param {object} [almacen=globalThis.localStorage] Almacén compatible con Storage; usa memoria si no hay almacenamiento local.
 * @param {number} [retrasoMs=300] Retraso de las operaciones asíncronas en milisegundos.
 * @returns {object} Operaciones de consulta, guardado, autenticación y datos iniciales.
 */
export function crearRepositorio(almacen = globalThis.localStorage ?? almacenEnMemoria(), retrasoMs = 300) {
  /**
   * Espera el retraso configurado antes de consultar o modificar el almacén.
   * @returns {Promise<void>} Finalización de la espera.
   */
  function esperar() {
    return new Promise((resolver) => setTimeout(resolver, retrasoMs))
  }

  /**
   * Lee una colección de datos persistidos sin modificar el almacén.
   * @param {string} coleccion Nombre de la colección.
   * @returns {object[]} Datos serializados; un arreglo vacío si todavía no existe.
   */
  function leerColeccion(coleccion) {
    return JSON.parse(almacen.getItem(claves[coleccion]) ?? '[]')
  }

  /**
   * Inserta o reemplaza una entidad por identificador en su colección.
   * @param {string} coleccion Nombre de la colección.
   * @param {object} datos Datos serializados de la entidad.
   * @returns {void}
   * @throws {Error} Si el grafo no se puede reconstruir; restaura la colección anterior.
   */
  function guardarDatos(coleccion, datos) {
    const textoAnterior = almacen.getItem(claves[coleccion])
    const registros = JSON.parse(textoAnterior ?? '[]')
    const indice = registros.findIndex((registro) => registro.id === datos.id)

    if (indice === -1) registros.push(datos)
    else registros[indice] = datos

    almacen.setItem(claves[coleccion], JSON.stringify(registros))

    try {
      reconstruir()
    } catch (error) {
      if (textoAnterior === null) almacen.removeItem(claves[coleccion])
      else almacen.setItem(claves[coleccion], textoAnterior)

      throw error
    }
  }

  /**
   * Resuelve una referencia persistida sin admitir entidades inexistentes.
   * @param {Map<string, object>} coleccion Instancias indexadas por identificador.
   * @param {string} tipo Nombre de la clase referenciada.
   * @param {string} id Identificador que debe existir.
   * @returns {object} Instancia referenciada.
   * @throws {Error} Si no existe una entidad con ese identificador.
   */
  function buscarReferencia(coleccion, tipo, id) {
    const referencia = coleccion.get(id)

    if (!referencia) throw new Error(`Referencia inexistente: ${tipo} ${id}`)

    return referencia
  }

  /**
   * Reconstruye instancias nuevas y sus referencias compartidas en orden de dependencia.
   * @returns {object} Colecciones de instancias indexadas por identificador.
   * @throws {Error} Si una referencia no existe o no corresponde a un estudiante.
   * @throws {TypeError} Si un usuario persistido no tiene un discriminador reconocido.
   */
  function reconstruir() {
    const programas = new Map()
    const materias = new Map()
    const usuarios = new Map()
    const perfilesTutor = new Map()
    const sesiones = new Map()
    const contexto = {
      buscarPrograma: (id) => buscarReferencia(programas, 'Programa', id),
      buscarMateria: (id) => buscarReferencia(materias, 'Materia', id),
      buscarEstudiante: (id) => {
        const usuario = buscarReferencia(usuarios, 'Estudiante', id)

        if (!(usuario instanceof Estudiante)) {
          throw new Error(`Referencia inexistente: Estudiante ${id}`)
        }

        return usuario
      },
      buscarPerfilTutor: (id) => buscarReferencia(perfilesTutor, 'PerfilTutor', id),
    }

    for (const datos of leerColeccion('programas')) {
      const programa = Programa.desdeJSON(datos, contexto)
      programas.set(programa.getId(), programa)
    }

    for (const datos of leerColeccion('materias')) {
      const materia = Materia.desdeJSON(datos, contexto)
      materias.set(materia.getId(), materia)
    }

    for (const datos of leerColeccion('usuarios')) {
      let usuario

      if (datos.tipo === RolUsuario.ESTUDIANTE) {
        usuario = Estudiante.desdeJSON(datos, contexto)
      } else if (datos.tipo === RolUsuario.ADMINISTRADOR) {
        usuario = Administrador.desdeJSON(datos, contexto)
      } else {
        throw new TypeError('El tipo de usuario guardado no es válido.')
      }

      usuarios.set(usuario.getId(), usuario)
    }

    for (const datos of leerColeccion('perfilesTutor')) {
      const perfil = PerfilTutor.desdeJSON(datos, contexto)
      perfilesTutor.set(perfil.getId(), perfil)
    }

    for (const datos of leerColeccion('sesiones')) {
      const sesion = Sesion.desdeJSON(datos, contexto)
      sesiones.set(sesion.getId(), sesion)
    }

    return { programas, materias, usuarios, perfilesTutor, sesiones }
  }

  return {
    /**
     * Lista los programas académicos.
     * @returns {Promise<Programa[]>} Instancias nuevas de los programas guardados.
     */
    async listarProgramas() {
      await esperar()
      return [...reconstruir().programas.values()]
    },

    /**
     * Lista las materias, opcionalmente limitadas a un programa.
     * @param {string} [programaId] Identificador del programa por el que se filtra.
     * @returns {Promise<Materia[]>} Materias que cumplen el filtro.
     */
    async listarMaterias(programaId) {
      await esperar()
      return [...reconstruir().materias.values()].filter(
        (materia) => programaId == null || materia.getPrograma().getId() === programaId,
      )
    },

    /**
     * Lista perfiles verificados por materia, programa, sede y día; ignora filtros vacíos.
     * @param {object} [filtros={}] Filtros opcionales.
     * @param {string} [filtros.materiaId] Materia ofrecida por el tutor.
     * @param {string} [filtros.programaId] Programa académico del dueño del perfil.
     * @param {string} [filtros.sede] Sede del estudiante tutor.
     * @param {string} [filtros.dia] Día con al menos una franja disponible.
     * @returns {Promise<PerfilTutor[]>} Perfiles verificados que cumplen los filtros.
     */
    async listarTutoresVerificados({ materiaId, programaId, sede, dia } = {}) {
      await esperar()
      return [...reconstruir().perfilesTutor.values()].filter(
        (perfil) => perfil.estaVerificado()
          && (!materiaId || perfil.getMaterias().some((materia) => materia.getId() === materiaId))
          && (!programaId || perfil.getEstudiante().getPrograma().getId() === programaId)
          && (!sede || perfil.getEstudiante().getSede() === sede)
          && (!dia || perfil.getDisponibilidad().some((franja) => franja.getDia() === dia)),
      )
    },

    /**
     * Obtiene un perfil por identificador.
     * @param {string} id Identificador del perfil.
     * @returns {Promise<PerfilTutor|null>} Perfil reconstruido o null si no existe.
     */
    async obtenerPerfilTutor(id) {
      await esperar()
      return reconstruir().perfilesTutor.get(id) ?? null
    },

    /**
     * Obtiene un usuario con su subclase y perfil de tutor cuando corresponda.
     * @param {string} id Identificador del usuario.
     * @returns {Promise<Estudiante|Administrador|null>} Usuario reconstruido o null si no existe.
     */
    async obtenerUsuario(id) {
      await esperar()
      return reconstruir().usuarios.get(id) ?? null
    },

    /**
     * Busca un usuario ignorando espacios exteriores y mayúsculas en el correo.
     * @param {string} correo Correo institucional que se busca.
     * @returns {Promise<Estudiante|Administrador|null>} Usuario encontrado o null.
     */
    async buscarUsuarioPorCorreo(correo) {
      await esperar()
      const correoNormalizado = correo.trim().toLowerCase()
      return [...reconstruir().usuarios.values()].find(
        (usuario) => usuario.getCorreo().trim().toLowerCase() === correoNormalizado,
      ) ?? null
    },

    /**
     * Guarda un usuario y conserva su hash anterior si no se proporciona uno nuevo.
     * @param {Estudiante|Administrador} usuario Instancia que se guarda.
     * @param {string} [claveHash] Hash SHA-256 de la contraseña; no forma parte de la instancia.
     * @returns {Promise<Estudiante|Administrador>} Usuario guardado y reconstruido.
     * @throws {Error} Si las referencias guardadas no permiten reconstruir el grafo.
     */
    async guardarUsuario(usuario, claveHash) {
      await esperar()
      const datos = usuario.toJSON()
      const anterior = leerColeccion('usuarios').find((registro) => registro.id === datos.id)

      if (claveHash !== undefined) datos.claveHash = claveHash
      else if (anterior?.claveHash !== undefined) datos.claveHash = anterior.claveHash

      guardarDatos('usuarios', datos)
      return reconstruir().usuarios.get(datos.id)
    },

    /**
     * Guarda el perfil con las referencias por identificador y las franjas embebidas.
     * @param {PerfilTutor} perfil Instancia que se guarda.
     * @returns {Promise<PerfilTutor>} Perfil guardado y reconstruido.
     * @throws {Error} Si las referencias guardadas no permiten reconstruir el grafo.
     */
    async guardarPerfilTutor(perfil) {
      await esperar()
      guardarDatos('perfilesTutor', perfil.toJSON())
      return reconstruir().perfilesTutor.get(perfil.getId())
    },

    /** @returns {Promise<Sesion[]>} Todas las sesiones guardadas, reconstruidas. */
    async listarSesiones() {
      await esperar()
      return [...reconstruir().sesiones.values()]
    },

    /** @returns {Promise<PerfilTutor[]>} Todos los perfiles, en cualquier estado. */
    async listarPerfilesTutor() {
      await esperar()
      return [...reconstruir().perfilesTutor.values()]
    },

    /**
     * Lista las sesiones que un usuario solicita o atiende mediante su perfil de tutor.
     * @param {string} usuarioId Identificador del usuario.
     * @returns {Promise<Sesion[]>} Sesiones en las que participa el usuario.
     */
    async listarSesionesDe(usuarioId) {
      await esperar()
      return [...reconstruir().sesiones.values()].filter(
        (sesion) => sesion.getSolicitante().getId() === usuarioId
          || sesion.getTutor().getEstudiante().getId() === usuarioId,
      )
    },

    /**
     * Lista las sesiones atendidas por un perfil de tutor.
     * @param {string} perfilTutorId Identificador del perfil del tutor.
     * @returns {Promise<Sesion[]>} Sesiones de ese perfil.
     */
    async listarSesionesDelTutor(perfilTutorId) {
      await esperar()
      return [...reconstruir().sesiones.values()].filter(
        (sesion) => sesion.getTutor().getId() === perfilTutorId,
      )
    },

    /**
     * Guarda una sesión con su estado y objetos de valor embebidos.
     * @param {Sesion} sesion Instancia que se guarda.
     * @returns {Promise<Sesion>} Sesión guardada y reconstruida.
     * @throws {Error} Si las referencias guardadas no permiten reconstruir el grafo.
     */
    async guardarSesion(sesion) {
      await esperar()
      guardarDatos('sesiones', sesion.toJSON())
      return reconstruir().sesiones.get(sesion.getId())
    },

    /**
     * Lista los perfiles que todavía esperan verificación.
     * @returns {Promise<PerfilTutor[]>} Perfiles pendientes.
     */
    async listarPerfilesPendientes() {
      await esperar()
      return [...reconstruir().perfilesTutor.values()].filter(
        (perfil) => perfil.getEstadoVerificacion() === EstadoVerificacion.PENDIENTE,
      )
    },

    /**
     * Carga ejemplos únicamente cuando las cinco colecciones están vacías.
     * @param {string} [dominioCorreo=INSTITUCION.dominioCorreo] Dominio utilizado para las cuentas de ejemplo.
     * @returns {Promise<boolean>} Verdadero si se cargaron los datos; falso si ya había registros.
     */
    async cargarDatosIniciales(dominioCorreo = INSTITUCION.dominioCorreo) {
      await esperar()
      const colecciones = ['programas', 'materias', 'usuarios', 'perfilesTutor', 'sesiones']

      if (colecciones.some((coleccion) => leerColeccion(coleccion).length > 0)) return false

      const datos = await crearDatosIniciales(dominioCorreo)

      for (const coleccion of colecciones) {
        const registros = datos[coleccion].map((entidad) => {
          const registro = entidad.toJSON()
          if (coleccion === 'usuarios') registro.claveHash = datos.clavesHash[entidad.getId()]
          return registro
        })
        almacen.setItem(claves[coleccion], JSON.stringify(registros))
      }

      return true
    },

    /**
     * Elimina únicamente las seis claves del repositorio.
     * @returns {Promise<void>} Finalización del reinicio.
     */
    async reiniciar() {
      await esperar()
      for (const clave of Object.values(claves)) almacen.removeItem(clave)
    },

    /**
     * Consulta el hash sin incorporar credenciales a las instancias del dominio.
     * @param {string} usuarioId Identificador del usuario.
     * @returns {string|null} Hash guardado o null si no existe.
     */
    obtenerClaveHash(usuarioId) {
      return leerColeccion('usuarios').find((usuario) => usuario.id === usuarioId)?.claveHash ?? null
    },

    /**
     * Guarda o elimina el identificador de la cuenta autenticada.
     * @param {string|null} usuarioId Identificador del usuario; null para cerrar sesión.
     * @returns {void}
     */
    guardarSesionActual(usuarioId) {
      if (usuarioId === null) almacen.removeItem(claves.sesionActual)
      else almacen.setItem(claves.sesionActual, JSON.stringify(usuarioId))
    },

    /**
     * Restaura la cuenta autenticada a partir de su identificador persistido.
     * @returns {Promise<Estudiante|Administrador|null>} Usuario actual o null si no hay sesión válida.
     */
    async obtenerSesionActual() {
      await esperar()
      const usuarioId = JSON.parse(almacen.getItem(claves.sesionActual) ?? 'null')
      return reconstruir().usuarios.get(usuarioId) ?? null
    },
  }
}
