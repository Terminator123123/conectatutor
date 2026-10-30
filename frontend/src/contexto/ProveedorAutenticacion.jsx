// Restaura la sesión y expone las operaciones de autenticación a la interfaz.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { repositorio, servicioAutenticacion } from '../servicios/instancias.js'
import { ContextoAutenticacion } from './ContextoAutenticacion.js'

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

  useEffect(() => {
    let activo = true

    async function restaurarSesion() {
      try {
        await repositorio.asegurarVersion()
        await repositorio.cargarDatosIniciales()
        const usuarioRestaurado = await repositorio.obtenerSesionActual()
        if (activo) setUsuario(usuarioRestaurado)
      } catch (error) {
        if (activo) {
          setUsuario(null)
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
    flushSync(() => setUsuario(usuarioAutenticado))
    return usuarioAutenticado
  }, [])

  const registrar = useCallback(async (datos) => {
    await servicioAutenticacion.registrar(datos)
    return iniciarSesion(datos.correoInstitucional, datos.clave)
  }, [iniciarSesion])

  const cerrarSesion = useCallback(() => {
    servicioAutenticacion.cerrarSesion()
    // Completa la salida y sus guardas antes de que la barra navegue al inicio.
    flushSync(() => setUsuario(null))
  }, [])

  const valor = useMemo(() => ({
    usuario, cargando, errorInicial, iniciarSesion, registrar, cerrarSesion,
  }), [usuario, cargando, errorInicial, iniciarSesion, registrar, cerrarSesion])

  return <ContextoAutenticacion.Provider value={valor}>{children}</ContextoAutenticacion.Provider>
}
