// Presenta la cuenta de Coordinación y permite cerrar su sesión.
import { useNavigate } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import FotoPerfil from '../componentes/cuenta/FotoPerfil.jsx'
import CambioClave from '../componentes/cuenta/CambioClave.jsx'

/** @returns {import('react').ReactElement} Perfil de la cuenta administrativa. */
export default function PerfilCoordinacion() {
  useTituloPagina('Mi perfil')
  const { usuario, cerrarSesion } = useAutenticacion()
  const navigate = useNavigate()
  return <section className="ct-autenticacion"><Avatar nombre={usuario.getNombre()} usuarioId={usuario.getId()} tamano={72} />
    <h1>{usuario.getNombre()}</h1><p>Coordinación</p><p>{usuario.getCorreo()}</p>
    <FotoPerfil usuario={usuario} />
    <CambioClave />
    <Boton variante="secundario" alHacerClic={() => { cerrarSesion(); navigate('/') }}>Salir</Boton>
  </section>
}
