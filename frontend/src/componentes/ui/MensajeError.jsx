// Presenta un error. Si es de conexión, no ofrece botón: vuelve a intentar solo y avisa que lo está haciendo.
import { useEffect, useState } from 'react'
import { estadoConexion, MENSAJE_SIN_CONEXION } from '../../servicios/api.js'
import Boton from './Boton.jsx'
import Cargando from './Cargando.jsx'

/** Espera antes del siguiente intento automático: crece con los fallos seguidos (3 s, 6 s, 12 s… hasta 30 s). */
const esperaPara = (fallos) => Math.min(30000, 3000 * 2 ** Math.max(0, fallos - 1))

/**
 * Muestra un mensaje de error como alerta accesible.
 * @param {object} props Propiedades de la alerta.
 * @param {string} props.mensaje Explicación del error para el usuario.
 * @param {'marca'|'tarjetas'|'lista'|'perfil'|'formulario'|'campo'} [props.forma] Esqueleto que se muestra mientras reconecta, igual al de la pantalla.
 * @param {function(): void} [props.alReintentar] Vuelve a cargar. En errores de conexión se llama sola.
 * @returns {import('react').ReactElement} Alerta.
 */
export default function MensajeError({ mensaje, alReintentar, forma }) {
  const sinConexion = mensaje === MENSAJE_SIN_CONEXION
  const reconectando = sinConexion && Boolean(alReintentar)
  const [fallos] = useState(() => estadoConexion.fallosSeguidos)

  useEffect(() => {
    if (!reconectando) return undefined
    // Reintenta solo: al volver la red de inmediato, si no, con esperas cada vez más largas.
    const reintentar = () => alReintentar()
    const temporizador = setTimeout(reintentar, esperaPara(fallos))
    window.addEventListener('online', reintentar)
    return () => { clearTimeout(temporizador); window.removeEventListener('online', reintentar) }
  }, [reconectando, alReintentar, fallos])

  if (reconectando) {
    const aviso = (
      <div className="ct-mensaje-error ct-reconectando" role="status">
        <div className="ct-mensaje-error-contenido">
          <span className="ct-reconectando-indicador" aria-hidden="true" />
          <p>
            {fallos >= 3
              ? 'Seguimos sin poder conectarnos. Puede ser tu internet o el servidor; inténtalo más tarde.'
              : 'Se perdió la conexión. Estamos intentando reconectar…'}
          </p>
        </div>
      </div>
    )
    // Con el esqueleto de la pantalla debajo, para que no quede vacía mientras vuelve la conexión
    return forma ? <Cargando forma={forma} texto="Reconectando…" aviso={aviso} /> : aviso
  }

  return (
    <div className="ct-mensaje-error" role="alert">
      <div className="ct-mensaje-error-contenido">
        <i className="bi bi-exclamation-circle" aria-hidden="true" />
        <p>{sinConexion ? 'No pudimos conectarnos con ConectaTutor. Revisa tu conexión a internet e inténtalo en un momento.' : mensaje}</p>
      </div>
      {alReintentar && !sinConexion && (
        <Boton variante="secundario" alHacerClic={alReintentar}>Reintentar</Boton>
      )}
    </div>
  )
}
