// Presenta el estado vacío de reportes del recorrido sin servidor.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/tutor.css'

function listarReportes() {
  return []
}

/** @returns {import('react').ReactElement} Reportes pendientes y resueltos de muestra. */
export default function Reportes() {
  useTituloPagina('Revisar reportes')
  const [vista, setVista] = useState('pendientes')
  const [reportes] = useState(listarReportes)
  return <section className="ct-gestion-materias"><h1>Revisar reportes</h1>
    <p className="ct-demostracion">Demostración: la recepción y revisión de reportes aún no están disponibles.</p>
    <div className="ct-tabs-estado" role="group" aria-label="Estado de los reportes">
      {['pendientes','resueltos'].map((estado) => <button key={estado} type="button" aria-pressed={vista === estado} onClick={() => setVista(estado)}>
        {estado === 'pendientes' ? 'Pendientes' : 'Resueltos'}
      </button>)}
    </div>
    {!reportes.length && 
    <EstadoVacio
      icono="bi-shield-check"
      titulo={vista === 'pendientes' ? 'No hay reportes pendientes' : 'No hay reportes resueltos'}
      texto="Reportes de la comunidad." />}
    <Link className="ct-boton btn-ct-secundario" to="/admin/verificacion">Volver a Coordinación</Link>
  </section>
}

