// Registra estudiantes con validación en vivo y entrada automática.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { repositorio } from '../servicios/instancias.js'
import { validarNombre, validarClave, validarConfirmacion, validarCorreo } from '../servicios/validacionesFormulario.js'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Boton from '../componentes/ui/Boton.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import '../estilos/autenticacion.css'

/** @returns {import('react').ReactElement} Formulario de creación de cuenta. */
export default function Registro() {
  const [campos, setCampos] = useState({
    nombre: '', correoInstitucional: '', clave: '', confirmacion: '', programa: '', semestre: '', sede: '',
  })
  const [tocados, setTocados] = useState({})
  const [programas, setProgramas] = useState([])
  const [cargandoProgramas, setCargandoProgramas] = useState(true)
  const [errorProgramas, setErrorProgramas] = useState('')
  const [intento, setIntento] = useState(0)
  const [uso, setUso] = useState('buscar')
  const [enviando, setEnviando] = useState(false)
  const [errorServicio, setErrorServicio] = useState('')
  const { registrar } = useAutenticacion()
  const navigate = useNavigate()

  useEffect(() => {
    let activo = true
    async function cargarProgramas() {
      setCargandoProgramas(true)
      setErrorProgramas('')
      try {
        const resultado = await repositorio.listarProgramas()
        if (activo) setProgramas(resultado)
      } catch (error) {
        if (activo) setErrorProgramas(error.message)
      } finally {
        if (activo) setCargandoProgramas(false)
      }
    }
    cargarProgramas()
    return () => { activo = false }
  }, [intento])

  const errores = {
    nombre: validarNombre(campos.nombre),
    correoInstitucional: validarCorreo(campos.correoInstitucional, INSTITUCION.dominioCorreo),
    clave: validarClave(campos.clave),
    confirmacion: validarConfirmacion(campos.confirmacion, campos.clave),
    programa: campos.programa ? '' : 'Selecciona tu programa.',
    semestre: campos.semestre ? '' : 'Selecciona tu semestre.',
    sede: campos.sede ? '' : 'Selecciona tu sede.',
  }

  function cambiar(nombre, valor) {
    setCampos((anteriores) => ({ ...anteriores, [nombre]: valor }))
  }

  function marcarTocado(evento) {
    const nombre = evento.target.name
    if (Object.hasOwn(campos, nombre)) setTocados((anteriores) => ({ ...anteriores, [nombre]: true }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTocados(Object.fromEntries(Object.keys(campos).map((nombre) => [nombre, true])))
    setErrorServicio('')
    const primerError = Object.keys(errores).find((nombre) => errores[nombre])
    if (primerError) {
      evento.currentTarget.elements.namedItem(primerError)?.focus()
      return
    }
    if (cargandoProgramas || errorProgramas) return
    setEnviando(true)
    try {
      await registrar({
        nombre: campos.nombre.trim(), correoInstitucional: campos.correoInstitucional,
        clave: campos.clave, semestre: Number(campos.semestre), sede: campos.sede,
        programa: programas.find((programa) => programa.getId() === campos.programa),
      })
      navigate(uso === 'tutor' ? '/perfil' : '/tutores', { replace: true })
    } catch (error) {
      setErrorServicio(error.message)
    } finally {
      setEnviando(false)
    }
  }

  const propiedades = (nombre) => ({
    nombre, valor: campos[nombre], alCambiar: (valor) => cambiar(nombre, valor),
    error: tocados[nombre] ? errores[nombre] : '', obligatorio: true, deshabilitado: enviando,
  })

  return (
    <section className="ct-autenticacion" aria-labelledby="titulo-registro">
      <img className="ct-autenticacion-logo" src={INSTITUCION.logos.vertical} alt={INSTITUCION.nombre} height="96" />
      <div className="ct-autenticacion-encabezado">
        <p className="ct-autenticacion-app">{INSTITUCION.nombreApp}</p>
        <h1 id="titulo-registro">Crea tu cuenta</h1>
        <p>Solo para estudiantes de {INSTITUCION.nombre}.</p>
      </div>
      <form noValidate onSubmit={enviar} onBlur={marcarTocado}>
        <CampoFormulario {...propiedades('nombre')} etiqueta="Nombre completo" autoComplete="name" />
        <CampoFormulario {...propiedades('correoInstitucional')} etiqueta="Correo institucional" tipo="email" autoComplete="email" ayuda={`Debe terminar en @${INSTITUCION.dominioCorreo}`} />
        <CampoFormulario {...propiedades('clave')} etiqueta="Contraseña" tipo="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres, con letras y números" />
        <CampoFormulario {...propiedades('confirmacion')} etiqueta="Confirmar contraseña" tipo="password" autoComplete="new-password" />
        {cargandoProgramas ? <Cargando texto="Cargando programas…" /> : errorProgramas ? (
          <MensajeError mensaje={errorProgramas} alReintentar={() => setIntento((anterior) => anterior + 1)} />
        ) : (
          <CampoFormulario {...propiedades('programa')} etiqueta="Programa" tipo="select" placeholder="Selecciona tu programa" opciones={programas.map((programa) => ({ valor: programa.getId(), etiqueta: programa.getNombre() }))} />
        )}
        <CampoFormulario {...propiedades('semestre')} etiqueta="Semestre" tipo="select" placeholder="Selecciona tu semestre" opciones={Array.from({ length: 10 }, (_, indice) => ({ valor: indice + 1, etiqueta: String(indice + 1) }))} />
        <CampoFormulario {...propiedades('sede')} etiqueta="Sede" tipo="select" placeholder="Selecciona tu sede" opciones={INSTITUCION.sedes.map((sede) => ({ valor: sede, etiqueta: sede }))} />
        <div>
          <p id="uso-registro">¿Cómo vas a usar la plataforma?</p>
          <div role="group" aria-labelledby="uso-registro" className="ct-uso-opciones">
            <button type="button" className="ct-uso-opcion" aria-pressed={uso === 'buscar'} onClick={() => setUso('buscar')} disabled={enviando}>
              <i className="bi bi-book" aria-hidden="true" />Busco tutoría
            </button>
            <button type="button" className="ct-uso-opcion" aria-pressed={uso === 'tutor'} onClick={() => setUso('tutor')} disabled={enviando}>
              <i className="bi bi-person-video3" aria-hidden="true" />Quiero ser tutor
            </button>
          </div>
        </div>
        {errorServicio && <MensajeError mensaje={errorServicio} />}
        <Boton tipo="submit" anchoCompleto cargando={enviando} deshabilitado={cargandoProgramas || Boolean(errorProgramas)}>Crear cuenta</Boton>
      </form>
      <p className="ct-autenticacion-pie">¿Ya tienes cuenta? <Link to="/ingresar">Inicia sesión</Link></p>
    </section>
  )
}
