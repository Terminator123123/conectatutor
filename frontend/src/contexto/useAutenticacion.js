import { useContext } from 'react'
import { ContextoAutenticacion } from './ContextoAutenticacion.js'

/**
 * Obtiene el estado y las operaciones del proveedor de autenticación.
 * @returns {object} Valor del contexto de autenticación.
 * @throws {Error} Si se usa fuera de ProveedorAutenticacion.
 */
export function useAutenticacion() {
  const contexto = useContext(ContextoAutenticacion)
  if (contexto === null) {
    throw new Error('useAutenticacion debe usarse dentro de ProveedorAutenticacion')
  }
  return contexto
}
