const URL_API = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'

/** Dirección de la foto de perfil de un usuario; la API responde 204 si no tiene. */
export function urlFotoDe(usuarioId, version = 0) {
  return `${URL_API.replace(/\/+$/, '')}/usuarios/${encodeURIComponent(usuarioId)}/foto${version ? `?v=${version}` : ''}`
}
const CLAVE_TOKEN = 'ct.token'
// Ingreso en curso en alguna pestaña. Empezar otro, completar uno o cerrar la sesión la cambia o la borra:
// así la respuesta atrasada de un ingreso sabe si después pasó algo en el almacenamiento compartido,
// aunque el token haya vuelto a quedar como estaba (por ejemplo, otra pestaña entró y salió).
const CLAVE_ACCESO = 'ct.acceso'

/** Mensaje de error de red; MensajeError lo reconoce para reconectar solo, sin botón. */
export const MENSAJE_SIN_CONEXION = 'No pudimos conectarnos con ConectaTutor. Estamos intentando de nuevo'
const ESPERAS_RECONEXION = [500, 1200]
const TOPE_RESPUESTA_MS = 15000

/** Fallos de red seguidos en toda la aplicación; vuelve a 0 con la primera respuesta. */
export const estadoConexion = {
  fallosSeguidos: 0,
  anotarFallo() { this.fallosSeguidos += 1 },
  anotarExito() { this.fallosSeguidos = 0 },
}
const RUTAS_DE_INGRESO = new Set(['/auth/ingreso', '/auth/registro'])
const ENCABEZADO_TOKEN_RENOVADO = 'X-Token-Renovado'
/** Marca las consultas que la app hace sola (la campana): la API no las cuenta como uso y no renueva el token. */
const ENCABEZADO_CONSULTA_AUTOMATICA = 'X-Consulta-Automatica'
/** Motivo que da la API cuando la cuenta ingresó en otra pestaña, navegador o dispositivo. */
export const SESION_REEMPLAZADA = 'SESION_REEMPLAZADA'

/** Momento (ms) en que vence un JWT según su campo `exp`; null si no se puede leer. */
export function vencimientoDelToken(token) {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(globalThis.atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, '=')))
    return Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

/** Identifica la sesión de un JWT (cuenta y sesión), igual antes y después de renovarlo; null si no se puede leer. */
export function sesionDelToken(token) {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { sub, sid, ini } = JSON.parse(globalThis.atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, '=')))
    return sub ? `${sub}:${sid ?? ''}:${ini ?? ''}` : null
  } catch {
    return null
  }
}

export class ErrorApi extends Error {
  constructor(mensaje, { status = 0, errores = [], regla, cause } = {}) {
    super(mensaje, { cause })
    this.name = 'ErrorApi'
    this.status = status
    this.errores = errores
    this.regla = regla
  }
}

function almacenPredeterminado() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage
  } catch {
    // El navegador puede bloquear Storage aunque la API exista
  }
  const valores = new Map()
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, valor),
    removeItem: (clave) => valores.delete(clave),
  }
}

export function crearClienteApi({
  urlBase = URL_API,
  fetchImpl = globalThis.fetch,
  almacen = almacenPredeterminado(),
  alExpirarSesion = () => {},
  reloj = () => Date.now(),
  temporizador = {
    programar: (fn, ms) => {
      const id = setTimeout(fn, Math.min(ms, 2 ** 31 - 1))
      id?.unref?.() // En Node (pruebas) la alarma no mantiene vivo el proceso
      return id
    },
    cancelar: (id) => clearTimeout(id),
  },
} = {}) {
  // Admite una ruta relativa ("/api"): la API queda en el mismo origen que la página.
  const base = new URL(urlBase, globalThis.location?.href)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new TypeError('La URL de la API debe ser una dirección HTTP o HTTPS sin credenciales, consulta ni fragmento')
  }
  const direccion = base.href.replace(/\/+$/, '')
  let revisionSesion = 0
  let alarmaInactividad = null
  let turnoAlarma = 0

  const obtenerToken = () => almacen.getItem(CLAVE_TOKEN)

  // RQNF005: el token vence tras un rato sin usar la aplicación. La alarma cierra
  // la sesión en ese momento aunque la pantalla siga abierta sin hacer peticiones.
  function programarVencimiento(token) {
    if (alarmaInactividad !== null) temporizador.cancelar(alarmaInactividad)
    alarmaInactividad = null
    const turno = ++turnoAlarma
    const vence = token ? vencimientoDelToken(token) : null
    if (vence === null) return
    alarmaInactividad = temporizador.programar(() => {
      if (turno !== turnoAlarma) return // alarma de una sesión anterior de esta pestaña
      alarmaInactividad = null
      const actual = obtenerToken()
      // Otra pestaña renovó la sesión compartida: seguir vigilando su nuevo vencimiento
      if (actual && actual !== token) { programarVencimiento(actual); return }
      // Otra pestaña ya la cerró o la dio por vencida: esta también retira el estado privado
      if (!actual) { revisionSesion += 1; alExpirarSesion(); return }
      cerrarSesion()
      alExpirarSesion()
    }, Math.max(0, vence - reloj()))
  }

  function guardarToken(token) {
    if (typeof token !== 'string' || !token.trim()) throw new TypeError('El token debe ser un texto no vacío')
    almacen.setItem(CLAVE_TOKEN, token)
    almacen.removeItem(CLAVE_ACCESO)
    revisionSesion += 1
    programarVencimiento(token)
  }
  function cerrarSesion() {
    almacen.removeItem(CLAVE_TOKEN)
    almacen.removeItem(CLAVE_ACCESO)
    revisionSesion += 1
    programarVencimiento(null)
  }

  let ingresosEmpezados = 0
  /** Anota que empieza un ingreso; deja sin vigencia el que estuviera en curso en otra pestaña. */
  function iniciarAcceso() {
    ingresosEmpezados += 1
    const turno = `${reloj().toString(36)}.${ingresosEmpezados}.${Math.random().toString(36).slice(2)}`
    almacen.setItem(CLAVE_ACCESO, turno)
    return turno
  }
  /** Indica si desde que empezó el ingreso nadie inició otro, completó uno ni cerró la sesión. */
  const accesoVigente = (turno) => almacen.getItem(CLAVE_ACCESO) === turno
  /** Quita la marca del ingreso si sigue siendo la suya. */
  function terminarAcceso(turno) {
    if (accesoVigente(turno)) almacen.removeItem(CLAVE_ACCESO)
  }

  programarVencimiento(obtenerToken())

  /**
   * Salir (RQF003): borra la sesión de esta pestaña al instante y pide a la API que invalide
   * ese token, para que una copia guardada no siga sirviendo. Si la API no responde, la
   * sesión local queda cerrada igual y el token vence solo por inactividad.
   * @returns {Promise<void>}
   */
  async function salir() {
    const token = obtenerToken()
    cerrarSesion()
    if (!token) return
    try {
      await fetchImpl(`${direccion}/auth/salida`, { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
    } catch {
      // Sin conexión: la sesión local ya se cerró
    }
  }

  async function peticion(ruta, { metodo = 'GET', datos, parametros = {}, autenticada = true, automatica = false, signal } = {}) {
    if (typeof ruta !== 'string' || !ruta.startsWith('/') || ruta.startsWith('//') || /[?#\\]/.test(ruta)) {
      throw new TypeError('La ruta debe ser relativa a la API; usa parametros para la consulta')
    }
    const url = new URL(`${direccion}${ruta}`)
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, String(valor))
    }
    const enviarToken = autenticada && !RUTAS_DE_INGRESO.has(ruta.replace(/\/+$/, ''))
    const token = enviarToken ? obtenerToken() : null
    const revisionAlEnviar = revisionSesion
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (automatica) headers[ENCABEZADO_CONSULTA_AUTOMATICA] = '1'
    if (datos !== undefined) headers['Content-Type'] = 'application/json'
    const body = datos === undefined ? undefined : JSON.stringify(datos)

    // Sin conexión, las consultas (GET) se reintentan solas unos segundos antes de rendirse:
    // mientras tanto la pantalla sigue mostrando el esqueleto de carga. Lo que cambia datos
    // (POST, PUT…) no se repite solo, para no enviar dos veces la misma acción.
    const esperas = metodo === 'GET' ? ESPERAS_RECONEXION : []
    let respuesta
    for (let intento = 0; ; intento += 1) {
      try {
        // Cada intento tiene un tope de tiempo: un servidor que no contesta no deja la pantalla cargando para siempre
        const tope = new AbortController()
        let vencio = false
        const alarma = setTimeout(() => { vencio = true; tope.abort() }, TOPE_RESPUESTA_MS)
        const alAbortar = () => tope.abort()
        signal?.addEventListener?.('abort', alAbortar, { once: true })
        try {
          respuesta = await fetchImpl(url.href, { method: metodo, headers, body, signal: tope.signal })
        } catch (error) {
          if (!vencio) throw error // cancelación pedida por quien llama
          throw Object.assign(new Error('Sin respuesta'), { cause: error, name: 'SinRespuesta' })
        } finally {
          clearTimeout(alarma)
          signal?.removeEventListener?.('abort', alAbortar)
        }
        estadoConexion.anotarExito()
        break
      } catch (cause) {
        if (cause?.name === 'AbortError') throw cause
        if (intento < esperas.length && !signal?.aborted) { await new Promise((listo) => setTimeout(listo, esperas[intento])); continue }
        estadoConexion.anotarFallo()
        throw new ErrorApi(MENSAJE_SIN_CONEXION, { cause })
      }
    }

    // Un 401 atrasado no puede cerrar una sesión iniciada después de la petición
    const sigueSiendoLaMisma = () => token && revisionSesion === revisionAlEnviar && obtenerToken() === token
    if (respuesta.status === 401 && sigueSiendoLaMisma()) {
      // El motivo viene en el cuerpo; sin él, se trata como una sesión vencida
      let motivo
      try { motivo = (await respuesta.clone?.().json())?.regla } catch { motivo = undefined }
      if (sigueSiendoLaMisma()) {
        cerrarSesion()
        alExpirarSesion(motivo === SESION_REEMPLAZADA ? SESION_REEMPLAZADA : undefined)
      }
    }
    // Cada uso renueva el token: la sesión sigue mientras haya actividad (las consultas automáticas no lo renuevan)
    const renovado = respuesta.headers?.get?.(ENCABEZADO_TOKEN_RENOVADO)
    if (renovado && respuesta.ok && token && revisionSesion === revisionAlEnviar && obtenerToken() === token) {
      almacen.setItem(CLAVE_TOKEN, renovado)
      programarVencimiento(renovado)
    }
    if (respuesta.status === 204 || respuesta.status === 205) return null

    let contenido
    try {
      contenido = await respuesta.json()
    } catch (cause) {
      const mensaje = respuesta.ok
        ? 'El servidor devolvió una respuesta que no se puede leer. Inténtalo de nuevo'
        : `No se pudo completar la solicitud (HTTP ${respuesta.status})`
      throw new ErrorApi(mensaje, { status: respuesta.status, cause })
    }
    if (!respuesta.ok) {
      throw new ErrorApi(
        typeof contenido?.mensaje === 'string' ? contenido.mensaje : `No se pudo completar la solicitud (HTTP ${respuesta.status})`,
        {
          status: respuesta.status,
          errores: Array.isArray(contenido?.errores) ? contenido.errores.filter((error) => typeof error === 'string') : [],
          regla: typeof contenido?.regla === 'string' ? contenido.regla : undefined,
        },
      )
    }
    return contenido
  }

  return {
    peticion, obtenerToken, guardarToken, cerrarSesion, salir, iniciarAcceso, accesoVigente, terminarAcceso,
    tieneSesionGuardada: () => Boolean(obtenerToken()),
    /** Cambia al iniciar o cerrar sesión en esta pestaña; no cambia al renovar el token. */
    revisionSesion: () => revisionSesion,
  }
}
