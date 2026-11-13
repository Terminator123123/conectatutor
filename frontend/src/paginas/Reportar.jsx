// Reproduce el envío de un reporte de perfil o reseña sin servidor.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { repositorio } from '../servicios/instancias.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import EncabezadoPagina from '../componentes/layout/EncabezadoPagina.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Formulario de reporte y confirmación de muestra. */
export default function Reportar() {
  const [parametros] = useSearchParams()
  const tipo = parametros.get('tipo') === 'reseña' ? 'reseña' : 'perfil'
  const id = parametros.get('id')
  useTituloPagina('Reportar ' + tipo)
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [contexto, setContexto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const autor = parametros.get('autor') ?? 'la comunidad'
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const perfil = id ? await repositorio.obtenerPerfilTutor(id) : null
        if (activo) setContexto(perfil ? {
          nombre: tipo === 'perfil' ? perfil.getEstudiante().getNombre() : `Reseña de ${autor}, Perfil de ${perfil.getEstudiante().getNombre()}`,
          ruta:`/tutores/${perfil.getId()}`,
        } : null)
      } catch (fallo) {
        if (activo) setError(fallo.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [id, tipo, autor, intento])
  function enviar(evento) {
    evento.preventDefault()
    setEnviado(true)
    window.scrollTo(0, 0)
  }
  if (cargando) return <Cargando texto="Cargando contenido…" />
  if (error) return <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />
  if (!contexto) return <EstadoVacio icono="bi-flag" titulo="No encontramos el contenido seleccionado" texto="Vuelve al perfil para seleccionar el contenido." />
  return <>
    <p className="ct-demostracion">Demostración: este formulario no envía ni guarda reportes.</p>
    <div className="ct-cabecera-reporte"><EncabezadoPagina titulo={enviado ? 'Reporte recibido' : 'Reportar ' + tipo} ruta={contexto.ruta} /></div>
    {enviado ? <section className="ct-estado-formulario">
      <span className="ct-confirmacion-etiqueta">Demostración completada</span>
      <h1>Así se vería la confirmación</h1><p className="ct-texto-secundario" role="status">No se envió ningún reporte. La revisión de reportes aún no está disponible.</p>
      <div className="ct-dato"><small>Estado</small>Ejemplo sin envío</div>
      <div className="ct-estado-formulario-acciones">
          <Link className="btn-ct-primario ct-boton" to={contexto.ruta}>Volver al perfil
        </Link>
          <Link className="btn-ct-secundario ct-boton" to="/tutores">Buscar tutores
        </Link>
        </div>
    </section> : <form className="ct-estado-formulario ct-reporte-formulario" onSubmit={enviar}>
      <h1>{tipo === 'perfil' ? 'Cuéntanos qué debemos revisar' : 'Reporta esta reseña'}</h1>
      <p className="ct-texto-secundario">
        {tipo === 'perfil' ? 'El administrador revisará el caso. Reportar no elimina el perfil automáticamente.' : 'El reporte identifica la reseña concreta. Su contenido permanece disponible mientras se revisa.'}
      </p>
      <div className="ct-dato"><small>{tipo === 'perfil' ? 'Perfil' : 'Reseña'}</small>{contexto.nombre}</div>
      <CampoFormulario
        etiqueta="Motivo"
        nombre="motivo"
        valor={motivo}
        alCambiar={setMotivo} obligatorio
        placeholder={tipo === 'perfil' ? 'Información del perfil que requiere revisión' : 'Contenido que requiere moderación'} />
      <CampoFormulario
        etiqueta="Descripción"
        nombre="detalle"
        tipo="textarea"
        valor={detalle}
        alCambiar={setDetalle} obligatorio
        placeholder={tipo === 'perfil' ? 'Solicito revisar la información publicada en este perfil.' : 'Solicito que el administrador revise esta reseña.'} />
      <div className="ct-estado-formulario-acciones">
          <Boton tipo="submit" anchoCompleto>Enviar reporte
        </Boton>
          <Link className="btn-ct-secundario ct-boton" to={contexto.ruta}>Cancelar
        </Link>
        </div>
    </form>}
  </>
}
