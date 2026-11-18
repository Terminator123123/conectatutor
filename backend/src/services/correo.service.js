import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

/** Correos "enviados" durante las pruebas automáticas; no salen a internet. */
export const bandejaDePrueba = []

let transporte = null

function obtenerTransporte() {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.correo.usuario, pass: env.correo.claveApp },
    })
  }
  return transporte
}

/** Indica si hay una cuenta de correo configurada para enviar de verdad. */
export function correoConfigurado(config = env) {
  return Boolean(config.correo.usuario && config.correo.claveApp)
}

/**
 * Indica si un correo pedido llegará a alguna parte: en pruebas va a la bandeja interna y en
 * desarrollo a la consola. En producción hace falta una cuenta configurada; si no la hay, los
 * enlaces no se generan ni se escriben en el registro.
 */
export function correoDisponible(config = env) {
  return config.esPrueba || correoConfigurado(config) || !config.esProduccion
}

/**
 * Envía un correo. En pruebas lo guarda en `bandejaDePrueba`; sin cuenta configurada
 * lo escribe en la consola para poder seguir el flujo en desarrollo.
 * @param {{para: string, asunto: string, texto: string, html: string}} mensaje
 */
export async function enviarCorreo({ para, asunto, texto, html }) {
  if (env.esPrueba) {
    bandejaDePrueba.push({ para, asunto, texto, html })
    return
  }
  const destino = env.correo.desvio || para
  const aviso = env.correo.desvio ? `[Demostración: destinatario original ${para}]\n\n` : ''
  if (!correoConfigurado()) {
    if (env.esProduccion) throw new Error('Correo sin configurar en producción')
    console.info(`[Correo] Sin cuenta configurada. Para: ${destino}\nAsunto: ${asunto}\n${aviso}${texto}`)
    return
  }
  await obtenerTransporte().sendMail({
    from: { name: env.correo.remitente, address: env.correo.usuario },
    to: destino,
    subject: asunto,
    text: aviso + texto,
    html: (env.correo.desvio ? `<p style="color:#666">Demostración: destinatario original ${para}</p>` : '') + html,
  })
}
