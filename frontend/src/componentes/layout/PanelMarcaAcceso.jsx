// Panel institucional que acompaña el ingreso en pantallas anchas.
import { INSTITUCION } from '../../config/institucion.js'

const RAZONES = [
  ['bi-patch-check', 'Tutores verificados', 'Cada tutor aprobó la materia y Permanencia revisa su perfil.'],
  ['bi-calendar2-check', 'Horarios claros', 'Eliges una franja libre y el tutor confirma tu solicitud.'],
  ['bi-shield-lock', 'Solo tu comunidad', `Ingresas con tu correo @${INSTITUCION.dominioCorreo}.`],
]

/** @returns {import('react').ReactElement} Presentación de la marca junto a los formularios de acceso. */
export default function PanelMarcaAcceso() {
  return (
    <aside className="ct-acceso-marca" aria-label="Sobre ConectaTutor">
      <img className="ct-acceso-logo" src={INSTITUCION.logos.horizontal} alt={INSTITUCION.nombre} width="218" height="68" />
      <div className="ct-acceso-mensaje">
        <p className="ct-acceso-sobretitulo">ConectaTutor</p>
        <p className="ct-acceso-titulo">Aprender se hace más fácil en comunidad.</p>
        <ul>
          {RAZONES.map(([icono, titulo, texto]) => (
            <li key={titulo}><i className={`bi ${icono}`} aria-hidden="true" /><span><strong>{titulo}</strong>{texto}</span></li>
          ))}
        </ul>
      </div>
      <p className="ct-acceso-pie">{INSTITUCION.nombre} · Área de Permanencia y Graduación Exitosa</p>
    </aside>
  )
}
