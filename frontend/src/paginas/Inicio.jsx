// Presenta el acompañamiento y los canales de Permanencia según el rol.
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import { Link } from 'react-router-dom'
import { INSTITUCION } from '../config/institucion.js'
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { RolUsuario } from '../modelo/enums.js'
import '../estilos/solicitante.css'

/** @returns {import('react').ReactElement} Presentación y canales oficiales. */
export default function Inicio() {
  useTituloPagina('Cómo funciona')
  const { usuario, cargando } = useAutenticacion()
  return (
    <div className="ct-solicitante ct-inicio">
      <section className="ct-inicio-presentacion">
        <div className="ct-inicio-texto">
          <p className="ct-inicio-sobretitulo"><i className="bi bi-mortarboard" aria-hidden="true" /> {INSTITUCION.nombre}</p>
          <h1>Encuentra quién te acompañe en tus materias</h1>
          <p>
            {`${INSTITUCION.nombreApp} conecta a estudiantes de ${INSTITUCION.nombre} con estudiantes tutores de semestres más avanzados. Complementa las tutorías del Área de Permanencia de tu sede.`}
          </p>
          {!cargando && <div className="ct-acciones">
            {!usuario ? <>
              <Link className="ct-boton btn-ct-primario" to="/">Ver tutores disponibles</Link>
              <Link className="ct-boton btn-ct-secundario" to="/ingresar">Ingresar</Link>
            </> : usuario.getRol() === RolUsuario.ESTUDIANTE ? (
              <Link className="ct-boton btn-ct-primario" to="/tutores">Buscar tutor</Link>
            ) : usuario.getRol() === RolUsuario.ADMINISTRADOR && (
              <Link className="ct-boton btn-ct-primario" to="/admin/verificacion">Ir a Coordinación</Link>
            )}
          </div>}
        </div>
        <div className="ct-inicio-ilustracion" aria-hidden="true">
          <div className="ct-ilus-tarjeta ct-ilus-principal">
            <div className="ct-ilus-fila"><span className="ct-ilus-avatar">TU</span><span><strong>Cálculo Diferencial</strong><small>Tutor verificado · 7.° semestre</small></span></div>
            <div className="ct-ilus-franjas"><span>Lun 2:00 p. m.</span><span className="ct-ilus-activa">Mar 4:00 p. m.</span><span>Jue 10:00 a. m.</span></div>
            <span className="ct-ilus-boton">Solicitar tutoría</span>
          </div>
          <div className="ct-ilus-tarjeta ct-ilus-flotante ct-ilus-confirmada"><i className="bi bi-check2-circle" /> Sesión confirmada</div>
          <div className="ct-ilus-tarjeta ct-ilus-flotante ct-ilus-estrellas"><i className="bi bi-star-fill" /><i className="bi bi-star-fill" /><i className="bi bi-star-fill" /><i className="bi bi-star-fill" /><i className="bi bi-star-fill" /></div>
        </div>
      </section>
      <section aria-labelledby="como-funciona" className="ct-inicio-seccion">
        <h2 id="como-funciona">¿Cómo funciona?</h2>
        <ol className="ct-pasos">
          <li><span className="ct-paso-icono"><i className="bi bi-search" aria-hidden="true" /></span><h3>Busca</h3><p>Por materia, programa, sede y día.</p></li>
          <li><span className="ct-paso-icono"><i className="bi bi-calendar-event" aria-hidden="true" /></span><h3>Solicita</h3><p>Eliges una franja libre y cuentas el tema.</p></li>
          <li><span className="ct-paso-icono"><i className="bi bi-star" aria-hidden="true" /></span><h3>Califica</h3><p>Cuando termina la tutoría, ayudas a otros a elegir.</p></li>
        </ol>
      </section>
      <section aria-labelledby="canales-permanencia" className="ct-inicio-seccion">
        <h2 id="canales-permanencia">Canales oficiales de Permanencia</h2>
        <p>¿Prefieres el canal de la universidad? Escribe al Área de Permanencia de tu sede.</p>
        <ul className="ct-canales">{Object.entries(INSTITUCION.canalesPermanencia).map(([sede, correo]) => (
          <li key={sede}>
            <span className="ct-canal-icono"><i className="bi bi-geo-alt" aria-hidden="true" /></span>
            <strong>{sede}</strong>
            <a href={`mailto:${correo}`}>{correo.split('@')[0]}<wbr />@{correo.split('@')[1]}</a>
          </li>
        ))}</ul>
      </section>
    </div>
  )
}
