// Detiene una operación en un punto (por ejemplo, una respuesta o un cifrado) para provocar una carrera,
// sin dejar la prueba esperando para siempre si la operación nunca llega a ese punto.
import assert from 'node:assert/strict'
import { setTimeout as esperar } from 'node:timers/promises'

/**
 * @param {object} [opciones]
 * @param {number} [opciones.tope] Milisegundos máximos de espera hasta que la operación llegue al punto.
 * @returns {{detener: () => Promise<void>, esperarLlegada: (operacion: Promise<unknown>) => Promise<void>, soltar: () => void}}
 */
export function crearRetencion({ tope = 5000 } = {}) {
  let avisar
  let soltar
  const llego = new Promise((resolver) => { avisar = resolver })
  const liberada = new Promise((resolver) => { soltar = resolver })
  return {
    /** Dentro de la operación: avisa que llegó y espera a que la suelten. */
    async detener() {
      avisar()
      await liberada
    },
    /**
     * En la prueba: espera a que la operación llegue al punto. Falla en un tiempo acotado si la operación
     * terminó sin pasar por él o si no llega antes del tope.
     */
    async esperarLlegada(operacion) {
      const resultado = await Promise.race([
        llego.then(() => 'llego'),
        Promise.resolve(operacion).then(() => 'termino', () => 'termino'),
        esperar(tope, 'tope', { ref: false }),
      ])
      assert.equal(resultado, 'llego', resultado === 'tope'
        ? `la operación no llegó al punto de retención en ${tope} ms`
        : 'la operación terminó sin pasar por el punto de retención')
    },
    /** Libera la operación detenida; se puede llamar varias veces. */
    soltar: () => soltar(),
  }
}
