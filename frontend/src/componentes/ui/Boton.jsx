// Presenta una acción con variantes institucionales y estados de carga y deshabilitado.

/**
 * Renderiza un botón reutilizable con contenido e icono opcional.
 * @param {object} props Propiedades del botón.
 * @param {import('react').ReactNode} props.children Contenido visible de la acción.
 * @param {'primario'|'secundario'} [props.variante='primario'] Variante visual.
 * @param {'button'|'submit'} [props.tipo='button'] Tipo de botón nativo.
 * @param {boolean} [props.anchoCompleto=false] Ocupa todo el ancho disponible.
 * @param {boolean} [props.deshabilitado=false] Impide activar la acción.
 * @param {boolean} [props.cargando=false] Muestra el indicador y deshabilita el botón.
 * @param {string} [props.icono] Clase bi-* del icono decorativo.
 * @param {function} [props.alHacerClic] Acción que se ejecuta al pulsar.
 * @returns {import('react').ReactElement} Botón de acción.
 */
export default function Boton({
  children,
  variante = 'primario',
  tipo = 'button',
  anchoCompleto = false,
  deshabilitado = false,
  cargando = false,
  icono,
  alHacerClic,
}) {
  const claseVariante = variante === 'secundario' ? 'btn-ct-secundario' : 'btn-ct-primario'

  return (
    <button
      type={tipo}
      className={`ct-boton ${claseVariante}${anchoCompleto ? ' ct-boton-completo' : ''}`}
      disabled={deshabilitado || cargando}
      aria-busy={cargando || undefined}
      onClick={alHacerClic}
    >
      {cargando ? (
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      ) : icono ? (
        <i className={`bi ${icono}`} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}
