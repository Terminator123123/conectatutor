// Restaura la sesión y expone las operaciones de autenticación a la interfaz.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { repositorio, servicioAutenticacion } from '../servicios/instancias.js'
import { ContextoAutenticacion } from './ContextoAutenticacion.js'

function simularVigencia(habiaSesion, usuario) {
  //solucion temp por falrta de bak correguir despues//
  return habiaSesion && !usuario
}

/**
 * Provee el usuario y las operaciones de autenticación a sus descendientes.
 * @param {object} props Propiedades del proveedor.
 * @param {import('react').ReactNode} props.children Contenido de la aplicación.
 * @returns {import('react').ReactElement} Proveedor del contexto de autenticación.
 */
export default function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorInicial, setErrorInicial] = useState('')
  const [sesionExpirada, setSesionExpirada] = useState(false)

  useEffect(() => {
    let activo = true

    async function restaurarSesion() {
      let habiaSesion = false
      try {
        await repositorio.asegurarVersion()
        await repositorio.cargarDatosIniciales()
        habiaSesion = repositorio.tieneSesionGuardada()
        const usuarioRestaurado = await repositorio.obtenerSesionActual()
        if (activo) {
          setUsuario(usuarioRestaurado)
          setSesionExpirada(simularVigencia(habiaSesion, usuarioRestaurado))
        }
      } catch (error) {
        if (activo) {
          setUsuario(null)
          setSesionExpirada(simularVigencia(habiaSesion, null))
          setErrorInicial(error.message)
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    restaurarSesion()
    return () => { activo = false }
  }, [])

  const iniciarSesion = useCallback(async (correo, clave) => {
    const usuarioAutenticado = await servicioAutenticacion.iniciarSesion(correo, clave)
    // Completa el cambio de sesión y sus guardas antes de navegar desde el formulario.
    flushSync(() => { setUsuario(usuarioAutenticado); setSesionExpirada(false); setErrorInicial('') })
    return usuarioAutenticado
  }, [])

  const registrar = useCallback(async (datos) => {
    await servicioAutenticacion.registrar(datos)
    return iniciarSesion(datos.correoInstitucional, datos.clave)
  }, [iniciarSesion])

  const cerrarSesion = useCallback(() => {
    servicioAutenticacion.cerrarSesion()
    // Completa la salida y sus guardas antes de que la barra navegue al inicio.
    flushSync(() => { setUsuario(null); setSesionExpirada(false); setErrorInicial('') })
  }, [])

  const actualizarUsuario = useCallback(async () => {
    const actual = await repositorio.obtenerSesionActual()
    flushSync(() => {
      setUsuario(actual)
      setSesionExpirada(simularVigencia(repositorio.tieneSesionGuardada(), actual))
    })
    return actual
  }, [])

  const valor = useMemo(() => ({
    usuario, cargando, errorInicial, sesionExpirada, iniciarSesion, registrar, cerrarSesion, actualizarUsuario,
  }), [usuario, cargando, errorInicial, sesionExpirada, iniciarSesion, registrar, cerrarSesion, actualizarUsuario])

  return <ContextoAutenticacion.Provider value={valor}>{children}</ContextoAutenticacion.Provider>
}
