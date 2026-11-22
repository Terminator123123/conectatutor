import { formatearMoneda } from '../../componentes/ui/moneda.js'
import { formatearFechaBreve } from '../../componentes/ui/fechaBreve.js'
// Responde y finaliza las tutorías solicitadas al perfil del estudiante.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EstadoSesion, EstadoVerificacion } from '../../modelo/enums.js'
import { repositorio } from '../../servicios/instancias.js'
import { estaOcupada, fechaEnColombia, yaEmpezo } from '../../servicios/agenda.js'
import ItemSesion from '../../componentes/ui/ItemSesion.jsx'
import Modal from '../../componentes/ui/Modal.jsx'
import EncuestaCancelacion from '../../componentes/sesiones/EncuestaCancelacion.jsx'
import { revisarEncuesta, textoEncuesta } from '../../servicios/motivosCancelacion.js'
import Boton from '../../componentes/ui/Boton.jsx'
import Cargando from '../../componentes/ui/Cargando.jsx'
import MensajeError from '../../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../../componentes/ui/EstadoVacio.jsx'
import Avatar from '../../componentes/ui/Avatar.jsx'
import ChipEstado from '../../componentes/ui/ChipEstado.jsx'
import CampoFormulario from '../../componentes/ui/CampoFormulario.jsx'

/**
 * @param {{perfil: import('../../modelo/PerfilTutor.js').default, alAnunciar: function(string): void}} props Perfil y avisos de la página.
 * @returns {import('react').ReactElement} Agenda del tutor con acciones sobre instancias frescas.
 */
export default function SesionesQueDoy({ perfil, alAnunciar }) {
  const perfilId = perfil.getId()
  const [sesiones, setSesiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [modal, setModal] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [motivoTocado, setMotivoTocado] = useState(false)
  const [encuesta, setEncuesta] = useState({ motivos: [], otro: '' })
  const [guardando, setGuardando] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [errorItem, setErrorItem] = useState(null)
  const [resultado, setResultado] = useState(null)
  const resultadoRef = useRef(null)
  useEffect(() => { if (resultado) resultadoRef.current?.focus() }, [resultado])
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      setErrorCarga('')
      try {
        const resultado = await repositorio.listarSesionesDelTutor(perfilId)
        if (activo) setSesiones(resultado)
      } catch (error) {
        if (activo) setErrorCarga(error.message)
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [perfilId, intento])

  function abrir(tipo, sesion) {
    setModal({ tipo, id: sesion.getId() })
    setMotivo('')
    setMotivoTocado(false)
    setEncuesta({ motivos: [], otro: '' })
    setErrorAccion('')
  }
  function cerrar() { if (!guardando) setModal(null) }
  const errorMotivo = motivo.trim().length >= 5 ? '' : 'Escribe el motivo (al menos 5 caracteres).'

  async function actuar(tipo, id) {
    if (guardando) return
    setErrorAccion('')
    setErrorItem(null)
    if (tipo === 'rechazar') {
      setMotivoTocado(true)
      if (errorMotivo) return
    }
    if (tipo === 'cancelar') {
      const problema = revisarEncuesta(encuesta)
      if (problema) { setErrorAccion(problema); return }
    }
    setGuardando(id)
    alAnunciar('')
    try {
      const modificar = async () => {
        const actuales = await repositorio.listarSesionesDelTutor(perfilId)
        const sesion = actuales.find((item) => item.getId() === id)
        if (!sesion) throw new Error('No encontramos esta sesión. Vuelve a cargar tus tutorías.')
        if (tipo === 'aceptar') {
          if (estaOcupada(actuales.filter((item) => item.getEstado() === EstadoSesion.CONFIRMADA), sesion.getFranja(), fechaEnColombia(sesion.getFecha()), id)) {
            throw new Error('Ya tienes una tutoría confirmada en ese horario.')
          }
          sesion.confirmar()
        } else if (tipo === 'rechazar') sesion.rechazar(motivo.trim())
        else if (tipo === 'cancelar') sesion.cancelar(textoEncuesta(encuesta))
        else sesion.finalizar()
        return repositorio.guardarSesion(sesion, tipo === 'cancelar' ? { encuesta } : {})
      }
      // Serializa las acciones del mismo tutor también entre pestañas.
      const actualizada = navigator.locks?.request ? await navigator.locks.request(`ct-agenda-${perfilId}`, modificar) : await modificar()
      // La acción ya quedó guardada: si falla el refresco, se actualiza solo esta fila
      try { setSesiones(await repositorio.listarSesionesDelTutor(perfilId)) }
      catch { setSesiones((anteriores) => anteriores.map((item) => item.getId() === id ? actualizada : item)) }
      setModal(null)
      const mensajes = { aceptar: 'Tutoría aceptada.', rechazar: 'Tutoría rechazada.', finalizar: 'Tutoría marcada como realizada.', cancelar: 'Tutoría cancelada.' }
      if (tipo === 'aceptar' || tipo === 'rechazar') { setResultado({ tipo, sesion:actualizada }); window.scrollTo(0, 0) }
      else alAnunciar(mensajes[tipo])
    } catch (error) {
      if (tipo === 'aceptar') setErrorItem({ id, mensaje: error.message })
      else setErrorAccion(error.message)
    } finally {
      setGuardando('')
    }
  }

  if (resultado) {
    const sesion = resultado.sesion
    const solicitante = sesion.getSolicitante()
    const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))
    const horas = (aMinutos(sesion.getFranja().getHoraFin()) - aMinutos(sesion.getFranja().getHoraInicio())) / 60
    const tarifa = sesion.getTutor().getTarifaHora()
    return <section ref={resultadoRef} tabIndex={-1} aria-label="Resultado de la solicitud">
        <p className="ct-solicitud-gestionada">La solicitud ya fue gestionada.
      </p>
        <div role="status" className={`ct-aviso${resultado.tipo === 'rechazar' ? ' ct-aviso-error' : ''}`}>
            <strong>
          {resultado.tipo === 'aceptar' ? 'Tutoría confirmada' : 'Solicitud rechazada'}
        </strong>
            <p>
          {resultado.tipo === 'aceptar' ? `${solicitante.getNombre().split(' ')[0]} verá la confirmación en Mis sesiones.` : 'Motivo: ' + sesion.getMotivo()}
        </p>
          </div>
        <article className="ct-solicitud-recibida">
            <ChipEstado estado={sesion.getEstado()} />
            <header className="ct-item-identidad">
                <Avatar nombre={solicitante.getNombre()} usuarioId={solicitante.getId()} />
                <div>
                    <strong>
              {solicitante.getNombre()}
            </strong>
                    <p>
              {solicitante.getPrograma().getNombre()} · {solicitante.getSemestre()}.º semestre
            </p>
                  </div>
              </header>
            <h3>
          {sesion.getMateria().getNombre()}
        </h3>
            <p>
          {formatearFechaBreve(sesion.getFecha())}
          <br />
          {sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()} ({horas} horas)
        </p>
            <div className="ct-tema-solicitado">
                <strong>Tema solicitado
          </strong>
                <p>
            {sesion.getTema()}
          </p>
              </div>
            <p className="ct-texto-secundario">
          {tarifa === null ? 'Gratuita' : 'Tarifa informativa: ' + formatearMoneda(tarifa * horas)}
        </p>
            <Boton variante="secundario" anchoCompleto alHacerClic={() => { setResultado(null); window.scrollTo(0, 0) }}>Volver al inicio
        </Boton>
          </article>
      </section>
  }

  const pendientes = sesiones.filter((sesion) => sesion.getEstado() === EstadoSesion.PENDIENTE).length
  const grupos = [
    { titulo: 'Por responder', estados: [EstadoSesion.PENDIENTE] },
    { titulo: 'Confirmadas', estados: [EstadoSesion.CONFIRMADA] },
    { titulo: 'Historial', estados: [EstadoSesion.FINALIZADA, EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA], descendente: true },
  ]
  return <section>
    <p className="ct-solicitudes-conteo">Tienes {pendientes} {pendientes === 1 ? 'solicitud' : 'solicitudes'} por revisar.</p>
    {cargando ? 
    <Cargando texto="Cargando tutorías…" /> : errorCarga ? 
    <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} forma="lista" /> : !sesiones.length ? 
    <EstadoVacio
      icono="bi-person-video3"
      titulo="Todavía no te han pedido tutorías"
      texto={perfil.getEstadoVerificacion() !== EstadoVerificacion.VERIFICADO ? 'Aparecerás en la búsqueda cuando Coordinación verifique tu perfil.' : 'Revisa que tus materias y horarios estén al día.'}
      accion={{ etiqueta: 'Ir a mi perfil', ruta: '/perfil' }} /> : grupos.map((grupo) => {
      const lista = sesiones.filter((sesion) => grupo.estados.includes(sesion.getEstado())).sort((a, b) => grupo.descendente ? b.getFecha() - a.getFecha() : a.getFecha() - b.getFecha())
      return lista.length ? 
      <section key={grupo.titulo} className="ct-grupo-sesiones">
        {grupo.titulo !== 'Por responder' && 
        <h3>
          {grupo.titulo}
        </h3>}
        <div className="ct-lista-sesiones">
          {lista.map((sesion) => {
        const estado = sesion.getEstado()
        const calificacion = sesion.getCalificacion()
        if (estado === EstadoSesion.PENDIENTE) {
          const solicitante = sesion.getSolicitante()
          const tarifa = sesion.getTutor().getTarifaHora()
          const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))
          const horas = (aMinutos(sesion.getFranja().getHoraFin()) - aMinutos(sesion.getFranja().getHoraInicio())) / 60
          return <article className="ct-solicitud-recibida" key={sesion.getId()}>
            <ChipEstado estado={estado} />
            <header className="ct-item-identidad">
                <Avatar nombre={solicitante.getNombre()} usuarioId={solicitante.getId()} />
                <div>
                    <strong>
                  {solicitante.getNombre()}
                </strong>
                    <p>
                  {solicitante.getPrograma().getNombre()} · {solicitante.getSemestre()}.º semestre
                </p>
                  </div>
              </header>
            <h3>{sesion.getMateria().getNombre()}</h3>
            <p>{formatearFechaBreve(sesion.getFecha())}<br />{sesion.getFranja().getHoraInicio()}–{sesion.getFranja().getHoraFin()} ({horas} horas)</p>
            <div className="ct-tema-solicitado"><strong>Tema solicitado</strong><p>{sesion.getTema()}</p></div>
            {tarifa !== null && <p className="ct-texto-secundario">Tarifa informativa: {formatearMoneda(tarifa * horas)}</p>}
            <Boton anchoCompleto cargando={guardando === sesion.getId()} deshabilitado={!!guardando} alHacerClic={() => actuar('aceptar', sesion.getId())}>Aceptar solicitud</Boton>
            <Boton anchoCompleto variante="secundario" deshabilitado={!!guardando} alHacerClic={() => abrir('rechazar', sesion)}>Rechazar solicitud</Boton>
            {errorItem?.id === sesion.getId() && <MensajeError mensaje={errorItem.mensaje} />}
          </article>
        }
        return <ItemSesion
          key={sesion.getId()}
          nombre={sesion.getSolicitante().getNombre()}
          materia={sesion.getMateria().getNombre()}
          fecha={formatearFechaBreve(sesion.getFecha())}
          franja={`${sesion.getFranja().getHoraInicio()}–${sesion.getFranja().getHoraFin()}`}
          estado={estado}>
          {estado === EstadoSesion.CONFIRMADA && 
          <>
              {yaEmpezo(sesion) && <Boton deshabilitado={!!guardando} alHacerClic={() => abrir('finalizar', sesion)}>Marcar como realizada
            </Boton>}
              <Link className="ct-boton btn-ct-secundario" to={`/sesiones/${sesion.getId()}?cancelar=confirmada`}>Cancelar sesión
            </Link>
            </>}
          {estado === EstadoSesion.FINALIZADA && (calificacion ? 
          <div>
              <p>Calificación: {calificacion.getPuntaje()} de 5
            </p>
            {calificacion.getResena() && 
            <p>
              {calificacion.getResena()}
            </p>}
          </div> : 
          <p>Aún sin calificar
          </p>)}
          {[EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA].includes(estado) && <p>Motivo: {sesion.getMotivo()}</p>}
          {errorItem?.id === sesion.getId() && <MensajeError mensaje={errorItem.mensaje} />}
        </ItemSesion>
      })}</div></section> : null
    })}
    <Modal abierto={modal?.tipo === 'cancelar'} titulo="Cancelar tutoría" alCerrar={cerrar} pie={<>
      <Boton variante="secundario" alHacerClic={cerrar} deshabilitado={!!guardando}>Volver</Boton>
      <Boton alHacerClic={() => actuar(modal.tipo, modal.id)} cargando={!!guardando}>Cancelar tutoría</Boton>
    </>}>
      <EncuestaCancelacion valor={encuesta} alCambiar={(valor) => { setEncuesta(valor); setErrorAccion('') }} deshabilitado={!!guardando} error={errorAccion} />
    </Modal>
    <Modal abierto={modal?.tipo === 'rechazar'} titulo="Rechazar solicitud" conRegreso alCerrar={cerrar}>
        <form className="ct-rechazo-tutoria" noValidate onSubmit={(evento) => { evento.preventDefault(); actuar('rechazar', modal.id) }}>
            <h1>Cuéntale por qué
        </h1>
            <p>
          {sesiones.find((sesion) => sesion.getId() === modal?.id)?.getSolicitante().getNombre().split(' ')[0]} verá el motivo en el detalle de su solicitud.
        </p>
            <CampoFormulario
          etiqueta="Motivo"
          tipo="textarea"
          valor={motivo}
          alCambiar={(valor) => { setMotivo(valor); setMotivoTocado(true) }}
          error={motivoTocado ? errorMotivo : ''}
          deshabilitado={!!guardando} />
        {errorAccion && 
        <MensajeError mensaje={errorAccion} />}
        <Boton tipo="submit" anchoCompleto cargando={!!guardando}>Confirmar rechazo
        </Boton>
            <Boton variante="secundario" anchoCompleto deshabilitado={!!guardando} alHacerClic={cerrar}>Volver a la solicitud
        </Boton>
          </form>
      </Modal>
    <Modal
      abierto={modal?.tipo === 'finalizar'}
      titulo="Marcar como realizada"
      alCerrar={cerrar}
      pie={<><Boton variante="secundario" alHacerClic={cerrar} deshabilitado={!!guardando}>Volver</Boton><Boton cargando={!!guardando} alHacerClic={() => actuar('finalizar',
         modal.id)}>Marcar como realizada</Boton></>}>
      <p>¿La tutoría ya se realizó? Después el estudiante podrá calificarla.</p>
      {errorAccion && <MensajeError mensaje={errorAccion} />}
    </Modal>
  </section>
}
