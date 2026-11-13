// Recorre la recuperación de acceso sin enviar correo ni modificar credenciales.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { validarCorreo, validarClave, validarConfirmacion } from '../servicios/validacionesFormulario.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import EncabezadoPagina from '../componentes/layout/EncabezadoPagina.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import MarcaApp from '../componentes/ui/MarcaApp.jsx'
import '../estilos/autenticacion.css'

/** @returns {import('react').ReactElement} Recuperación y estados del enlace de muestra. */
export default function RecuperarAcceso() {
  useTituloPagina('Recuperar acceso')
  const [paso, setPaso] = useState('correo')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  function simular(siguiente) {
    setError('')
    setPaso(siguiente)
  }
  function enviar(evento) {
    evento.preventDefault()
    const fallo = paso === 'correo' ? validarCorreo(correo, INSTITUCION.dominioCorreo) : validarClave(clave) || validarConfirmacion(confirmacion, clave)
    if (fallo) { setError(fallo); evento.currentTarget.querySelector('input')?.focus(); return }
    simular(paso === 'correo' ? 'enlace' : 'guardada')
  }
  return <section className="ct-autenticacion ct-recuperar">
    <div className="ct-recuperar-cabecera"><MarcaApp /><Link className="ct-boton btn-ct-secundario" to="/ingresar">Volver</Link></div>
    <h1 className="ct-recuperar-titulo">Recuperar acceso</h1>
    <EncabezadoPagina titulo="Recuperar acceso" ruta="/ingresar" />
    <p className="ct-demostracion">Demostración: no se envían correos ni se cambia tu contraseña.</p>
    {paso === 'correo' ? <form noValidate onSubmit={enviar}>
      <h1>Recupera tu cuenta</h1><p>Usa el correo institucional con el que te registraste.</p>
      <CampoFormulario
        etiqueta="Correo institucional"
        nombre="correo"
        tipo="email"
        valor={correo}
        alCambiar={setCorreo} obligatorio
        autoComplete="email"
        ayuda={`Debe terminar en @${INSTITUCION.dominioCorreo}.`} />
      {error && <MensajeError mensaje={error} />}
      <Boton tipo="submit" anchoCompleto>Abrir el correo</Boton>
    </form> : paso === 'enlace' ? <>
      <p className="ct-paso">Correo de recuperación</p><h1>Revisa tu correo</h1>
      <p role="status">Este es un ejemplo del enlace de recuperación. No se envió ningún correo.</p>
      <div className="ct-dato"><small>Destinatario</small>{correo}</div>
      <div className="ct-dato"><small>Acción del mensaje</small>Restablecer mi contraseña</div>
      <p>Si no ves el correo, revisa la carpeta de spam.</p>
      <Boton anchoCompleto alHacerClic={() => simular('nueva')}>Crear contraseña nueva</Boton>
      <Boton anchoCompleto variante="secundario" alHacerClic={() => simular('vencido')}>Ver enlace vencido</Boton>
    </> : paso === 'nueva' ? <form noValidate onSubmit={enviar}>
      <h1>Elige una nueva contraseña</h1><p>La contraseña debe tener al menos 8 caracteres.</p>
      <CampoFormulario etiqueta="Nueva contraseña" nombre="clave" tipo="password" valor={clave} alCambiar={setClave} autoComplete="new-password" ayuda="Mínimo 8 caracteres." />
      <CampoFormulario
        etiqueta="Confirmar contraseña"
        nombre="confirmacion"
        tipo="password"
        valor={confirmacion}
        alCambiar={setConfirmacion}
        autoComplete="new-password"
        ayuda="Ambos campos deben coincidir." />
      {error && <MensajeError mensaje={error} />}<Boton tipo="submit" anchoCompleto>Guardar contraseña</Boton>
      <Boton anchoCompleto variante="secundario" alHacerClic={() => simular('correo')}>Cancelar</Boton>
    </form> : paso === 'guardada' ? <>
      <p className="ct-confirmacion-etiqueta">Restablecimiento completado</p><h1>Puedes volver a entrar</h1>
      <p role="status">Terminó el ejemplo de recuperación. Tu contraseña no se modificó.</p><div className="ct-dato"><small>Cuenta de ejemplo</small>{correo}</div>
    </> : <>
      <p className="ct-confirmacion-etiqueta ct-etiqueta-error">Enlace vencido</p><h1>Este enlace ya no está disponible</h1>
      <p>El enlace de recuperación venció. Solicita uno nuevo para continuar.</p>
      <CampoFormulario etiqueta="Estado del enlace" valor="Vencido" alCambiar={() => {}} error="No cambies la contraseña desde un enlace vencido." />
      <Boton anchoCompleto alHacerClic={() => simular('correo')}>Solicitar otro enlace</Boton>
    </>}
    <Link className={`${paso === 'guardada' ? 'btn-ct-primario' : 'btn-ct-secundario'} ct-boton ct-boton-completo`} to="/ingresar">
      {paso === 'guardada' ? 'Iniciar sesión' : 'Volver a iniciar sesión'}
    </Link>
  </section>
}
