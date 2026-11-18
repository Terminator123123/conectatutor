// Define las rutas y sus permisos dentro del layout compartido.
import { Route, Routes } from 'react-router-dom'
import Layout from './componentes/layout/Layout.jsx'
import RutaProtegida from './componentes/layout/RutaProtegida.jsx'
import RutaSoloInvitados from './componentes/layout/RutaSoloInvitados.jsx'
import RutaAbierta from './componentes/layout/RutaAbierta.jsx'
import { RolUsuario } from './modelo/enums.js'
import Inicio from './paginas/Inicio.jsx'
import Ingreso from './paginas/Ingreso.jsx'
import BusquedaTutores from './paginas/BusquedaTutores.jsx'
import DetalleTutor from './paginas/DetalleTutor.jsx'
import SolicitudSesion from './paginas/SolicitudSesion.jsx'
import MisSesiones from './paginas/MisSesiones.jsx'
import MiPerfil from './paginas/MiPerfil.jsx'
import VerificacionTutores from './paginas/VerificacionTutores.jsx'
import CatalogoComponentes from './paginas/CatalogoComponentes.jsx'
import NoEncontrada from './paginas/NoEncontrada.jsx'
import PerfilCoordinacion from './paginas/PerfilCoordinacion.jsx'
import RecuperarAcceso from './paginas/RecuperarAcceso.jsx'
import Favoritos from './paginas/Favoritos.jsx'
import Reportar from './paginas/Reportar.jsx'
import DetalleSesion from './paginas/DetalleSesion.jsx'
import CalificarSesion from './paginas/CalificarSesion.jsx'
import GestionMaterias from './paginas/GestionMaterias.jsx'
import Reportes from './paginas/Reportes.jsx'
import PromedioSesion from './paginas/PromedioSesion.jsx'
import Notificaciones from './paginas/Notificaciones.jsx'
import ReprogramarSesion from './paginas/ReprogramarSesion.jsx'
import SesionExpirada from './paginas/SesionExpirada.jsx'
import PrimerAcceso from './paginas/PrimerAcceso.jsx'
import CuentasEstudiantes from './paginas/CuentasEstudiantes.jsx'

/** @returns {import('react').ReactElement} Rutas públicas y protegidas de la aplicación. */
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Se entra directo a la búsqueda: explorar no exige cuenta; solicitar sí. */}
        <Route path="/" element={<RutaAbierta><BusquedaTutores /></RutaAbierta>} />
        <Route path="/como-funciona" element={<Inicio />} />
        <Route path="/ingresar" element={<RutaSoloInvitados><Ingreso /></RutaSoloInvitados>} />
        <Route path="/recuperar-acceso" element={<RutaSoloInvitados><RecuperarAcceso /></RutaSoloInvitados>} />
        <Route path="/sesion-expirada" element={<RutaSoloInvitados><SesionExpirada /></RutaSoloInvitados>} />
        <Route path="/notificaciones" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><Notificaciones /></RutaProtegida>} />
        <Route path="/tutores" element={<RutaAbierta><BusquedaTutores /></RutaAbierta>} />
        <Route path="/favoritos" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><Favoritos /></RutaProtegida>} />
        <Route path="/reportar" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><Reportar /></RutaProtegida>} />
        <Route path="/tutores/:id" element={<RutaAbierta><DetalleTutor /></RutaAbierta>} />
        <Route path="/tutores/:id/solicitar" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><SolicitudSesion /></RutaProtegida>} />
        <Route path="/sesiones" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><MisSesiones /></RutaProtegida>} />
        <Route path="/sesiones/:id" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><DetalleSesion /></RutaProtegida>} />
        <Route path="/sesiones/:id/reprogramar" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><ReprogramarSesion /></RutaProtegida>} />
        <Route path="/sesiones/:id/calificar" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><CalificarSesion /></RutaProtegida>} />
        <Route path="/sesiones/:id/promedio" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><PromedioSesion /></RutaProtegida>} />
        <Route path="/solicitudes" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><MisSesiones /></RutaProtegida>} />
        <Route path="/admin/perfil" element={<RutaProtegida roles={[RolUsuario.ADMINISTRADOR]}><PerfilCoordinacion /></RutaProtegida>} />
        <Route path="/perfil" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><MiPerfil /></RutaProtegida>} />
        <Route path="/admin/verificacion" element={<RutaProtegida roles={[RolUsuario.ADMINISTRADOR]}><VerificacionTutores /></RutaProtegida>} />
        <Route path="/admin/materias" element={<RutaProtegida roles={[RolUsuario.ADMINISTRADOR]}><GestionMaterias /></RutaProtegida>} />
        <Route path="/admin/cuentas" element={<RutaProtegida roles={[RolUsuario.ADMINISTRADOR]}><CuentasEstudiantes /></RutaProtegida>} />
        <Route path="/primer-acceso" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><PrimerAcceso /></RutaProtegida>} />
        <Route path="/admin/reportes" element={<RutaProtegida roles={[RolUsuario.ADMINISTRADOR]}><Reportes /></RutaProtegida>} />
        <Route path="/componentes" element={<CatalogoComponentes />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  )
}

export default App
