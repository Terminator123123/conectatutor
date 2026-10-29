// Pantalla provisional de Detalle del tutor con el identificador de la ruta.
import { useParams } from 'react-router-dom'

function DetalleTutor() {
  const { id } = useParams()

  return (
    <>
      <h1>Detalle del tutor</h1>
      <p>En construcción</p>
      <p>Identificador del tutor: {id}</p>
    </>
  )
}

export default DetalleTutor
