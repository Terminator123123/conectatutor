// Responde y finaliza las tutorías solicitadas al perfil del estudiante.
import { useEffect, useState } from 'react'
import { EstadoSesion, EstadoVerificacion } from '../../modelo/enums.js'
import { repositorio } from '../../servicios/instancias.js'
import { estaOcupada, fechaEnColombia, formatearFecha } from '../../servicios/agenda.js'
import ItemSesion from '../../componentes/ui/ItemSesion.jsx'
import Modal from '../../componentes/ui/Modal.jsx'
import ModalMotivo from '../../componentes/sesiones/ModalMotivo.jsx'
import Boton from '../../componentes/ui/Boton.jsx'
import Cargando from '../../componentes/ui/Cargando.jsx'
import MensajeError from '../../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../../componentes/ui/EstadoVacio.jsx'

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
  const [guardando, setGuardando] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [errorItem, setErrorItem] = useState(null)
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
    setErrorAccion('')
  }
  function cerrar() { if (!guardando) setModal(null) }
  const errorMotivo = motivo.trim().length >= 5 ? '' : 'Escribe el motivo (al menos 5 caracteres).'

  async function actuar(tipo, id) {
    if (guardando) return
    setErrorAccion('')
    setErrorItem(null)
    if (tipo === 'rechazar' || tipo === 'cancelar') {
      setMotivoTocado(true)
      if (errorMotivo) return
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
        else if (tipo === 'cancelar') sesion.cancelar(motivo.trim())
        else sesion.finalizar()
        await repositorio.guardarSesion(sesion)
      }
      // Serializa las acciones del mismo tutor también entre pestañas.
      if (navigator.locks?.request) await navigator.locks.request(`ct-agenda-${perfilId}`, modificar)
      else await modificar()
      setSesiones(await repositorio.listarSesionesDelTutor(perfilId))
      setModal(null)
      const mensajes = { aceptar: 'Tutoría aceptada.', rechazar: 'Tutoría rechazada.', finalizar: 'Tutoría marcada como realizada.', cancelar: 'Tutoría cancelada.' }
      alAnunciar(mensajes[tipo])
    } catch (error) {
      if (tipo === 'aceptar') setErrorItem({ id, mensaje: error.message })
      else setErrorAccion(error.message)
    } finally {
      setGuardando('')
    }
  }

  const grupos = [
    { titulo: 'Por responder', estados: [EstadoSesion.PENDIENTE] },
    { titulo: 'Confirmadas', estados: [EstadoSesion.CONFIRMADA] },
    { titulo: 'Historial', estados: [EstadoSesion.FINALIZADA, EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA], descendente: true },
  ]
  return <section>
    <h2>Sesiones que doy</h2>
    {cargando ? <Cargando texto="Cargando tutorías…" /> : errorCarga ? <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} /> : !sesiones.length ? <EstadoVacio icono="bi-person-video3" titulo="Todavía no te han pedido tutorías" texto={perfil.getEstadoVerificacion() !== EstadoVerificacion.VERIFICADO ? 'Aparecerás en la búsqueda cuando Coordinación verifique tu perfil.' : 'Revisa que tus materias y horarios estén al día.'} accion={{ etiqueta: 'Ir a mi perfil', ruta: '/perfil' }} /> : grupos.map((grupo) => {
      const lista = sesiones.filter((sesion) => grupo.estados.includes(sesion.getEstado())).sort((a, b) => grupo.descendente ? b.getFecha() - a.getFecha() : a.getFecha() - b.getFecha())
      return lista.length ? <section key={grupo.titulo} className="ct-grupo-sesiones"><h3>{grupo.titulo}</h3><div className="ct-lista-sesiones">{lista.map((sesion) => {
        const estado = sesion.getEstado()
        const calificacion = sesion.getCalificacion()
        return <ItemSesion key={sesion.getId()} nombre={sesion.getSolicitante().getNombre()} materia={sesion.getMateria().getNombre()} fecha={formatearFecha(sesion.getFecha())} franja={`${sesion.getFranja().getHoraInicio()}–${sesion.getFranja().getHoraFin()}`} estado={estado}>
          {estado === EstadoSesion.PENDIENTE && <><Boton cargando={guardando === sesion.getId()} deshabilitado={!!guardando} alHacerClic={() => actuar('aceptar', sesion.getId())}>Aceptar</Boton><Boton variante="secundario" deshabilitado={!!guardando} alHacerClic={() => abrir('rechazar', sesion)}>Rechazar</Boton></>}
          {estado === EstadoSesion.CONFIRMADA && <><Boton deshabilitado={!!guardando} alHacerClic={() => abrir('finalizar', sesion)}>Marcar como realizada</Boton><Boton variante="secundario" deshabilitado={!!guardando} alHacerClic={() => abrir('cancelar', sesion)}>Cancelar</Boton></>}
          {estado === EstadoSesion.FINALIZADA && (calificacion ? <div><p>Calificación: {calificacion.getPuntaje()} de 5</p>{calificacion.getResena() && <p>{calificacion.getResena()}</p>}</div> : <p>Aún sin calificar</p>)}
          {[EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA].includes(estado) && <p>Motivo: {sesion.getMotivo()}</p>}
          {errorItem?.id === sesion.getId() && <MensajeError mensaje={errorItem.mensaje} />}
        </ItemSesion>
      })}</div></section> : null
    })}
    <ModalMotivo abierto={modal?.tipo === 'rechazar' || modal?.tipo === 'cancelar'} titulo={modal?.tipo === 'rechazar' ? 'Rechazar tutoría' : 'Cancelar tutoría'} etiquetaConfirmar={modal?.tipo === 'rechazar' ? 'Rechazar tutoría' : 'Cancelar tutoría'} motivo={motivo} alCambiarMotivo={(valor) => { setMotivo(valor); setMotivoTocado(true) }} errorMotivo={motivoTocado ? errorMotivo : ''} errorAccion={errorAccion} enviando={!!guardando} alConfirmar={() => actuar(modal.tipo, modal.id)} alCerrar={cerrar} />
    <Modal abierto={modal?.tipo === 'finalizar'} titulo="Marcar como realizada" alCerrar={cerrar} pie={<><Boton variante="secundario" alHacerClic={cerrar} deshabilitado={!!guardando}>Volver</Boton><Boton cargando={!!guardando} alHacerClic={() => actuar('finalizar', modal.id)}>Marcar como realizada</Boton></>}>
      <p>¿La tutoría ya se realizó? Después el estudiante podrá calificarla.</p>
      {errorAccion && <MensajeError mensaje={errorAccion} />}
    </Modal>
  </section>
}
