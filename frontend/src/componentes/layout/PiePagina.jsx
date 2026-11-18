// Pie institucional: la plataforma, la Universidad de La Guajira y sus certificaciones, con el tejido del sitio oficial.
import { Link } from 'react-router-dom'
import { INSTITUCION } from '../../config/institucion.js'

const anioActual = new Date().getFullYear()
const SITIO = 'https://uniguajira.edu.co'

// Datos tomados del pie de uniguajira.edu.co (18 nov 2026). Cada enlace lleva al sitio oficial.
const ENLACES_UNIVERSIDAD = [
  ['Sitio oficial', `${SITIO}/`],
  ['Canales de atención a la ciudadanía', `${SITIO}/atencion-y-servicios-a-la-ciudadania/canales-de-atencion-ciudadana/`],
  ['Aviso legal', `${SITIO}/aviso-legal/`],
  ['Políticas de privacidad', `${SITIO}/actualidad/acuerdo-no-009-de-2018/`],
  ['Protección de datos', INSTITUCION.urlTratamientoDatos],
]
const CERTIFICACIONES = [
  ['/pie/acreditacion.png', 'Acreditada institucionalmente en Alta Calidad', 64, 64],
  ['/pie/icontec.webp', 'Certificaciones ICONTEC e IQNET, ISO 9001', 64, 64],
  ['/pie/marca-pais.png', 'Marca país Colombia', 44, 44],
  ['/pie/gov-co.webp', 'gov.co', 105, 32],
  ['/pie/colombia-potencia-vida.webp', 'Colombia potencia de la vida', 93, 32],
]
const externo = { target: '_blank', rel: 'noopener noreferrer' }

/** @returns {import('react').ReactElement} Pie institucional con enlaces al sitio oficial. */
function PiePagina() {
  return (
    <footer className="ct-pie">
      <div className="ct-pie-contenido">
        <div className="ct-pie-marca">
          <a href={`${SITIO}/`} {...externo} className="ct-pie-logo" aria-label={`${INSTITUCION.nombre}, sitio oficial (se abre en otra pestaña)`}>
            <img src={INSTITUCION.logos.horizontal} alt="" width="154" height="48" loading="lazy" />
          </a>
          <p>ConectaTutor reúne a estudiantes que enseñan y estudiantes que aprenden, con el acompañamiento del Área de Permanencia.</p>
          <p className="ct-pie-nit"><strong>Nit 892115029-4</strong> · Vigilada Mineducación</p>
        </div>
        <nav aria-label="Plataforma">
          <h2>Plataforma</h2>
          <ul>
            <li><Link to="/">Buscar tutores</Link></li>
            <li><Link to="/como-funciona">Cómo funciona</Link></li>
            <li><Link to="/ingresar">Ingresar</Link></li>
          </ul>
        </nav>
        <nav aria-label="Universidad de La Guajira">
          <h2>Universidad de La Guajira</h2>
          <ul>
            {ENLACES_UNIVERSIDAD.map(([texto, url]) => <li key={texto}><a href={url} {...externo}>{texto}</a></li>)}
          </ul>
        </nav>
        <div>
          <h2>Contáctanos</h2>
          <ul>
            <li>Línea gratuita nacional: <a href="tel:+57018000955499">01 8000 95 5499</a></li>
            <li>Conmutador: <a href="tel:+576053133870">+57 605 313 3870</a></li>
            <li>Sedes: {INSTITUCION.sedes.join(', ')}</li>
            <li>Lunes a viernes, 8 a. m. a 12 m. y 3 p. m. a 7 p. m.</li>
          </ul>
        </div>
      </div>
      <a className="ct-pie-certificaciones" href={`${SITIO}/`} {...externo} aria-label="Certificaciones de la Universidad de La Guajira en el sitio oficial (se abre en otra pestaña)">
        {CERTIFICACIONES.map(([src, alt, ancho, alto]) => <img key={src} src={src} alt={alt} width={ancho} height={alto} loading="lazy" />)}
      </a>
      <div className="ct-pie-legal">
        <span>© {anioActual} {INSTITUCION.nombre}. Institución de Educación Superior sujeta a inspección y vigilancia por el Ministerio de Educación Nacional.</span>
        <a href={INSTITUCION.urlTratamientoDatos} {...externo}>Tratamiento de datos personales</a>
      </div>
    </footer>
  )
}

export default PiePagina
