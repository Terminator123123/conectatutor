// Cambia la contraseña desde la cuenta: pide la actual y compara la confirmación desde la primera letra.
import { useState } from 'react'
import { repositorio } from '../../servicios/instancias.js'
import { estadoConfirmacion, validarClave } from '../../servicios/validacionesFormulario.js'
import Boton from '../ui/Boton.jsx'
import CampoFormulario from '../ui/CampoFormulario.jsx'
import MensajeError from '../ui/MensajeError.jsx'

const VACIOS = { actual: '', nueva: '', confirmacion: '' }

/** @returns {import('react').ReactElement} Formulario de cambio de contraseña. */
export default function CambioClave() {
  const [campos, setCampos] = useState(VACIOS)
  const [tocados, setTocados] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const cambiar = (nombre) => (valor) => { setCampos((anteriores) => ({ ...anteriores, [nombre]: valor })); setError(''); setAviso('') }
  const errorNueva = campos.nueva ? validarClave(campos.nueva) : ''
  const confirmacion = estadoConfirmacion(campos.confirmacion, campos.nueva, tocados.confirmacion)

  function marcarTocado(evento) {
    const nombre = evento.target.name
    if (nombre && campos[nombre]) setTocados((anteriores) => ({ ...anteriores, [nombre]: true }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTocados({ actual: true, nueva: true, confirmacion: true })
    const fallo = (!campos.actual && 'Escribe tu contraseña actual.') || validarClave(campos.nueva)
      || (campos.confirmacion !== campos.nueva && 'Las contraseñas no coinciden.')
    if (fallo) { setError(fallo); return }
    setEnviando(true)
    try {
      await repositorio.cambiarClave(campos.actual, campos.nueva)
      setCampos(VACIOS); setTocados({}); setAviso('Contraseña actualizada. Úsala la próxima vez que ingreses.')
    } catch (problema) { setError(problema.message) }
    finally { setEnviando(false) }
  }

  return <section className="ct-cuenta-seccion" aria-labelledby="titulo-clave">
    <h2 id="titulo-clave">Cambiar contraseña</h2>
    <form noValidate onSubmit={enviar} onBlur={marcarTocado}>
      <CampoFormulario etiqueta="Contraseña actual" nombre="actual" tipo="password" autoComplete="current-password"
        valor={campos.actual} alCambiar={cambiar('actual')} deshabilitado={enviando}
        error={tocados.actual && !campos.actual ? 'Escribe tu contraseña actual.' : ''} />
      <CampoFormulario etiqueta="Contraseña nueva" nombre="nueva" tipo="password" autoComplete="new-password"
        valor={campos.nueva} alCambiar={cambiar('nueva')} deshabilitado={enviando}
        error={tocados.nueva ? errorNueva : ''} ayuda="Mínimo 8 caracteres, con letras y números." />
      <CampoFormulario etiqueta="Confirmar contraseña nueva" nombre="confirmacion" tipo="password" autoComplete="new-password"
        valor={campos.confirmacion} alCambiar={cambiar('confirmacion')} deshabilitado={enviando} {...confirmacion} />
      {error && <MensajeError mensaje={error} />}
      <p role="status" className={aviso ? 'ct-aviso' : 'visually-hidden'}>{aviso}</p>
      <Boton tipo="submit" cargando={enviando}>Guardar contraseña</Boton>
    </form>
  </section>
}
