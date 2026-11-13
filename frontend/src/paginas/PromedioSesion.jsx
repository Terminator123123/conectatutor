// Explica el aporte de una calificación al promedio calculado con sesiones reales.
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
  if (errorSesion) return <MensajeError mensaje={errorSesion} alReintentar={reintentar} />
  if (!sesion?.getCalificacion()) return <EstadoVacio titulo="Esta sesión aún no tiene una calificación" accion={{ etiqueta:'Volver a mis sesiones', ruta:'/sesiones?estado=finalizadas' }} />
  if (cargando) return <Cargando texto="Calculando el promedio…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
  const nota = sesion.getCalificacion()
  const estaIncluida = resenas.some((resena) => resena.puntaje === nota.getPuntaje()
    && resena.resena === nota.getResena() && new Date(resena.fecha).getTime() === nota.getFecha().getTime())
  if (!estaIncluida) return <EstadoVacio titulo="La valoración ya no está disponible" accion={{ etiqueta:'Volver a mis sesiones', ruta:'/sesiones' }} />
  const cantidadAntes = resenas.length - 1
  const sumaDespues = resenas.reduce((total, resena) => total + resena.puntaje, 0)
  const sumaAntes = sumaDespues - nota.getPuntaje()
  const promedio = sumaDespues / resenas.length
  const numero = (valor, decimales = 1) => valor.toFixed(decimales).replace('.', ',')
  return <section className="ct-estado-formulario">
    <h1>Tu reseña ya forma parte del promedio
    </h1>
    <p className="ct-texto-secundario">El promedio se recalcula con cada reseña nueva: suma de calificaciones dividida entre el número de reseñas.
    </p>
    <div className="ct-dato">
        <small>Antes
      </small>
      {cantidadAntes ? `${numero(sumaAntes / cantidadAntes)} de 5, ${cantidadAntes} ${cantidadAntes === 1 ? 'reseña' : 'reseñas'}, suma: ${sumaAntes}` : 'Sin reseñas anteriores, suma: 0'}
    </div>
    <div className="ct-dato"><small>Nueva calificación</small>{sesion.getCalificacion().getPuntaje()} de 5, 1 reseña nueva</div>
    <div className="ct-dato"><small>Después</small>{sumaDespues} ÷ {resenas.length} = {numero(promedio, 2)}, mostrado: {numero(promedio)} de 5</div>
    <p className="ct-promedio-aclaracion">La comparación «Antes» excluye esta reseña del cálculo actual.</p>
    <div className="ct-estado-formulario-acciones"><Link className="ct-boton btn-ct-primario" to="/sesiones?estado=finalizadas">Volver a mis sesiones</Link></div>
  </section>
}
