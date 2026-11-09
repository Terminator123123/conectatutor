// Identidad en fila con el símbolo institucional en el cuadro del prototipo.
import { INSTITUCION } from '../../config/institucion.js'

/** @returns {import('react').ReactElement} Marca institucional de la aplicación. */
export default function MarcaApp() {
  return <div className="ct-marca"><span className="ct-simbolo"><img src={INSTITUCION.logos.favicon} alt="" width="20" height="20" /></span><span>{INSTITUCION.nombreApp}</span></div>
}
