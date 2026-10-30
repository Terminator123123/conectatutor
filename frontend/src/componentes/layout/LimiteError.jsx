// Recupera errores de render sin ocultar la navegación de la aplicación.
import { Component } from 'react'
import MensajeError from '../ui/MensajeError.jsx'

// React solo permite atrapar errores de render con componentes de clase.
/**
 * Límite de errores de la pantalla activa.
 * @param {{children: import('react').ReactNode}} props Contenido de la ruta.
 * @extends {Component<{children: import('react').ReactNode}>}
 */
export default class LimiteError extends Component {
  state = { error: false }

  /**
   * Activa la pantalla de recuperación cuando React captura un error.
   * @param {Error} _error Error de render capturado por React.
   * @returns {{error: boolean}} Estado de recuperación.
   */
  static getDerivedStateFromError(_error) {
    return { error: true }
  }

  /** @returns {void} No registra ni transmite datos del error. */
  componentDidCatch() {
    // La recuperación se presenta en la interfaz, sin registrar datos personales.
  }

  /** @returns {import('react').ReactNode} Contenido o mensaje con reintento. */
  render() {
    if (this.state.error) return <MensajeError mensaje="Algo salió mal al mostrar esta pantalla." alReintentar={() => this.setState({ error: false })} />
    return this.props.children
  }
}
