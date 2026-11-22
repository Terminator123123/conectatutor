// Una sola pestaña activa: al abrir ConectaTutor en otra, la anterior se cierra para no mezclar acciones.
import { useEffect, useState } from 'react'
import { INSTITUCION } from '../../config/institucion.js'
import { nuevoId } from '../../modelo/identificador.js'

const canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('conectatutor-pestana')
const ID_PESTANA = nuevoId()

/**
 * @param {object} props Propiedades.
 * @param {import('react').ReactNode} props.children Aplicación.
 * @returns {import('react').ReactNode} La aplicación o el aviso de pestaña cerrada.
 */
export default function GuardiaPestana({ children }) {
  const [cerrada, setCerrada] = useState(false)
  useEffect(() => {
    if (!canal) return undefined
    const oir = (evento) => { if (evento.data?.tipo === 'abierta' && evento.data.id !== ID_PESTANA) setCerrada(true) }
    canal.addEventListener('message', oir)
    // Esta pestaña es la más nueva: avisa a las demás para que se cierren
    canal.postMessage({ tipo: 'abierta', id: ID_PESTANA })
    return () => canal.removeEventListener('message', oir)
  }, [])

  if (!cerrada) return children
  return <main className="ct-pestana-cerrada">
    <img src={INSTITUCION.logos.vertical} alt="" width="72" height="107" />
    <h1>ConectaTutor está abierto en otra pestaña</h1>
    <p>Para evitar acciones repetidas o cruzadas, solo una pestaña puede usarse a la vez. Esta se cerró.</p>
    <button type="button" onClick={() => { canal?.postMessage({ tipo: 'abierta', id: ID_PESTANA }); location.reload() }}>Usar ConectaTutor aquí</button>
  </main>
}
