// Conserva avisos y presenta las solicitudes propias o recibidas del tutor.
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import MisSolicitudes from './sesiones/MisSolicitudes.jsx'
import SesionesQueDoy from './sesiones/SesionesQueDoy.jsx'
import ResumenSesionesTutor from './sesiones/ResumenSesionesTutor.jsx'
import '../estilos/solicitante.css'
import '../estilos/tutor.css'

/** @returns {import('react').ReactElement} Sesiones por función del estudiante. */
export default function MisSesiones() {
  const { usuario } = useAutenticacion()
  const location = useLocation()
  const navigate = useNavigate()
  const resumenTutor = new URLSearchParams(location.search).get('vista') === 'resumen-tutor'
  const doy = location.pathname === '/solicitudes' || new URLSearchParams(location.search).get('vista') === 'doy' || resumenTutor
  useTituloPagina(doy && !resumenTutor ? 'Solicitudes del tutor' : 'Mis sesiones')
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState(location.state?.aviso ?? '')
  const [nombreTutor] = useState(location.state?.nombreTutor ?? '')
  const usuarioId = usuario.getId()
  useEffect(() => {
    if (location.state?.aviso) {
      navigate(location.pathname + location.search, { replace:true, state:null })
    }
  }, [location.state, location.pathname, location.search, navigate])
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setError('')
      try {
        const estudiante = await repositorio.obtenerUsuario(usuarioId)
        if (!estudiante) throw new Error('No encontramos tus datos. Vuelve a ingresar.')
        if (activo) setPerfil(estudiante.getPerfilTutor())
      } catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento])
  const correo = INSTITUCION.canalesPermanencia[usuario.getSede()]
  return <section className={`ct-solicitante ct-mis-sesiones${doy ? ' ct-solicitudes-recibidas' : ''}`}>
    {!resumenTutor && 
    <header className="ct-sesiones-titular">
        <h1>
        {doy ? `Hola, ${usuario.getNombre().split(' ')[0]}` : 'Tu espacio para seguir aprendiendo.'}
      </h1>
      {!doy && 
      <p className={aviso.startsWith('Calificación publicada') ? 'ct-calificacion-publicada' : undefined}>
        {aviso.startsWith('Calificación publicada') ? `Gracias. Tu calificación${nombreTutor ? ' de ' + nombreTutor : ''} fue publicada.` : 'Gestiona tus solicitudes y comparte cómo fue tu experiencia.'}
      </p>}
    </header>}
    {doy && <div role="status" className={aviso ? 'ct-aviso' : undefined}>{aviso}</div>}
    {cargando ? 
    <Cargando texto="Cargando tus sesiones…" /> : error ? 
    <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} /> : doy ? perfil ? resumenTutor ? 
    <ResumenSesionesTutor perfil={perfil} /> : 
    <SesionesQueDoy perfil={perfil} alAnunciar={setAviso} /> : 
    <EstadoVacio titulo="Activa tu perfil de tutor" accion={{ etiqueta:'Mi perfil', ruta:'/perfil' }} /> : 
    <MisSolicitudes aviso={aviso} />}
    <p className="ct-apoyo">¿Necesitas apoyo de la universidad? Escribe al Área de Permanencia de tu sede: <a href={`mailto:${correo}`}>{correo}</a></p>
  </section>
}

