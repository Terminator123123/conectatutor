// Gestiona el catálogo real mediante las operaciones públicas del repositorio.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { repositorio } from '../servicios/instancias.js'
import Materia from '../modelo/Materia.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'
import Modal from '../componentes/ui/Modal.jsx'
import ConfirmarDesactivacion from '../componentes/ui/ConfirmarDesactivacion.jsx'
import '../estilos/tutor.css'
import '../estilos/autenticacion.css'

/** @returns {import('react').ReactElement} Lista, alta y edición de materias por programa. */
export default function GestionMaterias() {
  useTituloPagina('Gestionar materias')
  const [programas, setProgramas] = useState([])
  const [materias, setMaterias] = useState([])
  const [filtro, setFiltro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [edicion, setEdicion] = useState(null)
  const [campos, setCampos] = useState({ nombre:'', codigo:'', programa:'', descripcion:'' })
  const [materiaElegida, setMateriaElegida] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [materiaDesactivar, setMateriaDesactivar] = useState(null)
  const [desactivada, setDesactivada] = useState('')
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setErrorCarga('')
      try {
        const [listaProgramas, listaMaterias] = await Promise.all([repositorio.listarProgramas(), repositorio.listarMaterias()])
        if (activo) { setProgramas(listaProgramas); setMaterias(listaMaterias); setFiltro((actual) => actual || listaProgramas[0]?.getId() || '') }
      } catch (fallo) { if (activo) setErrorCarga(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [intento])
  function abrir(materia) {
    window.scrollTo(0, 0)
    setError(''); setAviso('')
    setDesactivada('')
    setEdicion(materia?.getId() ?? 'nueva')
    setCampos({ nombre:materia?.getNombre() ?? '', codigo:materia?.getCodigo() ?? '', programa:materia?.getPrograma().getId() ?? filtro, descripcion:'' })
  }
  async function guardar(evento) {
    evento.preventDefault()
    if (guardando) return
    setError('')
    if (!campos.nombre.trim() || !campos.programa) { setError('Completa el nombre y programa.'); return }
    setGuardando(true)
    try {
      const actuales = await repositorio.listarMaterias()
      if (actuales.some((materia) => materia.getId() !== edicion && materia.getPrograma().getId() === campos.programa && materia.getCodigo().toLowerCase() === campos.codigo.trim().toLowerCase())) throw new Error('Ya existe una materia con ese código en el programa.')
      const programa = (await repositorio.listarProgramas()).find((item) => item.getId() === campos.programa)
      if (!programa) throw new Error('El programa ya no está disponible.')
      const anterior = actuales.find((materia) => materia.getId() === edicion)
      if (edicion !== 'nueva' && !anterior) throw new Error('Esta materia ya no está disponible.')
      const datos = { nombre:campos.nombre.trim(), codigo:campos.codigo.trim() || `MAT-${crypto.randomUUID().slice(0,8).toUpperCase()}`, programa }
      const materia = anterior ? Materia.desdeJSON({ ...anterior.toJSON(), ...datos, programaId:programa.getId() }, { buscarPrograma:() => programa }) : new Materia(datos)
      const guardada = await repositorio.guardarMateria(materia)
      setMaterias((lista) => lista.some((item) => item.getId() === guardada.getId())
        ? lista.map((item) => item.getId() === guardada.getId() ? guardada : item)
        : [...lista, guardada])
      setMateriaElegida(guardada.getId())
      setEdicion(null)
      setAviso('Cambio confirmado. El catálogo quedó actualizado.')
      window.scrollTo(0, 0)
    } catch (fallo) { setError(fallo.message) }
    finally { setGuardando(false) }
  }
  async function desactivarMateria() {
    if (guardando || !materiaDesactivar) return
    setGuardando(true)
    setError('')
    try {
      const materia = materiaDesactivar
      await repositorio.desactivarMateria(materia.getId())
      setMaterias((lista) => lista.filter((item) => item.getId() !== materia.getId()))
      setDesactivada(materia.getNombre())
      setMateriaDesactivar(null)
      setAviso('Desactivación confirmada.')
      window.scrollTo(0, 0)
    } catch (fallo) {
      setMateriaDesactivar(null)
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  const filtradas = materias.filter((materia) => !filtro || materia.getPrograma().getId() === filtro)
  const seleccionada = filtradas.find((materia) => materia.getId() === materiaElegida) ?? filtradas[0]
  if (aviso) return <section className="ct-gestion-materias ct-cambio-confirmado">
    <span className="ct-confirmacion-etiqueta">Operación completada</span>
    <h1>El cambio quedó confirmado</h1>
    <p role="status">{desactivada ? 'La materia quedó inactiva para nuevas tutorías.' : 'El catálogo quedó actualizado.'}</p>
    <div className="ct-dato"><small>Resultado</small>{desactivada ? `${desactivada}: Inactiva` : 'Cambio de catálogo confirmado'}</div>
    <div className="ct-acciones-catalogo"><Link className="ct-boton btn-ct-primario ct-boton-completo" to="/admin/verificacion">Volver a administración</Link></div>
    {desactivada && <Boton anchoCompleto variante="secundario" alHacerClic={() => { setAviso(''); setDesactivada('') }}>Volver al catálogo</Boton>}
  </section>
  return <section className="ct-gestion-materias">
    <h1>
      {edicion ? edicion === 'nueva' ? 'Agrega una materia' : `Edita ${materias.find((materia) => materia.getId() === edicion)?.getNombre() ?? 'la materia'}` : 'Materias de la comunidad'}
    </h1>
    <div role="status" className={aviso ? 'ct-aviso' : 'visually-hidden'}>
      {aviso}
    </div>
    <p className="ct-texto-secundario">
      {edicion ? edicion === 'nueva' ? 'La materia estará disponible en el catálogo después de guardar.' : 'Conserva un nombre claro y consistente para estudiantes y tutores.' : `${filtradas.length} materias activas. Puedes agregar o editar una materia.`}
    </p>
    {cargando ? <Cargando texto="Cargando catálogo…" /> : errorCarga ? <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} /> : <>
      {error && <MensajeError mensaje={error} alReintentar={() => setIntento((valor) => valor + 1)} />}
      {edicion ? <form className="ct-tutor-formulario" onSubmit={guardar}>
        <CampoFormulario
          etiqueta="Nombre de la materia"
          nombre="nombre"
          valor={campos.nombre}
          alCambiar={(valor) => setCampos({ ...campos, nombre:valor })} obligatorio
          deshabilitado={guardando} />
        <CampoFormulario
          etiqueta="Descripción breve (no disponible)"
          nombre="descripcion"
          tipo="textarea"
          valor={campos.descripcion}
          alCambiar={(valor) => setCampos({ ...campos, descripcion:valor })}
          placeholder="La descripción no se guarda"
          deshabilitado />
        <CampoFormulario
          etiqueta="Programa académico"
          nombre="programa"
          tipo="select"
          valor={campos.programa}
          alCambiar={(valor) => setCampos({ ...campos, programa:valor })}
          opciones={[{ valor:'', etiqueta:'Selecciona un programa' }, ...programas.map((programa) => ({ valor:programa.getId(), etiqueta:programa.getNombre() }))]} obligatorio
          deshabilitado={guardando} />
        <div className="ct-acciones-catalogo">
            <Boton tipo="submit" anchoCompleto cargando={guardando}>
            {edicion === 'nueva' ? 'Crear materia' : 'Guardar cambios'}
          </Boton>
            <Boton anchoCompleto variante="secundario" deshabilitado={guardando} alHacerClic={() => { setEdicion(null); setError('') }}>Cancelar
          </Boton>
          </div>
      </form> : <>
        <CampoFormulario
          etiqueta="Programa"
          tipo="select"
          valor={filtro}
          alCambiar={setFiltro}
          opciones={[{ valor:'', etiqueta:'Todos los programas' }, ...programas.map((programa) => ({ valor:programa.getId(), etiqueta:programa.getNombre() }))]} />
        <div className="ct-dato"><small>Materias activas</small>{filtradas.map((materia) => materia.getNombre()).join(', ') || 'Todavía no hay materias en este programa.'}</div>
        <CampoFormulario
          etiqueta="Materia para editar"
          tipo="select"
          valor={seleccionada?.getId() ?? ''}
          alCambiar={setMateriaElegida}
          opciones={filtradas.map((materia) => ({ valor:materia.getId(), etiqueta:materia.getNombre() }))}
          deshabilitado={!filtradas.length} />
        <div className="ct-acciones-catalogo">
            <Boton anchoCompleto alHacerClic={() => abrir(null)}>Agregar materia
          </Boton>
            <Boton anchoCompleto variante="secundario" deshabilitado={!seleccionada} alHacerClic={() => abrir(seleccionada)}>Editar {seleccionada?.getNombre() ?? 'materia'}
          </Boton>
          </div>
        <Boton anchoCompleto variante="secundario" deshabilitado={!seleccionada} alHacerClic={() => setMateriaDesactivar(seleccionada)}>
          Desactivar {seleccionada?.getNombre() ?? 'materia'}
        </Boton>
        {!filtradas.length && <EstadoVacio titulo="Todavía no hay materias" />}
      </>}
    </>}
    <Link className="ct-boton btn-ct-secundario" to="/admin/verificacion">Volver a Coordinación</Link>
    <Modal abierto={Boolean(materiaDesactivar)} titulo="Administración" conRegreso alCerrar={() => { if (!guardando) setMateriaDesactivar(null) }}>
      {materiaDesactivar && <ConfirmarDesactivacion nombre={materiaDesactivar.getNombre()} guardando={guardando} alConfirmar={desactivarMateria} alConservar={() => { if (!guardando) setMateriaDesactivar(null) }} />}
    </Modal>
  </section>
}

