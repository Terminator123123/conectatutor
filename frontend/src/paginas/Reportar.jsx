// Reproduce el envío de un reporte de perfil o reseña sin servidor.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { repositorio } from '../servicios/instancias.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import EncabezadoPagina from '../componentes/layout/EncabezadoPagina.jsx'
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
  const [contexto, setContexto] = useState({ nombre:'Perfil seleccionado', ruta:'/tutores' })
  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        if (tipo === 'perfil') {
          const perfil = await repositorio.obtenerPerfilTutor(id)
          if (activo && perfil) setContexto({ nombre:perfil.getEstudiante().getNombre(), ruta:`/tutores/${perfil.getId()}` })
        } else {
          const sesion = (await repositorio.listarSesiones()).find((item) => item.getCalificacion()?.getId() === id)
          if (activo && sesion) {
            const partes = sesion.getSolicitante().getNombre().split(' ')
            setContexto({ nombre:`${partes[0]} ${partes[1]?.[0] ?? ''}., Perfil de ${sesion.getTutor().getEstudiante().getNombre()}`, ruta:`/tutores/${sesion.getTutor().getId()}` })
          }
        }
      } catch { if (activo) setContexto({ nombre:'No encontramos el contenido seleccionado.', ruta:'/tutores' }) }
    }
    cargar()
    return () => { activo = false }
  }, [id, tipo])
  function enviar(evento) {
    evento.preventDefault()
    //solucion temp por falrta de bak correguir despues//
    setEnviado(true)
    window.scrollTo(0, 0)
  }
  return <>
    <div className="ct-cabecera-reporte"><EncabezadoPagina titulo={enviado ? 'Reporte recibido' : 'Reportar ' + tipo} ruta={contexto.ruta} /></div>
    {enviado ? <section className="ct-estado-formulario">
      <span className="ct-confirmacion-etiqueta">Reporte enviado</span>
      <h1>Recibimos tu reporte</h1><p className="ct-texto-secundario" role="status">Tu reporte quedó pendiente de revisión. El administrador tomará la decisión.</p>
      <div className="ct-dato"><small>Estado</small>Pendiente de revisión</div>
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
