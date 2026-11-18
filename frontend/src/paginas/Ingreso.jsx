// Inicia sesión y recupera el destino solicitado cuando corresponde al rol.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { destinoPermitido, rutaInicialDe, vieneDeSolicitud } from '../servicios/rutasPorRol.js'
import { validarCorreo } from '../servicios/validacionesFormulario.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import MarcaApp from '../componentes/ui/MarcaApp.jsx'
import '../estilos/autenticacion.css'

/** @returns {import('react').ReactElement} Formulario de ingreso institucional. */
export default function Ingreso() {
  useTituloPagina('Qué bueno verte.')
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
    if (nombre === 'clave' && valor) setErrorServicio('')
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
      setTocados((anteriores) => ({ ...anteriores, clave: false }))
      document.querySelector('input[name="clave"]')?.focus()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="ct-autenticacion ct-autenticacion-ingreso" aria-labelledby="titulo-ingreso">
      <MarcaApp />
      <div className="ct-autenticacion-encabezado">
        <h1 id="titulo-ingreso">Qué bueno verte.</h1>
        <p>Tu próxima tutoría empieza aquí.</p>
      </div>
      {vieneDeSolicitud(location.state?.desde) && <p className="ct-aviso-invitado" role="status">
        <i className="bi bi-calendar-plus" aria-hidden="true" />
        <span>Para solicitar la tutoría, ingresa con tu cuenta institucional. Después sigues con la solicitud justo donde ibas.</span>
      </p>}
      <form noValidate onSubmit={enviar} onBlur={marcarTocado}>
        <CampoFormulario
          etiqueta="Correo institucional" nombre="correoInstitucional" tipo="email" autoComplete="username"
          valor={campos.correoInstitucional} alCambiar={(valor) => cambiar('correoInstitucional', valor)}
          error={tocados.correoInstitucional ? errores.correoInstitucional : ''}
          obligatorio deshabilitado={enviando}
        />
        <CampoFormulario
          etiqueta="Contraseña" nombre="clave" tipo="password" autoComplete="current-password"
          valor={campos.clave} alCambiar={(valor) => cambiar('clave', valor)}
          error={tocados.clave ? errores.clave : ''} obligatorio deshabilitado={enviando}
        />
        <Link className="ct-enlace-pequeno" to="/recuperar-acceso">¿Has olvidado tu contraseña?</Link>
        {(errorServicio || errorInicial) && <MensajeError mensaje={errorServicio || errorInicial} />}
        <Boton tipo="submit" anchoCompleto cargando={enviando}>Iniciar sesión</Boton>
      </form>
    </section>
  )
}
