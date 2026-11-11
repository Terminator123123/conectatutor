/**
 * Define cómo se convierte un documento de Mongoose en la respuesta JSON de la API:
 * expone `id` en lugar de `_id`, quita `__v` y elimina los campos que nunca deben salir.
 * @param {import('mongoose').Schema} esquema Esquema al que se le aplica.
 * @param {string[]} [camposOcultos] Campos que no se envían al cliente.
 */
export function aplicarSalidaJson(esquema, camposOcultos = []) {
  esquema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_documento, salida) {
      if (salida._id !== undefined) {
        salida.id = String(salida._id)
        delete salida._id
      }
      for (const campo of camposOcultos) delete salida[campo]
      return salida
    },
  })
}
