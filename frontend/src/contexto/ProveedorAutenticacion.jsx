import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { repositorio, servicioAutenticacion, suscribirExpiracionSesion } from '../servicios/instancias.js'
import { ContextoAutenticacion } from './ContextoAutenticacion.js'

export default function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorInicial, setErrorInicial] = useState('')
  const [sesionExpirada, setSesionExpirada] = useState(false)
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

  useEffect(() => suscribirExpiracionSesion(() => {
    revision.current += 1
    setUsuario(null)
    setSesionExpirada(true)
    setErrorInicial('')
    setCargando(false)
  }), [])

  useEffect(() => {
    restaurarSesion()
    return () => { revision.current += 1 }
  }, [restaurarSesion])

  const iniciarSesion = useCallback(async (correo, clave) => {
    const actual = ++revision.current
    const autenticado = await servicioAutenticacion.iniciarSesion(correo, clave)
    if (actual === revision.current) flushSync(() => { setUsuario(autenticado); setSesionExpirada(false); setErrorInicial(''); setCargando(false) })
    return autenticado
  }, [])

  const registrar = useCallback(async (datos) => {
    const actual = ++revision.current
    const registrado = await servicioAutenticacion.registrar(datos)
    if (actual === revision.current) flushSync(() => { setUsuario(registrado); setSesionExpirada(false); setErrorInicial(''); setCargando(false) })
    return registrado
  }, [])

  const cerrarSesion = useCallback(() => {
    revision.current += 1
    servicioAutenticacion.cerrarSesion()
    flushSync(() => { setUsuario(null); setSesionExpirada(false); setErrorInicial(''); setCargando(false) })
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

  const valor = useMemo(() => ({
    usuario, cargando, errorInicial, sesionExpirada, iniciarSesion, registrar, cerrarSesion, actualizarUsuario, reintentarSesion,
  }), [usuario, cargando, errorInicial, sesionExpirada, iniciarSesion, registrar, cerrarSesion, actualizarUsuario, reintentarSesion])

  return <ContextoAutenticacion.Provider value={valor}>{children}</ContextoAutenticacion.Provider>
}
