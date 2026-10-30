// Organiza solicitudes y tutorías ofrecidas con pestañas que conservan su URL.
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import MisSolicitudes from './sesiones/MisSolicitudes.jsx'
import SesionesQueDoy from './sesiones/SesionesQueDoy.jsx'
import '../estilos/solicitante.css'
import '../estilos/tutor.css'

/** @returns {import('react').ReactElement} Sesiones del estudiante en sus dos funciones. */
export default function MisSesiones() {
  const { usuario } = useAutenticacion()
  const usuarioId = usuario.getId()
  const location = useLocation()
  const navigate = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const [aviso, setAviso] = useState(location.state?.aviso ?? '')
  useEffect(() => {
    if (location.state?.aviso) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const estudiante = await repositorio.obtenerUsuario(usuarioId)
        if (!estudiante) throw new Error('No encontramos tus datos. Vuelve a ingresar.')
        if (activo) setPerfil(estudiante.getPerfilTutor())
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [usuarioId, intento])
  const vista = perfil && parametros.get('vista') === 'doy' ? 'doy' : 'solicitudes'
  function cambiarVista(valor) {
    setParametros((anteriores) => { const nuevos = new URLSearchParams(anteriores); nuevos.set('vista', valor); return nuevos })
  }
  function usarFlechas(evento) {
    if (!['ArrowLeft', 'ArrowRight'].includes(evento.key)) return
    evento.preventDefault()
    const botones = [...evento.currentTarget.querySelectorAll('[role="tab"]')]
    const siguiente = botones[(botones.indexOf(document.activeElement) + 1) % botones.length]
    siguiente.focus()
    siguiente.click()
  }
  const correo = INSTITUCION.canalesPermanencia[usuario.getSede()]
  return <section className="ct-solicitante ct-mis-sesiones">
    <h1>Mis sesiones</h1>
    <div role="status" className={aviso ? 'ct-aviso' : undefined}>{aviso}</div>
    {cargando ? <Cargando texto="Cargando tus sesiones…" /> : error ? <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} /> : <>
      {perfil ? <>
        <div role="tablist" aria-label="Tipo de sesiones" className="ct-pestanas" onKeyDown={usarFlechas}>
          {[['solicitudes', 'Mis solicitudes'], ['doy', 'Sesiones que doy']].map(([valor, etiqueta]) => <button key={valor} type="button" role="tab" id={`sesiones-tab-${valor}`} aria-selected={vista === valor} aria-controls={`sesiones-panel-${valor}`} tabIndex={vista === valor ? 0 : -1} onClick={() => cambiarVista(valor)}>{etiqueta}</button>)}
        </div>
        <div role="tabpanel" id="sesiones-panel-solicitudes" aria-labelledby="sesiones-tab-solicitudes" hidden={vista !== 'solicitudes'}>{vista === 'solicitudes' && <MisSolicitudes alAnunciar={setAviso} />}</div>
        <div role="tabpanel" id="sesiones-panel-doy" aria-labelledby="sesiones-tab-doy" hidden={vista !== 'doy'}>{vista === 'doy' && <SesionesQueDoy perfil={perfil} alAnunciar={setAviso} />}</div>
      </> : <MisSolicitudes alAnunciar={setAviso} />}
    </>}
    <p className="ct-apoyo">¿Necesitas apoyo de la universidad? Escribe al Área de Permanencia de tu sede: <a href={`mailto:${correo}`}>{correo}</a></p>
  </section>
}
