// Sincroniza el título de la pestaña con la pantalla activa.
import { useEffect } from 'react'
import { INSTITUCION } from '../config/institucion.js'

/**
 * Actualiza el título; Inicio usa una cadena vacía para mostrar solo el nombre de la app.
 * @param {string} titulo Título de la pantalla, o cadena vacía para Inicio.
 * @returns {void} Efecto de sincronización con el documento.
 */
export function useTituloPagina(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${INSTITUCION.nombreApp}` : INSTITUCION.nombreApp
  }, [titulo])
}
