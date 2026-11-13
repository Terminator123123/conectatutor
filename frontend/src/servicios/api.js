const URL_API = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'
const CLAVE_TOKEN = 'ct.token'
const RUTAS_DE_INGRESO = new Set(['/auth/ingreso', '/auth/registro'])
const ENCABEZADO_TOKEN_RENOVADO = 'X-Token-Renovado'

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
  const base = new URL(urlBase)
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
    revisionSesion += 1
    programarVencimiento(token)
  }
  function cerrarSesion() {
    almacen.removeItem(CLAVE_TOKEN)
    revisionSesion += 1
    programarVencimiento(null)
  }

  programarVencimiento(obtenerToken())

  async function peticion(ruta, { metodo = 'GET', datos, parametros = {}, autenticada = true, signal } = {}) {
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
    if (datos !== undefined) headers['Content-Type'] = 'application/json'
    const body = datos === undefined ? undefined : JSON.stringify(datos)

    let respuesta
    try {
      respuesta = await fetchImpl(url.href, { method: metodo, headers, body, signal })
    } catch (cause) {
      if (cause?.name === 'AbortError') throw cause
      throw new ErrorApi('No se pudo conectar con la API. Revisa tu conexión e inténtalo de nuevo', { cause })
    }

    // Un 401 atrasado no puede cerrar una sesión iniciada después de la petición
    if (respuesta.status === 401 && token && revisionSesion === revisionAlEnviar && obtenerToken() === token) {
      cerrarSesion()
      alExpirarSesion()
    }
    // Cada uso renueva el token: la sesión sigue mientras haya actividad
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
        ? 'La API devolvió una respuesta que no se puede leer. Inténtalo de nuevo'
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

  return { peticion, obtenerToken, guardarToken, cerrarSesion, tieneSesionGuardada: () => Boolean(obtenerToken()) }
}
