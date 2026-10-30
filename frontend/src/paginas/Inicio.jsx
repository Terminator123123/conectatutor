// Presenta el acompañamiento y los canales de Permanencia según el rol.
import { Link } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { RolUsuario } from '../modelo/enums.js'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Presentación y canales oficiales. */
export default function Inicio() {
  const { usuario, cargando } = useAutenticacion()
  return (
    <div className="ct-solicitante ct-inicio">
      <section className="ct-inicio-presentacion">
        <h1>Encuentra quién te acompañe en tus materias</h1>
        <p>{`${INSTITUCION.nombreApp} conecta a estudiantes de ${INSTITUCION.nombre} con estudiantes tutores de semestres más avanzados. Complementa las tutorías del Área de Permanencia de tu sede.`}</p>
        {!cargando && <div className="ct-acciones">
          {!usuario ? <>
            <Link className="ct-boton btn-ct-primario" to="/registro">Crear cuenta</Link>
            <Link className="ct-boton btn-ct-secundario" to="/ingresar">Ingresar</Link>
          </> : usuario.getRol() === RolUsuario.ESTUDIANTE ? (
            <Link className="ct-boton btn-ct-primario" to="/tutores">Buscar tutor</Link>
          ) : usuario.getRol() === RolUsuario.ADMINISTRADOR && (
            <Link className="ct-boton btn-ct-primario" to="/admin/verificacion">Ir a Coordinación</Link>
          )}
        </div>}
      </section>
      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona">¿Cómo funciona?</h2>
        <ol className="ct-pasos">
          <li><i className="bi bi-search" aria-hidden="true" /><h3>Busca</h3><p>Por materia, programa, sede y día.</p></li>
          <li><i className="bi bi-calendar-event" aria-hidden="true" /><h3>Solicita</h3><p>Eliges una franja libre y cuentas el tema.</p></li>
          <li><i className="bi bi-star" aria-hidden="true" /><h3>Califica</h3><p>Cuando termina la tutoría, ayudas a otros a elegir.</p></li>
        </ol>
      </section>
      <section aria-labelledby="canales-permanencia">
        <h2 id="canales-permanencia">Canales oficiales de Permanencia</h2>
        <p>¿Prefieres el canal de la universidad? Escribe al Área de Permanencia de tu sede.</p>
        <ul className="ct-canales">{Object.entries(INSTITUCION.canalesPermanencia).map(([sede, correo]) => (
          <li key={sede}><strong>{sede}</strong> <a href={`mailto:${correo}`}>{correo}</a></li>
        ))}</ul>
      </section>
    </div>
  )
}
