// Expone las variantes y las interacciones del kit reutilizable en una página interna.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { useState } from 'react'
import { EstadoSesion, EstadoVerificacion } from '../modelo/enums.js'
import Avatar from '../componentes/ui/Avatar.jsx'
import BarraBusqueda from '../componentes/ui/BarraBusqueda.jsx'
import BloqueCalificacion from '../componentes/ui/BloqueCalificacion.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import ChipEstado from '../componentes/ui/ChipEstado.jsx'
import ChipMateria from '../componentes/ui/ChipMateria.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import ItemSesion from '../componentes/ui/ItemSesion.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import SelectorFranja from '../componentes/ui/SelectorFranja.jsx'
import TarjetaTutor from '../componentes/ui/TarjetaTutor.jsx'

// Datos de muestra del catálogo; no son datos reales.
const camposMuestra = {
  nombre: 'Lucía Ávila', correo: 'correo-sin-dominio', clave: 'ClaveDeMuestra',
  descripcion: 'Quiero practicar con ejercicios y ejemplos.', programa: 'ciencias',
  deshabilitado: 'Dato de muestra',
}
const opcionesMuestra = [
  { valor: 'ciencias', etiqueta: 'Programa de Ciencias' },
  { valor: 'tecnologia', etiqueta: 'Programa de Tecnología' },
]
const materiasMuestra = ['Álgebra', 'Programación']
const materiaFija = 'Matemáticas'
const calificacionesMuestra = [
  { promedio: 4.5, total: 12 }, { promedio: 3, total: 1 }, { promedio: 0, total: 0 },
]
const puntajeInicial = 3
const franjasMuestra = [
  { id: 'franja-1', etiqueta: 'Lunes 09:00–10:00', ocupada: false },
  { id: 'franja-2', etiqueta: 'Lunes 10:00–11:00', ocupada: false },
  { id: 'franja-3', etiqueta: 'Martes 14:00–15:00', ocupada: true },
  { id: 'franja-4', etiqueta: 'Miércoles 09:00–10:00', ocupada: false },
]
const tutoresMuestra = [
  {
    nombre: 'Lucía Ávila', programa: 'Programa de Ciencias', semestre: 6,
    materias: ['Matemáticas', 'Álgebra'], promedio: 4.5, totalCalificaciones: 12,
    tarifaHora: null, ruta: '/tutores/catalogo-lucia',
  },
  {
    nombre: 'Mateo Pineda', programa: 'Programa de Tecnología', semestre: 5,
    materias: ['Programación', 'Lógica'], promedio: 3, totalCalificaciones: 1,
    tarifaHora: 35000, ruta: '/tutores/catalogo-mateo',
  },
]
const sesionesMuestra = [
  { id: 'pendiente', nombre: 'Emilia Torres', materia: 'Matemáticas', fecha: '2 de noviembre de 2026', franja: '09:00–10:00', estado: EstadoSesion.PENDIENTE },
  { id: 'confirmada', nombre: 'Julián Ríos', materia: 'Programación', fecha: '3 de noviembre de 2026', franja: '14:00–15:00', estado: EstadoSesion.CONFIRMADA },
  { id: 'finalizada', nombre: 'Valeria Soto', materia: 'Álgebra', fecha: '28 de octubre de 2026', franja: '10:00–11:00', estado: EstadoSesion.FINALIZADA },
]
const estadosSesionMuestra = Object.values(EstadoSesion)
const estadosVerificacionMuestra = Object.values(EstadoVerificacion)
const mensajesErrorMuestra = ['No pudimos cargar esta información de muestra.', 'La consulta de muestra no pudo completarse.']

/**
 * Presenta los catorce componentes con ejemplos controlados e independientes del dominio.
 * @returns {import('react').ReactElement} Catálogo interno del kit de interfaz.
 */
export default function CatalogoComponentes() {
  useTituloPagina('Catálogo de componentes')
  const [campos, setCampos] = useState(camposMuestra)
  const [busqueda, setBusqueda] = useState('')
  const [ultimaBusqueda, setUltimaBusqueda] = useState(null)
  const [mensajeAccion, setMensajeAccion] = useState('')
  const [reintentos, setReintentos] = useState(0)
  const [materias, setMaterias] = useState(materiasMuestra)
  const [calificacion, setCalificacion] = useState(puntajeInicial)
  const [franja, setFranja] = useState(franjasMuestra[0].id)
  const [sesiones, setSesiones] = useState(sesionesMuestra)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [calificacionModal, setCalificacionModal] = useState(puntajeInicial)
  const [mensajeModal, setMensajeModal] = useState('')

  function actualizarCampo(nombre, valor) {
    setCampos((anteriores) => ({ ...anteriores, [nombre]: valor }))
  }

  function cambiarEstadoSesion(id, estado) {
    setSesiones((anteriores) => anteriores.map((sesion) => sesion.id === id ? { ...sesion, estado } : sesion))
  }

  function guardarCalificacion() {
    setMensajeModal(`Calificación de muestra guardada: ${calificacionModal} de 5.`)
    setModalAbierto(false)
  }

  return (
    <div className="ct-catalogo">
      <header className="ct-catalogo-introduccion">
        <h1>Catálogo de componentes</h1>
        <p>Página interna para mostrar la reutilización de los componentes y probar sus variantes con datos de muestra.</p>
      </header>

      <section className="ct-catalogo-seccion" aria-labelledby="catalogo-formularios">
        <h2 id="catalogo-formularios">Átomos y moléculas</h2>
        <article className="ct-catalogo-bloque">
          <h3>Boton</h3>
          <div className="ct-catalogo-ejemplos">
            <Boton alHacerClic={() => setMensajeAccion('Acción primaria de muestra ejecutada.')}>Primario</Boton>
            <Boton variante="secundario" alHacerClic={() => setMensajeAccion('Acción secundaria de muestra ejecutada.')}>Secundario</Boton>
            <Boton deshabilitado>Deshabilitado</Boton>
            <Boton cargando>Cargando</Boton>
            <Boton icono="bi-plus" alHacerClic={() => setMensajeAccion('Acción con icono de muestra ejecutada.')}>Con icono</Boton>
          </div>
          <div className="ct-catalogo-ancho"><Boton anchoCompleto alHacerClic={() => setMensajeAccion('Acción de ancho completo ejecutada.')}>Ancho completo</Boton></div>
          {mensajeAccion && <p className="ct-catalogo-resultado" role="status">{mensajeAccion}</p>}
        </article>

        <article className="ct-catalogo-bloque">
          <h3>Avatar</h3>
          <div className="ct-catalogo-ejemplos">
            {tutoresMuestra.map((tutor) => <div className="ct-catalogo-ejemplos" key={tutor.nombre}><Avatar nombre={tutor.nombre} /><span>{tutor.nombre}</span></div>)}
          </div>
        </article>

        <article className="ct-catalogo-bloque">
          <h3>CampoFormulario</h3>
          <div className="ct-catalogo-campos">
            <CampoFormulario etiqueta="Nombre" valor={campos.nombre} alCambiar={(valor) => actualizarCampo('nombre', valor)} ayuda="Puedes editar este dato de muestra." nombre="nombre" autoComplete="name" />
            <CampoFormulario etiqueta="Correo" tipo="email" valor={campos.correo} alCambiar={(valor) => actualizarCampo('correo', valor)} error={campos.correo.includes('@') ? '' : 'Escribe un correo válido.'} nombre="correo" autoComplete="email" obligatorio />
            <CampoFormulario etiqueta="Contraseña" tipo="password" valor={campos.clave} alCambiar={(valor) => actualizarCampo('clave', valor)} nombre="clave" autoComplete="new-password" />
            <CampoFormulario etiqueta="Descripción" tipo="textarea" valor={campos.descripcion} alCambiar={(valor) => actualizarCampo('descripcion', valor)} nombre="descripcion" />
            <CampoFormulario etiqueta="Programa" tipo="select" opciones={opcionesMuestra} valor={campos.programa} alCambiar={(valor) => actualizarCampo('programa', valor)} nombre="programa" />
            <CampoFormulario etiqueta="Campo deshabilitado" valor={campos.deshabilitado} alCambiar={(valor) => actualizarCampo('deshabilitado', valor)} deshabilitado />
          </div>
        </article>

        <article className="ct-catalogo-bloque">
          <h3>BarraBusqueda</h3>
          <BarraBusqueda valor={busqueda} alCambiar={setBusqueda} alBuscar={() => setUltimaBusqueda(busqueda)} etiqueta="Buscar una materia de muestra" placeholder="Busca una materia" />
          {ultimaBusqueda !== null && <p className="ct-catalogo-resultado" role="status">Texto buscado: {ultimaBusqueda || 'Sin texto'}</p>}
        </article>

        <article className="ct-catalogo-bloque"><h3>Cargando</h3><Cargando /></article>
        <article className="ct-catalogo-bloque">
          <h3>MensajeError</h3>
          <div className="ct-catalogo-lista">
            <MensajeError mensaje={mensajesErrorMuestra[0]} />
            <MensajeError mensaje={mensajesErrorMuestra[1]} alReintentar={() => setReintentos((total) => total + 1)} />
          </div>
          <p className="ct-catalogo-resultado" role="status">Reintentos de muestra: {reintentos}</p>
        </article>
      </section>

      <section className="ct-catalogo-seccion" aria-labelledby="catalogo-selecciones">
        <h2 id="catalogo-selecciones">Chips, calificación y franjas</h2>
        <article className="ct-catalogo-bloque">
          <h3>ChipEstado</h3>
          <p>Sesión</p>
          <div className="ct-catalogo-ejemplos">{estadosSesionMuestra.map((estado) => <ChipEstado key={estado} estado={estado} />)}</div>
          <p className="ct-catalogo-resultado">Verificación</p>
          <div className="ct-catalogo-ejemplos">{estadosVerificacionMuestra.map((estado) => <ChipEstado key={estado} estado={estado} />)}</div>
        </article>
        <article className="ct-catalogo-bloque">
          <h3>ChipMateria</h3>
          <div className="ct-catalogo-ejemplos">
            <ChipMateria nombre={materiaFija} />
            {materias.map((materia) => <ChipMateria key={materia} nombre={materia} alQuitar={() => setMaterias((anteriores) => anteriores.filter((nombre) => nombre !== materia))} />)}
          </div>
          {materias.length === 0 && <p className="ct-catalogo-resultado">Sin materias seleccionadas.</p>}
        </article>
        <article className="ct-catalogo-bloque">
          <h3>BloqueCalificacion</h3>
          <div className="ct-catalogo-ejemplos">{calificacionesMuestra.map((datos) => <BloqueCalificacion key={datos.total} {...datos} />)}</div>
          <div className="ct-catalogo-ancho"><BloqueCalificacion editable valor={calificacion} alCambiar={setCalificacion} /></div>
          <p className="ct-catalogo-resultado" role="status">Puntaje elegido: {calificacion} de 5.</p>
        </article>
        <article className="ct-catalogo-bloque">
          <h3>SelectorFranja</h3>
          <SelectorFranja franjas={franjasMuestra} seleccionada={franja} alSeleccionar={setFranja} etiqueta="Disponibilidad de muestra" />
          <p className="ct-catalogo-resultado" role="status">Franja seleccionada: {franjasMuestra.find((disponible) => disponible.id === franja)?.etiqueta}</p>
        </article>
      </section>

      <section className="ct-catalogo-seccion" aria-labelledby="catalogo-organismos">
        <h2 id="catalogo-organismos">Organismos</h2>
        <article className="ct-catalogo-bloque">
          <h3>TarjetaTutor</h3>
          <div className="ct-catalogo-tutores">{tutoresMuestra.map((tutor) => <TarjetaTutor key={tutor.ruta} {...tutor} />)}</div>
        </article>
        <article className="ct-catalogo-bloque">
          <h3>ItemSesion</h3>
          <div className="ct-catalogo-lista">
            {sesiones.map((sesion) => (
              <ItemSesion key={sesion.id} nombre={sesion.nombre} materia={sesion.materia} fecha={sesion.fecha} franja={sesion.franja} estado={sesion.estado}>
                {sesion.estado === EstadoSesion.PENDIENTE && <>
                  <Boton alHacerClic={() => cambiarEstadoSesion(sesion.id, EstadoSesion.CONFIRMADA)}>Aceptar</Boton>
                  <Boton variante="secundario" alHacerClic={() => cambiarEstadoSesion(sesion.id, EstadoSesion.RECHAZADA)}>Rechazar</Boton>
                </>}
                {sesion.estado === EstadoSesion.FINALIZADA && <Boton variante="secundario" alHacerClic={() => setModalAbierto(true)}>Calificar</Boton>}
              </ItemSesion>
            ))}
          </div>
        </article>
        <article className="ct-catalogo-bloque">
          <h3>EstadoVacio</h3>
          <EstadoVacio icono="bi-calendar-event" titulo="No hay sesiones de muestra" texto="Prueba una acción del catálogo para continuar." accion={{ etiqueta: 'Probar acción', alHacerClic: () => setMensajeModal('Acción del estado vacío ejecutada.') }} />
        </article>
        <article className="ct-catalogo-bloque">
          <h3>Modal</h3>
          <Boton alHacerClic={() => setModalAbierto(true)}>Abrir modal</Boton>
          {mensajeModal && <p className="ct-catalogo-resultado" role="status">{mensajeModal}</p>}
          <Modal abierto={modalAbierto} titulo="Calificar tutoría de muestra" alCerrar={() => setModalAbierto(false)} pie={<>
            <Boton variante="secundario" alHacerClic={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton alHacerClic={guardarCalificacion}>Guardar calificación</Boton>
          </>}>
            <p>Elige el puntaje de esta tutoría de muestra.</p>
            <BloqueCalificacion editable tamano="grande" valor={calificacionModal} alCambiar={setCalificacionModal} />
          </Modal>
        </article>
      </section>
    </div>
  )
}
