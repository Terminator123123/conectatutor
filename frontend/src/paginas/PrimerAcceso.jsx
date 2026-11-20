// Primer ingreso de una cuenta creada por Coordinación: contraseña propia, uso elegido y aviso de datos.
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { repositorio } from '../servicios/instancias.js'
import { cuentaSinActivar } from '../servicios/mapeoApi.js'
import { destinoPermitido, rutaInicialDe } from '../servicios/rutasPorRol.js'
import { estadoConfirmacion, validarClave } from '../servicios/validacionesFormulario.js'
import Boton from '../componentes/ui/Boton.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import MarcaApp from '../componentes/ui/MarcaApp.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import '../estilos/autenticacion.css'

/** @returns {import('react').ReactElement} Activación de la cuenta. */
export default function PrimerAcceso() {
  useTituloPagina('Activa tu cuenta')
  const { usuario, actualizarUsuario, cerrarSesion } = useAutenticacion()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [campos, setCampos] = useState({ clave: '', confirmacion: '' })
  const [tocados, setTocados] = useState({})
  const [uso, setUso] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const cambiar = (nombre) => (valor) => { setCampos((anteriores) => ({ ...anteriores, [nombre]: valor })); setError('') }
  const errorClave = campos.clave ? validarClave(campos.clave) : ''
  const confirmacion = estadoConfirmacion(campos.confirmacion, campos.clave, tocados.confirmacion)

  function marcarTocado(evento) {
    const nombre = evento.target.name
    if (nombre && campos[nombre]) setTocados((anteriores) => ({ ...anteriores, [nombre]: true }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTocados({ clave: true, confirmacion: true })
    const fallo = validarClave(campos.clave)
      || (campos.confirmacion !== campos.clave && 'Las contraseñas no coinciden.')
      || (!uso && 'Elige si quieres aprender o también enseñar.')
      || (!acepta && 'Para usar ConectaTutor debes aceptar el tratamiento de tus datos.')
    if (fallo) { setError(fallo); return }
    setEnviando(true)
    try {
      let activado
      try {
        // La cuenta que confirma la activación se usa directamente: no depende de otra lectura
        activado = await actualizarUsuario(await repositorio.completarPrimerAcceso({
          claveNueva: campos.clave, quiereSerTutor: uso === 'tutor', aceptaTratamientoDatos: true,
        }))
      } catch (problema) {
        // 409: la activación ya quedó guardada (p. ej. se perdió la respuesta anterior). Se relee la cuenta.
        if (problema.status !== 409) throw problema
        activado = await actualizarUsuario()
        if (cuentaSinActivar(activado)) throw problema
      }
      if (!activado) return
      const desde = state?.desde
      navigate(uso === 'tutor' ? '/perfil' : destinoPermitido(desde, activado) ? desde : rutaInicialDe(activado), { replace: true })
    } catch (problema) {
      setError(problema.message)
      setEnviando(false)
    }
  }

  return <section className="ct-autenticacion ct-primer-acceso" aria-labelledby="titulo-primer-acceso">
    <MarcaApp />
    <div className="ct-autenticacion-encabezado">
      <h1 id="titulo-primer-acceso">Hola, {usuario?.getNombre().split(' ')[0]}. Activa tu cuenta</h1>
      <p>Uniguajira creó tu cuenta con tu documento como contraseña inicial. Antes de empezar, crea una contraseña propia.</p>
    </div>
    <form noValidate onSubmit={enviar} onBlur={marcarTocado}>
      <CampoFormulario etiqueta="Contraseña nueva" nombre="clave" tipo="password" autoComplete="new-password"
        valor={campos.clave} alCambiar={cambiar('clave')} deshabilitado={enviando}
        error={tocados.clave ? errorClave : ''} ayuda="Mínimo 8 caracteres, con letras y números. No uses tu documento." />
      <CampoFormulario etiqueta="Confirmar contraseña" nombre="confirmacion" tipo="password" autoComplete="new-password"
        valor={campos.confirmacion} alCambiar={cambiar('confirmacion')} deshabilitado={enviando} {...confirmacion} />
      <div>
        <p id="uso-primer-acceso">¿Cómo quieres usar ConectaTutor?</p>
        <div role="group" aria-labelledby="uso-primer-acceso" className="ct-uso-opciones">
          <button type="button" className="ct-uso-opcion" aria-pressed={uso === 'buscar'} onClick={() => { setUso('buscar'); setError('') }} disabled={enviando}>
            <strong>Necesito ayuda</strong><small>Busco tutores</small>
          </button>
          <button type="button" className="ct-uso-opcion" aria-pressed={uso === 'tutor'} onClick={() => { setUso('tutor'); setError('') }} disabled={enviando}>
            <strong>También quiero enseñar</strong><small>Crearé mi perfil de tutor</small>
          </button>
        </div>
      </div>
      <div className="ct-aviso-datos">
        <p>Usamos tus datos de cuenta y académicos para gestionar tu perfil, tus solicitudes y tus tutorías. Tu nombre, biografía y reseñas son visibles para la comunidad; tu correo no.</p>
        <a href={INSTITUCION.urlTratamientoDatos} target="_blank" rel="noreferrer">Leer el aviso de privacidad de Uniguajira</a>
        <label className="ct-casilla">
          <input type="checkbox" checked={acepta} onChange={(evento) => { setAcepta(evento.target.checked); setError('') }} disabled={enviando} />
          <span>Acepto el tratamiento de mis datos personales (Ley 1581 de 2012).</span>
        </label>
      </div>
      {error && <MensajeError mensaje={error} />}
      <Boton tipo="submit" anchoCompleto cargando={enviando}>Activar mi cuenta</Boton>
    </form>
    <Boton variante="secundario" anchoCompleto deshabilitado={enviando} alHacerClic={() => { cerrarSesion(); navigate('/', { replace: true }) }}>Salir sin activar</Boton>
  </section>
}
