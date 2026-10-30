// Ofrece una salida a la ruta inicial del usuario desde una dirección inexistente.
import { useAutenticacion } from '../contexto/useAutenticacion.js'
import { rutaInicialDe } from '../servicios/rutasPorRol.js'
import { useTituloPagina } from '../hooks/useTituloPagina.js'
import EstadoVacio from '../componentes/ui/EstadoVacio.jsx'

/** @returns {import('react').ReactElement} Estado de página no encontrada. */
export default function NoEncontrada() {
  const { usuario } = useAutenticacion()
  useTituloPagina('No encontramos esta página')
  return <section><h1 className="visually-hidden">No encontramos esta página</h1><EstadoVacio icono="bi-signpost-split" titulo="No encontramos esta página" texto="Revisa la dirección o vuelve al inicio." accion={{ etiqueta: 'Ir al inicio', ruta: rutaInicialDe(usuario) }} /></section>
}
