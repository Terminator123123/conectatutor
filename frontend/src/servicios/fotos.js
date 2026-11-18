// Versión de la foto propia: al cambiarla, los avatares vuelven a pedirla sin recargar la página.
import { useSyncExternalStore } from 'react'

let version = 0
const escuchas = new Set()

/** Avisa a los avatares que la foto cambió. */
export function avisarFotoCambiada() {
  version = Date.now()
  escuchas.forEach((escuchar) => escuchar())
}

/** @returns {number} Versión actual de las fotos. */
export function useVersionFoto() {
  return useSyncExternalStore((escuchar) => { escuchas.add(escuchar); return () => escuchas.delete(escuchar) }, () => version)
}
