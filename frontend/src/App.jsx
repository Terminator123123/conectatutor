// Define las rutas y sus permisos dentro del layout compartido.
import { Route, Routes } from 'react-router-dom'
import Layout from './componentes/layout/Layout.jsx'
import RutaProtegida from './componentes/layout/RutaProtegida.jsx'
import RutaSoloInvitados from './componentes/layout/RutaSoloInvitados.jsx'
import { RolUsuario } from './modelo/enums.js'
import Inicio from './paginas/Inicio.jsx'
import Registro from './paginas/Registro.jsx'
import Ingreso from './paginas/Ingreso.jsx'
import BusquedaTutores from './paginas/BusquedaTutores.jsx'
import DetalleTutor from './paginas/DetalleTutor.jsx'
import SolicitudSesion from './paginas/SolicitudSesion.jsx'
import MisSesiones from './paginas/MisSesiones.jsx'
import MiPerfil from './paginas/MiPerfil.jsx'
import VerificacionTutores from './paginas/VerificacionTutores.jsx'
import CatalogoComponentes from './paginas/CatalogoComponentes.jsx'
import NoEncontrada from './paginas/NoEncontrada.jsx'

/** @returns {import('react').ReactElement} Rutas públicas y protegidas de la aplicación. */
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/registro" element={<RutaSoloInvitados><Registro /></RutaSoloInvitados>} />
        <Route path="/ingresar" element={<RutaSoloInvitados><Ingreso /></RutaSoloInvitados>} />
        <Route path="/tutores" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><BusquedaTutores /></RutaProtegida>} />
        <Route path="/tutores/:id" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><DetalleTutor /></RutaProtegida>} />
        <Route path="/tutores/:id/solicitar" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><SolicitudSesion /></RutaProtegida>} />
        <Route path="/sesiones" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><MisSesiones /></RutaProtegida>} />
        <Route path="/perfil" element={<RutaProtegida roles={[RolUsuario.ESTUDIANTE]}><MiPerfil /></RutaProtegida>} />
        <Route path="/admin/verificacion" element={<RutaProtegida roles={[RolUsuario.ADMINISTRADOR]}><VerificacionTutores /></RutaProtegida>} />
        <Route path="/componentes" element={<CatalogoComponentes />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  )
}

export default App
