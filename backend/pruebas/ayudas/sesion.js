import request from 'supertest'
import { app } from '../../src/app.js'
import { firmarToken } from '../../src/services/auth.service.js'
import { Usuario } from '../../src/models/index.js'

const DOMINIO = 'uniguajira.edu.co'

/** Correos de las cuentas de demostración que carga el seed. */
export const CORREOS = Object.freeze({
  andrea: `andrea.salcedo@${DOMINIO}`, // tutora verificada, con tarifa
  bruno: `bruno.valdes@${DOMINIO}`, // tutor verificado, gratuito
  carolina: `carolina.rueda@${DOMINIO}`, // tutora verificada, con una calificación de 5
  diego: `diego.manrique@${DOMINIO}`, // perfil de tutor PENDIENTE
  elena: `elena.lozano@${DOMINIO}`, // estudiante sin perfil de tutor
  felipe: `felipe.castano@${DOMINIO}`, // estudiante sin perfil de tutor
  administrador: `gabriela.montes@${DOMINIO}`,
})

/**
 * Devuelve el encabezado Authorization de una cuenta de demostración.
 * Firma el token directamente (sin pasar por /ingreso) para que las pruebas sean rápidas.
 * @param {string} correo
 */
export async function encabezadoDe(correo) {
  const usuario = await Usuario.findOne({ correoInstitucional: correo })
  return { Authorization: `Bearer ${firmarToken(usuario)}` }
}

/** Cliente de la API con la sesión de una cuenta: api.get('/ruta'), api.post('/ruta', cuerpo)... */
export async function clienteDe(correo) {
  const encabezado = correo ? await encabezadoDe(correo) : {}
  const pedir = (metodo) => (ruta, cuerpo) => {
    const peticion = request(app)[metodo](`/api${ruta}`).set(encabezado)
    return cuerpo === undefined ? peticion : peticion.send(cuerpo)
  }
  return { get: pedir('get'), post: pedir('post'), put: pedir('put'), patch: pedir('patch'), delete: pedir('delete') }
}
