// Presenta un motivo controlado para rechazar o cancelar sin conocer el dominio.
import { useEffect, useRef } from 'react'
import Modal from '../ui/Modal.jsx'
import CampoFormulario from '../ui/CampoFormulario.jsx'
import MensajeError from '../ui/MensajeError.jsx'
import Boton from '../ui/Boton.jsx'

/**
 * @param {object} props Propiedades de presentación del diálogo.
 * @param {boolean} props.abierto Si se muestra el diálogo.
 * @param {string} props.titulo Título accesible.
 * @param {string} props.etiquetaConfirmar Texto de la acción principal.
 * @param {string} props.motivo Texto controlado.
 * @param {function(string): void} props.alCambiarMotivo Comunica el texto escrito.
 * @param {string} props.errorMotivo Error de validación del campo.
 * @param {string} props.errorAccion Error al realizar la acción.
 * @param {boolean} props.enviando Bloquea controles durante el guardado.
 * @param {function(): void} props.alConfirmar Confirma la acción.
 * @param {function(): void} props.alCerrar Cierra el diálogo.
 * @returns {import('react').ReactElement} Diálogo de motivo reutilizable.
 */
export default function ModalMotivo({ abierto, titulo, etiquetaConfirmar, motivo, alCambiarMotivo, errorMotivo, errorAccion, enviando, alConfirmar, alCerrar }) {
  const campoRef = useRef(null)
  useEffect(() => {
    if (abierto && errorMotivo) campoRef.current?.querySelector('textarea')?.focus()
  }, [abierto, errorMotivo])
  return <Modal abierto={abierto} titulo={titulo} alCerrar={alCerrar} pie={<>
    <Boton variante="secundario" alHacerClic={alCerrar} deshabilitado={enviando}>Volver</Boton>
    <Boton alHacerClic={alConfirmar} cargando={enviando}>{etiquetaConfirmar}</Boton>
  </>}>
    <div ref={campoRef}><CampoFormulario etiqueta="Motivo" tipo="textarea" valor={motivo} alCambiar={alCambiarMotivo} obligatorio deshabilitado={enviando} error={errorMotivo} ayuda="Escribe al menos 5 caracteres." /></div>
    {errorAccion && <MensajeError mensaje={errorAccion} />}
  </Modal>
}
