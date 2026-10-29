// Presenta un diálogo en un portal con foco contenido y devolución del foco al cerrar.
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Muestra un diálogo controlado y bloquea el desplazamiento de la página mientras está abierto.
 * @param {object} props Propiedades del diálogo.
 * @param {boolean} props.abierto Indica si se muestra el diálogo.
 * @param {string} props.titulo Título accesible del diálogo.
 * @param {function(): void} props.alCerrar Solicita al padre cerrar el diálogo.
 * @param {import('react').ReactNode} props.children Contenido del diálogo.
 * @param {import('react').ReactNode} [props.pie] Acciones opcionales del pie.
 * @returns {import('react').ReactPortal|null} Diálogo o nada cuando está cerrado.
 */
export default function Modal({ abierto, titulo, alCerrar, children, pie }) {
  const idTitulo = useId()
  const panelRef = useRef(null)
  const alCerrarRef = useRef(alCerrar)

  useEffect(() => {
    alCerrarRef.current = alCerrar
  }, [alCerrar])

  useEffect(() => {
    if (!abierto) return

    const panel = panelRef.current
    const focoAnterior = document.activeElement
    const overflowAnterior = document.body.style.overflow
    const selector = 'a[href], button, input, select, textarea, [tabindex]'
    const obtenerEnfocables = () => [...panel.querySelectorAll(selector)].filter(
      (elemento) => elemento.tabIndex >= 0 && !elemento.matches(':disabled')
        && elemento.getClientRects().length > 0 && getComputedStyle(elemento).visibility !== 'hidden',
    )
    const enfocarPrimero = () => (obtenerEnfocables()[0] ?? panel).focus()

    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        alCerrarRef.current()
      } else if (evento.key === 'Tab') {
        const elementos = obtenerEnfocables()
        const primero = elementos[0]
        const ultimo = elementos.at(-1)
        const foco = document.activeElement

        if (!primero) {
          evento.preventDefault()
          panel.focus()
        } else if (evento.shiftKey && (foco === primero || foco === panel)) {
          evento.preventDefault()
          ultimo.focus()
        } else if (!evento.shiftKey && (foco === ultimo || foco === panel)) {
          evento.preventDefault()
          primero.focus()
        }
      }
    }

    function contenerFoco(evento) {
      if (!panel.contains(evento.target)) enfocarPrimero()
    }

    document.body.style.overflow = 'hidden'
    enfocarPrimero()
    document.addEventListener('keydown', manejarTecla)
    document.addEventListener('focusin', contenerFoco)

    return () => {
      document.removeEventListener('keydown', manejarTecla)
      document.removeEventListener('focusin', contenerFoco)
      document.body.style.overflow = overflowAnterior
      if (focoAnterior?.isConnected) focoAnterior.focus()
    }
  }, [abierto])

  if (!abierto) return null

  return createPortal(
    <div className="ct-modal">
      <button
        className="ct-modal-fondo"
        type="button"
        tabIndex={-1}
        aria-label="Cerrar modal"
        onClick={alCerrar}
      />
      <div className="ct-modal-panel" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} ref={panelRef}>
        <header className="ct-modal-cabecera">
          <h2 id={idTitulo}>{titulo}</h2>
          <button className="ct-modal-cerrar" type="button" aria-label="Cerrar" onClick={alCerrar}>
            <i className="bi bi-x" aria-hidden="true" />
          </button>
        </header>
        <div className="ct-modal-contenido">{children}</div>
        {pie && <footer className="ct-modal-pie">{pie}</footer>}
      </div>
    </div>,
    document.body,
  )
}
