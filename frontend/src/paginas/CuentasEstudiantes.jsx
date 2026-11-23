// Coordinación crea las cuentas de los estudiantes con los datos de Uniguajira.
import { useEffect, useState } from 'react'
import { INSTITUCION } from '../config/institucion.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { repositorio } from '../servicios/instancias.js'
import Boton from '../componentes/ui/Boton.jsx'
import CampoFormulario from '../componentes/ui/CampoFormulario.jsx'
import Cargando from '../componentes/ui/Cargando.jsx'
import MensajeError from '../componentes/ui/MensajeError.jsx'
import '../estilos/autenticacion.css'

const VACIOS = { nombre: '', correoInstitucional: '', documento: '', programa: '', semestre: '', sede: '' }

/** Revisa el formulario antes de enviarlo; devuelve el primer problema o ''. */
function revisar(campos) {
  if (campos.nombre.trim().replace(/\s/g, '').length < 3) return 'Escribe el nombre completo.'
  if (!campos.correoInstitucional.trim().toLowerCase().endsWith(`@${INSTITUCION.dominioCorreo}`)) return `El correo debe ser institucional (@${INSTITUCION.dominioCorreo}).`
  if (!/^\d{6,12}$/.test(campos.documento.trim())) return 'El documento debe tener entre 6 y 12 dígitos, sin puntos ni espacios.'
  if (!campos.programa || !campos.semestre || !campos.sede) return 'Elige programa, semestre y sede.'
  return ''
}

/** @returns {import('react').ReactElement} Alta de cuentas de estudiantes. */
export default function CuentasEstudiantes() {
  useTituloPagina('Cuentas de estudiantes')
  const [programas, setProgramas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)
  const [campos, setCampos] = useState(VACIOS)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [creada, setCreada] = useState(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setErrorCarga('')
      try { const lista = await repositorio.listarProgramas(); if (activo) setProgramas(lista) }
      catch (fallo) { if (activo) setErrorCarga(fallo.message) }
      finally { if (activo) setCargando(false) }
    }
    cargar()
    return () => { activo = false }
  }, [intento])

  const cambiar = (nombre) => (valor) => { setCampos((anteriores) => ({ ...anteriores, [nombre]: valor })); setError('') }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    const fallo = revisar(campos)
    if (fallo) { setError(fallo); return }
    setEnviando(true); setCreada(null)
    try {
      const cuenta = await repositorio.crearCuentaEstudiante({ ...campos, documento: campos.documento.trim() })
      setCreada({ nombre: cuenta.getNombre(), correo: cuenta.getCorreo() })
      setCampos(VACIOS)
    } catch (problema) { setError(problema.message) }
    finally { setEnviando(false) }
  }

  return <section className="ct-cuentas-estudiantes" aria-labelledby="titulo-cuentas">
    <h1 id="titulo-cuentas">Cuentas de estudiantes</h1>
    <p className="ct-texto-secundario">
      Registra a cada estudiante con sus datos de matrícula. Ingresa con su correo institucional y su documento de identidad;
      en el primer ingreso crea su propia contraseña y acepta el tratamiento de datos.
    </p>
    {creada && <p className="ct-aviso" role="status">
      Cuenta creada para {creada.nombre}. Ya puede ingresar con {creada.correo} y su documento.
    </p>}
    {cargando ? <Cargando texto="Cargando programas…" /> : errorCarga
      ? <MensajeError mensaje={errorCarga} alReintentar={() => setIntento((valor) => valor + 1)} forma="formulario" />
      : <form noValidate onSubmit={enviar} className="ct-cuenta-seccion">
        <CampoFormulario etiqueta="Nombre completo" nombre="nombre" valor={campos.nombre} alCambiar={cambiar('nombre')} deshabilitado={enviando} autoComplete="off" />
        <CampoFormulario etiqueta="Correo institucional" nombre="correoInstitucional" tipo="email" valor={campos.correoInstitucional}
          alCambiar={cambiar('correoInstitucional')} deshabilitado={enviando} autoComplete="off" placeholder={`nombre@${INSTITUCION.dominioCorreo}`} />
        <CampoFormulario etiqueta="Documento de identidad" nombre="documento" valor={campos.documento} alCambiar={cambiar('documento')}
          deshabilitado={enviando} autoComplete="off" ayuda="Será la contraseña inicial. No se guarda en claro." />
        <CampoFormulario etiqueta="Programa" tipo="select" valor={campos.programa} alCambiar={cambiar('programa')} deshabilitado={enviando}
          placeholder="Selecciona el programa" opciones={programas.map((programa) => ({ valor: programa.getId(), etiqueta: programa.getNombre() }))} />
        <CampoFormulario etiqueta="Semestre" tipo="select" valor={campos.semestre} alCambiar={cambiar('semestre')} deshabilitado={enviando}
          placeholder="Selecciona el semestre" opciones={Array.from({ length: 10 }, (_, i) => ({ valor: String(i + 1), etiqueta: String(i + 1) }))} />
        <CampoFormulario etiqueta="Sede" tipo="select" valor={campos.sede} alCambiar={cambiar('sede')} deshabilitado={enviando}
          placeholder="Selecciona la sede" opciones={INSTITUCION.sedes.map((sede) => ({ valor: sede, etiqueta: sede }))} />
        {error && <MensajeError mensaje={error} />}
        <Boton tipo="submit" cargando={enviando}>Crear cuenta</Boton>
      </form>}
  </section>
}
