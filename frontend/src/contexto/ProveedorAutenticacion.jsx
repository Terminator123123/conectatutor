import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { repositorio, servicioAutenticacion, suscribirExpiracionSesion } from '../servicios/instancias.js'
import { aplicarConfirmacion } from './confirmacionCuenta.js'
import { ContextoAutenticacion } from './ContextoAutenticacion.js'

/** Tiempo mínimo entre dos comprobaciones de la sesión al volver a la ventana. */
const ESPERA_ENTRE_COMPROBACIONES_MS = 5000

export default function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorInicial, setErrorInicial] = useState('')
  const [sesionExpirada, setSesionExpirada] = useState(false)
  // Por qué se cerró: SESION_REEMPLAZADA si la cuenta entró en otro lugar; null si venció
  const [motivoCierre, setMotivoCierre] = useState(null)
  const revision = useRef(0)

  const restaurarSesion = useCallback(() => {
    const actual = ++revision.current
    const habiaSesion = repositorio.tieneSesionGuardada()
    return repositorio.obtenerSesionActual().then((restaurado) => {
      if (actual === revision.current) {
        setUsuario(restaurado)
        setSesionExpirada(habiaSesion && !restaurado)
      }
    }).catch((error) => {
      if (actual === revision.current) {
        setErrorInicial(error.message)
        setSesionExpirada(false)
      }
    }).finally(() => {
      if (actual === revision.current) setCargando(false)
    })
  }, [])

  const reintentarSesion = useCallback(() => {
    setCargando(true)
    setErrorInicial('')
    return restaurarSesion()
  }, [restaurarSesion])

  useEffect(() => suscribirExpiracionSesion((motivo) => {
    revision.current += 1
    setUsuario(null)
    setSesionExpirada(true)
    setMotivoCierre(motivo ?? null)
    setErrorInicial('')
    setCargando(false)
  }), [])

  useEffect(() => {
    restaurarSesion()
    return () => { revision.current += 1 }
  }, [restaurarSesion])

  // Con cualquier cuenta, al volver a esta ventana o pestaña se comprueba la sesión en el acto: si la cuenta
  // se abrió en otro lugar, el 401 la cierra aquí y la pantalla explica el motivo (ver servicios/api.js).
  useEffect(() => {
    if (!usuario) return undefined
    let ultima = 0
    const comprobar = () => {
      if (document.visibilityState !== 'visible' || !repositorio.tieneSesionGuardada()) return
      const ahora = Date.now()
      if (ahora - ultima < ESPERA_ENTRE_COMPROBACIONES_MS) return
      ultima = ahora
      repositorio.obtenerSesionActual().catch(() => { /* sin conexión: se comprobará en la próxima petición */ })
    }
    window.addEventListener('focus', comprobar)
    document.addEventListener('visibilitychange', comprobar)
    return () => {
      window.removeEventListener('focus', comprobar)
      document.removeEventListener('visibilitychange', comprobar)
    }
  }, [usuario])

  const iniciarSesion = useCallback(async (correo, clave) => {
    const actual = ++revision.current
    const autenticado = await servicioAutenticacion.iniciarSesion(correo, clave)
    if (actual === revision.current) flushSync(() => { setUsuario(autenticado); setSesionExpirada(false); setMotivoCierre(null); setErrorInicial(''); setCargando(false) })
    return autenticado
  }, [])

  const registrar = useCallback(async (datos) => {
    const actual = ++revision.current
    const registrado = await servicioAutenticacion.registrar(datos)
    if (actual === revision.current) flushSync(() => { setUsuario(registrado); setSesionExpirada(false); setMotivoCierre(null); setErrorInicial(''); setCargando(false) })
    return registrado
  }, [])

  const cerrarSesion = useCallback(() => {
    revision.current += 1
    servicioAutenticacion.cerrarSesion()
    flushSync(() => { setUsuario(null); setSesionExpirada(false); setMotivoCierre(null); setErrorInicial(''); setCargando(false) })
  }, [])

  const actualizarUsuario = useCallback(async () => {
    const actual = revision.current
    const habiaSesion = repositorio.tieneSesionGuardada()
    const restaurado = await repositorio.obtenerSesionActual()
    if (actual === revision.current) flushSync(() => {
      setUsuario(restaurado)
      setSesionExpirada(habiaSesion && !restaurado)
    })
    return restaurado
  }, [])

  // Muestra la cuenta que devuelve una mutación ya guardada (p. ej. el primer acceso) sin otra consulta.
  // Si mientras se esperaba la sesión expiró, se cerró o cambió, esa confirmación no se muestra.
  const confirmarCuenta = useCallback((mutacion) => aplicarConfirmacion({
    mutacion,
    revision: () => revision.current,
    publicar: (cuenta) => flushSync(() => { setUsuario(cuenta); setSesionExpirada(false); setErrorInicial(''); setCargando(false) }),
    releer: restaurarSesion,
  }), [restaurarSesion])

  const valor = useMemo(() => ({
    usuario, cargando, errorInicial, sesionExpirada, motivoCierre, iniciarSesion, registrar, cerrarSesion, actualizarUsuario, confirmarCuenta, reintentarSesion,
  }), [usuario, cargando, errorInicial, sesionExpirada, motivoCierre, iniciarSesion, registrar, cerrarSesion, actualizarUsuario, confirmarCuenta, reintentarSesion])

  return <ContextoAutenticacion.Provider value={valor}>{children}</ContextoAutenticacion.Provider>
}
