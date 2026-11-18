// Selector de idioma como el de uniguajira.edu.co: Español, English y Wayuunaiki.
import { useEffect, useRef, useState } from 'react'
import { cambiarIdioma, idiomaActual } from '../../servicios/traduccion.js'

// Banderas del selector del sitio oficial (traducciones-uniguajira).
const BANDERAS = {
  es: <><rect width="32" height="32" fill="#FCD116" /><rect y="16" width="32" height="16" fill="#CE1126" /><rect y="16" width="32" height="8" fill="#003893" /></>,
  en: <><rect width="32" height="32" fill="#B22234" /><path fill="#FFF" d="M0 4h32v2.3H0zm0 5.5h32v2.3H0zm0 5.5h32v2.3H0zm0 5.5h32v2.3H0zm0 5.5h32V28H0z" /><rect width="14" height="13" fill="#3C3B6E" /></>,
  wa: <><rect width="32" height="32" fill="#C4A35A" /><circle cx="16" cy="16" r="11" fill="#8B4513" opacity=".35" /><path d="M8 20c3-4 6-5 8-5s5 1 8 5" stroke="#F5E6C8" strokeWidth="1.5" fill="none" strokeLinecap="round" /><circle cx="12" cy="13" r="1.2" fill="#F5E6C8" /><circle cx="20" cy="13" r="1.2" fill="#F5E6C8" /></>,
}
const IDIOMAS = [['es', 'ES', 'Español'], ['en', 'EN', 'English'], ['wa', 'WA', 'Wayuunaiki']]

const Bandera = ({ codigo }) => <svg className="ct-idioma-bandera" viewBox="0 0 32 32" aria-hidden="true" focusable="false">{BANDERAS[codigo]}</svg>

/** @returns {import('react').ReactElement} Botón con menú de idiomas. */
export default function SelectorIdioma() {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState(false)
  const raiz = useRef(null)
  const actual = idiomaActual()
  useEffect(() => {
    if (!abierto) return undefined
    const cerrar = (evento) => {
      if (evento.type === 'keydown' ? evento.key === 'Escape' : !raiz.current?.contains(evento.target)) { setAbierto(false); setAviso(false) }
    }
    document.addEventListener('pointerdown', cerrar)
    document.addEventListener('keydown', cerrar)
    return () => { document.removeEventListener('pointerdown', cerrar); document.removeEventListener('keydown', cerrar) }
  }, [abierto])
  function elegir(codigo) {
    if (codigo === 'wa') { setAviso(true); return }
    setAbierto(false)
    cambiarIdioma(codigo)
  }
  return <div className="ct-selector-idioma notranslate" ref={raiz} translate="no">
    <button type="button" className="ct-idioma-boton" aria-expanded={abierto} aria-controls="lista-idiomas"
      aria-label={`Idioma: ${actual === 'en' ? 'English' : 'Español'}. Cambiar idioma`} onClick={() => { setAbierto(!abierto); setAviso(false) }}>
      <Bandera codigo={actual} /><span>{actual.toUpperCase()}</span><i className="bi bi-chevron-down" aria-hidden="true" />
    </button>
    {abierto && <div id="lista-idiomas" className="ct-idioma-menu">
      <ul>
        {IDIOMAS.map(([codigo, corto, nombre]) => <li key={codigo}>
          <button type="button" lang={codigo === 'wa' ? 'guc' : codigo} aria-current={codigo === actual ? 'true' : undefined} onClick={() => elegir(codigo)}>
            <Bandera codigo={codigo} /><span className="ct-idioma-codigo">{corto}</span><span>{nombre}</span>
            {codigo === actual && <i className="bi bi-check2" aria-hidden="true" />}
          </button>
        </li>)}
      </ul>
      {aviso && <p className="ct-idioma-aviso" role="status">La traducción al wayuunaiki está en preparación con la Universidad de La Guajira.</p>}
    </div>}
  </div>
}
