// Define las rutas públicas del bloque base dentro del layout compartido.
import { Route, Routes } from 'react-router-dom'
import Layout from './componentes/layout/Layout.jsx'
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

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/ingresar" element={<Ingreso />} />
        <Route path="/tutores" element={<BusquedaTutores />} />
        <Route path="/tutores/:id" element={<DetalleTutor />} />
        <Route path="/tutores/:id/solicitar" element={<SolicitudSesion />} />
        <Route path="/sesiones" element={<MisSesiones />} />
        <Route path="/perfil" element={<MiPerfil />} />
        <Route path="/admin/verificacion" element={<VerificacionTutores />} />
        <Route path="/componentes" element={<CatalogoComponentes />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  )
}

export default App
