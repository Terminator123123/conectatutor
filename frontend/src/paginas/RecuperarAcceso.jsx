// Recupera el acceso con un enlace real enviado al correo institucional.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { repositorio } from '../servicios/instancias.js'
import { validarCorreo, validarClave, validarConfirmacion, estadoConfirmacion } from '../servicios/validacionesFormulario.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import EncabezadoPagina from '../componentes/layout/EncabezadoPagina.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import MarcaApp from '../componentes/ui/MarcaApp.jsx'
import '../estilos/autenticacion.css'

/**
 * Pasos: «correo» (pedir enlace) → «enviado»; con ?token= en la dirección:
 * «comprobando» → «nueva» (o «vencido») → «guardada».
 * @returns {import('react').ReactElement} Recuperación de acceso por correo.
 */
export default function RecuperarAcceso() {
  useTituloPagina('Recuperar acceso')
  const [parametros, setParametros] = useSearchParams()
  const token = parametros.get('token') ?? ''
  const [paso, setPaso] = useState(token ? 'comprobando' : 'correo')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [confirmacionTocada, setConfirmacionTocada] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) return undefined
    let activo = true
    repositorio.comprobarEnlaceRecuperacion(token)
      .then(() => { if (activo) setPaso('nueva') })
      .catch((fallo) => { if (activo) { setPaso(fallo.status === 400 ? 'vencido' : 'nueva'); if (fallo.status !== 400) setError(fallo.message) } })
    return () => { activo = false }
  }, [token])

  async function pedirEnlace(evento) {
    evento?.preventDefault()
    if (enviando) return
    const fallo = validarCorreo(correo, INSTITUCION.dominioCorreo)
    if (fallo) { setError(fallo); evento?.currentTarget.querySelector('input')?.focus(); return }
    setEnviando(true); setError('')
    try {
      await repositorio.pedirRecuperacion(correo.trim().toLowerCase())
      setPaso('enviado')
    } catch (problema) { setError(problema.message) }
    finally { setEnviando(false) }
  }

  async function guardarClave(evento) {
    evento.preventDefault()
    if (enviando) return
    setConfirmacionTocada(true)
    const fallo = validarClave(clave) || validarConfirmacion(confirmacion, clave)
    if (fallo) { setError(fallo); return }
    setEnviando(true); setError('')
    try {
      await repositorio.restablecerClave(token, clave)
      setParametros({}, { replace: true })
      setPaso('guardada')
    } catch (problema) {
      if (problema.status === 400 && /enlace/i.test(problema.message)) setPaso('vencido')
      else setError(problema.message)
    } finally { setEnviando(false) }
  }

  function pedirOtro() {
    setParametros({}, { replace: true }); setError(''); setClave(''); setConfirmacion(''); setPaso('correo')
  }

  return <section className="ct-autenticacion ct-recuperar">
    <div className="ct-recuperar-cabecera"><MarcaApp /><Link className="ct-boton btn-ct-secundario" to="/ingresar">Volver</Link></div>
    <h1 className="ct-recuperar-titulo">Recuperar acceso</h1>
    <EncabezadoPagina titulo="Recuperar acceso" ruta="/ingresar" />
    {paso === 'correo' ? <form noValidate onSubmit={pedirEnlace}>
      <h1>Recupera tu cuenta</h1>
      <p>Escribe el correo institucional con el que te registraste. Te enviaremos un enlace para crear una contraseña nueva.</p>
      <CampoFormulario
        etiqueta="Correo institucional"
        nombre="correo"
        tipo="email"
        valor={correo}
        alCambiar={(valor) => { setCorreo(valor); setError('') }} obligatorio
        autoComplete="email"
        deshabilitado={enviando}
        ayuda={`Debe terminar en @${INSTITUCION.dominioCorreo}.`} />
      {error && <MensajeError mensaje={error} />}
      <Boton tipo="submit" anchoCompleto cargando={enviando}>Enviar enlace</Boton>
    </form> : paso === 'enviado' ? <>
      <p className="ct-paso">Correo enviado</p><h1>Revisa tu correo</h1>
      <p role="status">Si <strong>{correo.trim().toLowerCase()}</strong> tiene una cuenta, en unos segundos te llegará un mensaje con el enlace. Vence en 30 minutos y sirve una sola vez.</p>
      <p>¿No lo ves? Revisa la carpeta de spam o pide otro enlace.</p>
      {error && <MensajeError mensaje={error} />}
      <Boton anchoCompleto variante="secundario" cargando={enviando} alHacerClic={() => pedirEnlace()}>Enviar otro enlace</Boton>
    </> : paso === 'comprobando' ? <Cargando texto="Comprobando el enlace…" />
    : paso === 'nueva' ? <form noValidate onSubmit={guardarClave}>
      <h1>Elige una nueva contraseña</h1><p>Mínimo 8 caracteres, con letras y números.</p>
      <CampoFormulario etiqueta="Nueva contraseña" nombre="clave" tipo="password" valor={clave}
        alCambiar={(valor) => { setClave(valor); setError('') }} autoComplete="new-password" deshabilitado={enviando} />
      <div onBlur={() => setConfirmacionTocada(Boolean(confirmacion))}>
        <CampoFormulario
          etiqueta="Confirmar contraseña"
          nombre="confirmacion"
          tipo="password"
          valor={confirmacion}
          alCambiar={(valor) => { setConfirmacion(valor); setError('') }}
          autoComplete="new-password"
          deshabilitado={enviando}
          {...estadoConfirmacion(confirmacion, clave, confirmacionTocada)} />
      </div>
      {error && <MensajeError mensaje={error} />}
      <Boton tipo="submit" anchoCompleto cargando={enviando}>Guardar contraseña</Boton>
    </form> : paso === 'guardada' ? <>
      <p className="ct-confirmacion-etiqueta">Contraseña actualizada</p><h1>Puedes volver a entrar</h1>
      <p role="status">Tu contraseña nueva ya está activa. El enlace que usaste dejó de servir.</p>
    </> : <>
      <p className="ct-confirmacion-etiqueta ct-etiqueta-error">Enlace vencido</p><h1>Este enlace ya no sirve</h1>
      <p>Los enlaces de recuperación duran 30 minutos y se pueden usar una sola vez. Pide uno nuevo para continuar.</p>
      <Boton anchoCompleto alHacerClic={pedirOtro}>Pedir otro enlace</Boton>
    </>}
    {paso !== 'comprobando' && <Link className={`${paso === 'guardada' ? 'btn-ct-primario' : 'btn-ct-secundario'} ct-boton ct-boton-completo`} to="/ingresar">
      {paso === 'guardada' ? 'Iniciar sesión' : 'Volver a iniciar sesión'}
    </Link>}
  </section>
}
