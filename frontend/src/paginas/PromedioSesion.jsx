// Confirma que la reseña quedó publicada y muestra el nuevo promedio del tutor.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useSesion } from '../hooks/useSesion.js'
import { repositorio } from '../servicios/instancias.js'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Comparación numérica sin duplicar ni modificar calificaciones. */
export default function PromedioSesion() {
  useTituloPagina('Valoración')
  const { id } = useParams()
  const { usuario } = useAutenticacion()
  const { sesion, cargando:cargandoSesion, error:errorSesion, reintentar } = useSesion(id, usuario.getId())
  const [resenas, setResenas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!sesion) return
    let activo = true
    async function cargar() {
      setCargando(true); setError('')
      try { const resumen = await repositorio.obtenerResumenTutor(sesion.getTutor().getId()); if (activo) setResenas(resumen.resenas) }
      catch (fallo) { if (activo) setError(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [sesion, intento])
  if (cargandoSesion) return <Cargando texto="Cargando valoración…" />
  if (errorSesion) return <MensajeError mensaje={errorSesion} alReintentar={reintentar} forma="perfil" />
  if (!sesion?.getCalificacion()) return <EstadoVacio titulo="Esta sesión aún no tiene una calificación" accion={{ etiqueta:'Volver a mis sesiones', ruta:'/sesiones?estado=finalizadas' }} />
  if (cargando) return <Cargando texto="Calculando el promedio…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} forma="perfil" />
  const nota = sesion.getCalificacion()
  const estaIncluida = resenas.some((resena) => resena.puntaje === nota.getPuntaje()
    && resena.resena === nota.getResena() && new Date(resena.fecha).getTime() === nota.getFecha().getTime())
  if (!estaIncluida) return <EstadoVacio titulo="La valoración ya no está disponible" accion={{ etiqueta:'Volver a mis sesiones', ruta:'/sesiones' }} />
  const promedio = resenas.reduce((total, resena) => total + resena.puntaje, 0) / resenas.length
  const cantidad = `${resenas.length} ${resenas.length === 1 ? 'reseña' : 'reseñas'}`
  return <section className="ct-estado-formulario">
    <h1>¡Gracias!</h1>
    <p>Tu reseña quedó publicada. El tutor ahora tiene ★ {promedio.toFixed(1).replace('.', ',')} con {cantidad}.</p>
    <div className="ct-estado-formulario-acciones"><Link className="ct-boton btn-ct-primario" to="/sesiones?estado=finalizadas">Volver a mis sesiones</Link></div>
  </section>
}
