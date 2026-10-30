// Inicia sesión y recupera el destino solicitado cuando corresponde al rol.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useState } from 'react'
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { RolUsuario } from '../modelo/enums.js'
import { rutaInicialDe } from '../servicios/rutasPorRol.js'
import { validarCorreo } from '../servicios/validacionesFormulario.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import '../estilos/autenticacion.css'

/**
 * Comprueba que el destino conservado pertenezca a las rutas del rol.
 * @param {unknown} destino Ruta conservada al pedir el ingreso.
 * @param {import('../modelo/Usuario.js').default} usuario Usuario autenticado.
 * @returns {boolean} Verdadero si la ruta está permitida.
 */
function destinoPermitido(destino, usuario) {
  if (typeof destino !== 'string') return false
  const rutaDestino = destino.split('?')[0]
  if (usuario.getRol() === RolUsuario.ADMINISTRADOR) return rutaDestino === '/admin/verificacion'
  if (usuario.getRol() !== RolUsuario.ESTUDIANTE) return false
  return ['/tutores', '/tutores/:id', '/tutores/:id/solicitar', '/sesiones', '/perfil']
    .some((ruta) => matchPath({ path: ruta, end: true }, rutaDestino))
}

/** @returns {import('react').ReactElement} Formulario de ingreso institucional. */
export default function Ingreso() {
  useTituloPagina('Bienvenido de vuelta')
  const [campos, setCampos] = useState({ correoInstitucional: '', clave: '' })
  const [tocados, setTocados] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [errorServicio, setErrorServicio] = useState('')
  const { iniciarSesion, errorInicial } = useAutenticacion()
  const location = useLocation()
  const navigate = useNavigate()
  const errores = {
    correoInstitucional: validarCorreo(campos.correoInstitucional, INSTITUCION.dominioCorreo),
    clave: campos.clave ? '' : 'Escribe tu contraseña.',
  }

  function cambiar(nombre, valor) {
    setCampos((anteriores) => ({ ...anteriores, [nombre]: valor }))
  }

  function marcarTocado(evento) {
    const nombre = evento.target.name
    if (Object.hasOwn(campos, nombre)) setTocados((anteriores) => ({ ...anteriores, [nombre]: true }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTocados({ correoInstitucional: true, clave: true })
    setErrorServicio('')
    const primerError = Object.keys(errores).find((nombre) => errores[nombre])
    if (primerError) {
      evento.currentTarget.elements.namedItem(primerError)?.focus()
      return
    }
    setEnviando(true)
    try {
      const usuario = await iniciarSesion(campos.correoInstitucional, campos.clave)
      const desde = location.state?.desde
      navigate(destinoPermitido(desde, usuario) ? desde : rutaInicialDe(usuario), { replace: true })
    } catch (error) {
      setErrorServicio(error.message)
      setCampos((anteriores) => ({ ...anteriores, clave: '' }))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="ct-autenticacion" aria-labelledby="titulo-ingreso">
      <img className="ct-autenticacion-logo" src={INSTITUCION.logos.vertical} alt={INSTITUCION.nombre} height="96" />
      <div className="ct-autenticacion-encabezado">
        <p className="ct-autenticacion-app">{INSTITUCION.nombreApp}</p>
        <h1 id="titulo-ingreso">Bienvenido de vuelta</h1>
      </div>
      <form noValidate onSubmit={enviar} onBlur={marcarTocado}>
        <CampoFormulario
          etiqueta="Correo institucional" nombre="correoInstitucional" tipo="email" autoComplete="username"
          valor={campos.correoInstitucional} alCambiar={(valor) => cambiar('correoInstitucional', valor)}
          error={tocados.correoInstitucional ? errores.correoInstitucional : ''}
          ayuda={`Debe terminar en @${INSTITUCION.dominioCorreo}`} obligatorio deshabilitado={enviando}
        />
        <CampoFormulario
          etiqueta="Contraseña" nombre="clave" tipo="password" autoComplete="current-password"
          valor={campos.clave} alCambiar={(valor) => cambiar('clave', valor)}
          error={tocados.clave ? errores.clave : ''} obligatorio deshabilitado={enviando}
        />
        {(errorServicio || errorInicial) && <MensajeError mensaje={errorServicio || errorInicial} />}
        <Boton tipo="submit" anchoCompleto cargando={enviando}>Iniciar sesión</Boton>
      </form>
      <p className="ct-autenticacion-pie">¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
    </section>
  )
}
