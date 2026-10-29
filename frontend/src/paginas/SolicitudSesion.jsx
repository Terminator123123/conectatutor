// Pantalla provisional de Solicitud de sesión con el identificador de la ruta.
import { useParams } from 'react-router-dom'

function SolicitudSesion() {
  const { id } = useParams()

  return (
    <>
      <h1>Solicitud de sesión</h1>
      <p>En construcción</p>
      <p>Identificador del tutor: {id}</p>
    </>
  )
}

export default SolicitudSesion
