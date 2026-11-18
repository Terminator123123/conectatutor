// Encuesta de cancelación: casillas con las razones y, al final, «Otro» con su explicación.
import { MOTIVOS_CANCELACION } from '../../servicios/motivosCancelacion.js'
import CampoFormulario from '../ui/CampoFormulario.jsx'

/**
 * @param {object} props Propiedades.
 * @param {{motivos: string[], otro: string}} props.valor Respuestas marcadas.
 * @param {function({motivos: string[], otro: string}): void} props.alCambiar Comunica las respuestas.
 * @param {boolean} [props.deshabilitado] Bloquea la encuesta mientras se guarda.
 * @param {string} [props.error] Problema a mostrar debajo.
 * @returns {import('react').ReactElement} Encuesta.
 */
export default function EncuestaCancelacion({ valor, alCambiar, deshabilitado = false, error = '' }) {
  function alternar(clave) {
    const motivos = valor.motivos.includes(clave) ? valor.motivos.filter((otra) => otra !== clave) : [...valor.motivos, clave]
    alCambiar({ ...valor, motivos })
  }
  return <fieldset className="ct-encuesta-cancelacion" disabled={deshabilitado}>
    <legend>¿Por qué cancelas? <small>Puedes marcar varias</small></legend>
    {Object.entries(MOTIVOS_CANCELACION).map(([clave, texto]) => <label key={clave} className="ct-casilla">
      <input type="checkbox" checked={valor.motivos.includes(clave)} onChange={() => alternar(clave)} />
      <span>{texto}</span>
    </label>)}
    {valor.motivos.includes('OTRO') && <CampoFormulario etiqueta="Cuéntanos la otra razón" nombre="otro" tipo="textarea"
      valor={valor.otro} alCambiar={(otro) => alCambiar({ ...valor, otro })} deshabilitado={deshabilitado} />}
    {error && <p className="ct-encuesta-error" role="alert">{error}</p>}
  </fieldset>
}
