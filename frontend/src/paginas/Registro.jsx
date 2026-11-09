// Registra estudiantes con validación en vivo y entrada automática.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
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
import MarcaApp from '../componentes/ui/MarcaApp.jsx'
import EncabezadoPagina from '../componentes/layout/EncabezadoPagina.jsx'
import '../estilos/autenticacion.css'

/** @returns {import('react').ReactElement} Formulario de creación de cuenta. */
export default function Registro() {
  useTituloPagina('Crea tu cuenta')
  const [campos, setCampos] = useState({
    nombre: '', correoInstitucional: '', clave: '', confirmacion: '', programa: '', semestre: '', sede: '',
  })
  const [tocados, setTocados] = useState({})
  const [programas, setProgramas] = useState([])
  const [cargandoProgramas, setCargandoProgramas] = useState(true)
  const [errorProgramas, setErrorProgramas] = useState('')
  const [intento, setIntento] = useState(0)
  const [uso, setUso] = useState('buscar')
  const [paso, setPaso] = useState(1)
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
      if (primerError === 'clave' && campos.clave.length > 0 && campos.clave.length < 8) {
        setPaso('clave-invalida')
        window.scrollTo(0, 0)
        return
      }
      evento.currentTarget.elements.namedItem(primerError)?.focus()
      return
    }
    if (cargandoProgramas || errorProgramas) return
    setPaso(2)
    window.scrollTo(0, 0)
  }

  function aceptar() {
    //solucion temp por falrta de bak correguir despues//
    setPaso(3)
    window.scrollTo(0, 0)
  }

  async function crearCuenta() {
    if (enviando) return
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

  function verificarCorreo() {
    //solucion temp por falrta de bak correguir despues//
    return crearCuenta()
  }

  if (paso === 'clave-invalida') return <section className="ct-autenticacion ct-error-acceso">
    <EncabezadoPagina titulo="Registro" alVolver={() => setPaso(1)} />
    <h1>Usa una contraseña más larga</h1>
    <CampoFormulario etiqueta="Contraseña" nombre="clave" tipo="password" autoComplete="new-password"
      valor={campos.clave} alCambiar={(valor) => cambiar('clave', valor)}
      error={campos.clave.length < 8 ? 'Usa al menos 8 caracteres.' : ''} />
    <div className="ct-acciones-acceso"><Boton anchoCompleto alHacerClic={() => setPaso(1)}>Corregir contraseña</Boton></div>
  </section>

  if (errorServicio.startsWith('Ya existe una cuenta')) return <section className="ct-autenticacion ct-error-acceso">
    <EncabezadoPagina titulo="Registro" alVolver={() => { setErrorServicio(''); setPaso(1) }} />
    <h1>Ya hay una cuenta con ese correo</h1>
    <CampoFormulario etiqueta="Correo institucional" tipo="email" valor={campos.correoInstitucional}
      alCambiar={(valor) => cambiar('correoInstitucional', valor)} error="Inicia sesión o recupera el acceso a tu cuenta." />
    <div className="ct-acciones-acceso">
        <Link className="ct-boton btn-ct-primario" to="/ingresar">Iniciar sesión
      </Link>
        <Link className="ct-boton btn-ct-secundario" to="/recuperar-acceso">Recuperar acceso
      </Link>
      </div>
  </section>

  if (paso === 2) return <section className="ct-autenticacion ct-consentimiento">
    <EncabezadoPagina titulo="Aviso y consentimiento" alVolver={() => setPaso(1)} />
    <p className="ct-paso">Paso 2 de 3</p><h1>Decide sobre tus datos</h1>
    <p>Usamos tus datos de cuenta y académicos para gestionar tu perfil, tus solicitudes y tus tutorías. Tu nombre, biografía y reseñas son visibles para la comunidad; tu correo y teléfono no. Puedes pedir la corrección o eliminación de tus datos desde tu perfil.
    </p>
    <a className="ct-dato" href={INSTITUCION.urlTratamientoDatos} target="_blank" rel="noreferrer"><small>Aviso</small>Aviso de privacidad</a>
    <p>Puedes consultar este aviso cuando quieras desde tu perfil.</p>
    <div className="ct-dato"><small>Tu decisión</small>Acepto el tratamiento de mis datos personales</div>
    <p>Debes aceptar para terminar de crear tu cuenta.</p>
    <div className="ct-acciones-acceso">
        <Boton anchoCompleto alHacerClic={aceptar}>Acepto y continúo
      </Boton>
        <Boton anchoCompleto variante="secundario" alHacerClic={() => navigate('/')}>No acepto
      </Boton>
      </div>
  </section>
  if (paso === 3) return <section className="ct-autenticacion"><MarcaApp /><p className="ct-paso">Paso 3 de 3</p>
    <h1>Revisa tu correo</h1><p>Verifica tu correo institucional para empezar a aprender con tu comunidad.</p>
    <div className="ct-dato"><small>Correo institucional</small>{campos.correoInstitucional}</div>
    {errorServicio && <MensajeError mensaje={errorServicio} />}
    <Boton anchoCompleto cargando={enviando} alHacerClic={verificarCorreo}>Continuar</Boton>
  </section>

  return (
    <section className="ct-autenticacion" aria-labelledby="titulo-registro">
      <MarcaApp />
      <div className="ct-autenticacion-encabezado">
        <h1 id="titulo-registro">Aprende con tu comunidad.</h1>
        <p>Crea tu cuenta con el correo de {INSTITUCION.nombreCorto}.</p>
      </div>
      <form noValidate onSubmit={enviar} onBlur={marcarTocado}>
        <CampoFormulario {...propiedades('nombre')} etiqueta="Nombre completo" autoComplete="name" />
        <CampoFormulario {...propiedades('correoInstitucional')} etiqueta="Correo institucional" tipo="email" autoComplete="email" ayuda="Tu correo no se mostrará públicamente." />
        <CampoFormulario {...propiedades('clave')} etiqueta="Contraseña" tipo="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres, con letras y números" />
        <div>
          <p id="uso-registro">¿Cómo quieres empezar?</p>
          <div role="group" aria-labelledby="uso-registro" className="ct-uso-opciones">
            <button type="button" className="ct-uso-opcion" aria-pressed={uso === 'buscar'} onClick={() => setUso('buscar')} disabled={enviando}>
              <strong>Necesito ayuda</strong><small>Solicitante</small>
            </button>
            <button type="button" className="ct-uso-opcion" aria-pressed={uso === 'tutor'} onClick={() => setUso('tutor')} disabled={enviando}>
              <strong>Quiero enseñar</strong><small>Tutor</small>
            </button>
          </div>
        </div>
        <CampoFormulario {...propiedades('confirmacion')} etiqueta="Confirmar contraseña" tipo="password" autoComplete="new-password" />
        {cargandoProgramas ? <Cargando texto="Cargando programas…" /> : errorProgramas ? (
          <MensajeError mensaje={errorProgramas} alReintentar={() => setIntento((anterior) => anterior + 1)} />
        ) : (
          <CampoFormulario
            {...propiedades('programa')}
            etiqueta="Programa"
            tipo="select"
            placeholder="Selecciona tu programa"
            opciones={programas.map((programa) => ({ valor: programa.getId(), etiqueta: programa.getNombre() }))} />
        )}
        <CampoFormulario
          {...propiedades('semestre')}
          etiqueta="Semestre"
          tipo="select"
          placeholder="Selecciona tu semestre"
          opciones={Array.from({ length: 10 }, (_, indice) => ({ valor: indice + 1, etiqueta: String(indice + 1) }))} />
        <CampoFormulario
          {...propiedades('sede')}
          etiqueta="Sede"
          tipo="select"
          placeholder="Selecciona tu sede"
          opciones={INSTITUCION.sedes.map((sede) => ({ valor: sede, etiqueta: sede }))} />
        {errorServicio && <MensajeError mensaje={errorServicio} />}
        <Boton tipo="submit" anchoCompleto cargando={enviando} deshabilitado={cargandoProgramas || Boolean(errorProgramas)}>
          {tocados.correoInstitucional && errores.correoInstitucional ? 'Corregir correo' : 'Crear cuenta'}
        </Boton>
      </form>
      <Link className="btn-ct-secundario ct-boton ct-boton-completo" to="/ingresar">Ya tengo una cuenta</Link>
    </section>
  )
}
