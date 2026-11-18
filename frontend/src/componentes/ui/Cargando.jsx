// Estado de carga: animación con el escudo de la universidad o esqueleto con la forma del contenido.
import { INSTITUCION } from '../../config/institucion.js'

/** Deduce del texto qué forma tendrá el contenido que se está cargando. */
function formaDe(texto) {
  const t = texto.toLowerCase()
  if (/sesión…$|enlace|^cargando…$/.test(t)) return 'marca'
  if (/tutores|favoritos|tutorías|perfiles/.test(t)) return 'tarjetas'
  if (/perfil/.test(t)) return 'perfil'
  if (/programas/.test(t)) return 'campo'
  if (/sesiones|solicitudes|novedades|materias|catálogo|revisión|propuestas/.test(t)) return 'lista'
  return 'formulario'
}

const linea = (ancho, alto = 14) => <span className="ct-esqueleto" style={{ width: ancho, height: alto }} />

const FORMAS = {
  tarjetas: () => <div className="ct-esqueleto-rejilla">
    {[0, 1, 2].map((i) => <div key={i} className="ct-esqueleto-tarjeta">
      <div className="ct-esqueleto-fila"><span className="ct-esqueleto ct-esqueleto-circulo" />
        <div className="ct-esqueleto-columna">{linea('70%', 16)}{linea('50%')}</div></div>
      {linea('85%')}
      <div className="ct-esqueleto-fila ct-esqueleto-entre">{linea('35%')}{linea('22%')}</div>
      <span className="ct-esqueleto ct-esqueleto-boton" />
    </div>)}
  </div>,
  lista: () => <div className="ct-esqueleto-columna ct-esqueleto-lista">
    {[0, 1, 2, 3].map((i) => <div key={i} className="ct-esqueleto-tarjeta ct-esqueleto-fila">
      <span className="ct-esqueleto ct-esqueleto-circulo ct-esqueleto-circulo-chico" />
      <div className="ct-esqueleto-columna">{linea('55%', 16)}{linea('80%')}</div>
    </div>)}
  </div>,
  perfil: () => <div className="ct-esqueleto-perfil">
    <div className="ct-esqueleto-tarjeta ct-esqueleto-columna">
      <span className="ct-esqueleto ct-esqueleto-circulo ct-esqueleto-circulo-grande" />
      {linea('70%', 20)}{linea('90%')}{linea('40%')}<span className="ct-esqueleto ct-esqueleto-boton" />
    </div>
    <div className="ct-esqueleto-columna">{linea('80%', 28)}{linea('100%')}{linea('95%')}{linea('60%')}
      <div className="ct-esqueleto-fila">{linea('22%', 30)}{linea('26%', 30)}{linea('18%', 30)}</div></div>
  </div>,
  formulario: () => <div className="ct-esqueleto-tarjeta ct-esqueleto-columna ct-esqueleto-formulario">
    {linea('60%', 24)}
    {[0, 1, 2].map((i) => <div key={i} className="ct-esqueleto-columna">{linea('30%', 12)}<span className="ct-esqueleto ct-esqueleto-campo" /></div>)}
    <span className="ct-esqueleto ct-esqueleto-boton" />
  </div>,
  campo: () => <div className="ct-esqueleto-columna">{linea('30%', 12)}<span className="ct-esqueleto ct-esqueleto-campo" /></div>,
}

/**
 * Muestra un estado de carga que los lectores de pantalla anuncian.
 * @param {object} props Propiedades del estado.
 * @param {string} [props.texto='Cargando…'] Texto que se anuncia.
 * @param {import('react').ReactNode} [props.aviso] Mensaje sobre el esqueleto (por ejemplo, la reconexión).
 * @param {'marca'|'tarjetas'|'lista'|'perfil'|'formulario'|'campo'} [props.forma] Forma del contenido; se deduce del texto.
 * @returns {import('react').ReactElement} Estado de carga.
 */
export default function Cargando({ texto = 'Cargando…', forma, aviso }) {
  const tipo = forma ?? formaDe(texto)
  // Pantalla completa: esqueleto de toda la aplicación con el logo reflejando luz en bucle
  if (tipo === 'marca') return <div className="ct-carga-pantalla" role="status" aria-busy="true">
    <span className="visually-hidden">{texto}</span>
    <div aria-hidden="true" className="ct-carga-pantalla-interior">
      <div className="ct-carga-cabecera">
        <span className="ct-carga-logo" style={{ '--logo': `url(${INSTITUCION.logos.horizontal})` }}>
          <img src={INSTITUCION.logos.horizontal} alt="" />
        </span>
        <div className="ct-esqueleto-fila ct-carga-menu">{linea(72, 14)}{linea(72, 14)}{linea(72, 14)}<span className="ct-esqueleto ct-esqueleto-circulo ct-esqueleto-circulo-chico" /></div>
      </div>
      <div className="ct-carga-cuerpo">
        {aviso}
        {linea('38%', 30)}{linea('62%', 14)}
        <div className="ct-esqueleto-fila ct-carga-filtros">{linea('100%', 48)}{linea('100%', 48)}{linea('100%', 48)}</div>
        {FORMAS.tarjetas()}
        {FORMAS.tarjetas()}
      </div>
    </div>
  </div>
  return <div className="ct-cargando-esqueleto" role="status" aria-busy="true">
    <span className="visually-hidden">{texto}</span>
    {aviso}
    <div aria-hidden="true">{FORMAS[tipo]()}</div>
  </div>
}
