// Qué cuenta mostrar cuando una mutación de la propia cuenta ya quedó guardada en la API (por ejemplo,
// el primer acceso). Va aparte del proveedor para poder probarlo sin React.

/**
 * Ejecuta la mutación y muestra la cuenta que la confirma, sin otra consulta: si esa lectura fallara,
 * la mutación ya hecha se presentaría como fallida. Una confirmación que llega después de que la sesión
 * expiró, se cerró o pasó a ser otra no se muestra.
 * @param {object} opciones Pasos que pone el proveedor.
 * @param {() => Promise<object|null>} opciones.mutacion Devuelve la cuenta confirmada, o null si la sesión
 *   guardada cambió mientras tanto (por ejemplo, otra pestaña inició otra).
 * @param {() => number} opciones.revision Revisión de la sesión mostrada; cambia al expirar, cerrar o iniciar otra.
 * @param {(cuenta: object) => void} opciones.publicar Muestra la cuenta confirmada.
 * @param {() => Promise<unknown>} opciones.releer Vuelve a leer y mostrar la sesión guardada.
 * @returns {Promise<object|null>} La cuenta mostrada, o null si la confirmación llegó tarde.
 */
export async function aplicarConfirmacion({ mutacion, revision, publicar, releer }) {
  const alEmpezar = revision()
  const confirmada = await mutacion()
  // La sesión de esta pestaña expiró, se cerró o se reemplazó mientras tanto: ya se muestra la vigente
  if (alEmpezar !== revision()) return null
  // La sesión guardada cambió desde otra pestaña: se muestra esa, no la cuenta de esta respuesta
  if (!confirmada) {
    await releer()
    return null
  }
  publicar(confirmada)
  return confirmada
}
