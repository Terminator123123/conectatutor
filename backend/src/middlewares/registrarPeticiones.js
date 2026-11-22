import { env } from '../config/env.js'
import { Usuario } from '../models/index.js'

// Acciones reconocibles, para leer el registro en vivo sin descifrar rutas.
const ACCIONES = [
  ['POST', /^\/api\/auth\/ingreso$/, 'intentó iniciar sesión'],
  ['POST', /^\/api\/auth\/salida$/, 'cerró sesión'],
  ['POST', /^\/api\/auth\/yo\/primer-acceso$/, 'activó su cuenta'],
  ['POST', /^\/api\/auth\/recuperacion$/, 'pidió recuperar su contraseña'],
  ['PUT', /^\/api\/auth\/yo\/clave$/, 'cambió su contraseña'],
  ['PUT', /^\/api\/auth\/yo\/foto$/, 'cambió su foto'],
  ['GET', /^\/api\/tutores$/, 'buscó tutores'],
  ['GET', /^\/api\/tutores\/[^/]+$/, 'abrió el perfil de un tutor'],
  ['POST', /^\/api\/sesiones$/, 'solicitó una tutoría'],
  ['PATCH', /^\/api\/sesiones\/[^/]+\/confirmar$/, 'aceptó una solicitud'],
  ['PATCH', /^\/api\/sesiones\/[^/]+\/rechazar$/, 'rechazó una solicitud'],
  ['PATCH', /^\/api\/sesiones\/[^/]+\/cancelar$/, 'canceló una tutoría'],
  ['PATCH', /^\/api\/sesiones\/[^/]+\/finalizar$/, 'marcó una tutoría como finalizada'],
  ['POST', /^\/api\/sesiones\/[^/]+\/calificacion$/, 'calificó una tutoría'],
  ['PUT', /^\/api\/sesiones\/[^/]+\/reprogramacion$/, 'propuso otra fecha'],
  ['GET', /^\/api\/notificaciones$/, 'revisó sus notificaciones'],
  ['POST', /^\/api\/favoritos/, 'guardó un favorito'],
  ['DELETE', /^\/api\/favoritos/, 'quitó un favorito'],
  ['POST', /^\/api\/coordinacion\/cuentas$/, 'creó una cuenta de estudiante'],
  ['PATCH', /^\/api\/coordinacion\/perfiles\/[^/]+\/verificar$/, 'verificó a un tutor'],
]

/**
 * Dirección del equipo que hizo la petición. En Render la petición pasa por varios proxies y `req.ip`
 * queda con una dirección interna (10.x): para el registro se toma la que pone Cloudflare o, si no
 * viene, la primera de X-Forwarded-For. Solo se usa para leer el registro, nunca para decidir permisos.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function origenDe(req) {
  const cloudflare = String(req.get('cf-connecting-ip') ?? '').trim()
  const reenviado = String(req.get('x-forwarded-for') ?? '').split(',')[0].trim()
  return (cloudflare || reenviado || req.ip || '').replace(/^::ffff:/, '')
}

/**
 * Navegador y sistema en pocas palabras, a partir del User-Agent. Brave se presenta como Chrome.
 * @param {string} [agente]
 * @returns {string}
 */
export function dispositivoDe(agente = '') {
  const navegador = /Edg\//.test(agente) ? 'Edge'
    : /OPR\//.test(agente) ? 'Opera'
      : /Firefox\//.test(agente) ? 'Firefox'
        : /Chrome\//.test(agente) ? 'Chrome'
          : /Safari\//.test(agente) ? 'Safari'
            : /PostmanRuntime/.test(agente) ? 'Postman'
              : agente ? 'otro' : 'sin navegador'
  const sistema = /Android/.test(agente) ? 'Android'
    : /iPhone|iPad/.test(agente) ? 'iOS'
      : /Windows/.test(agente) ? 'Windows'
        : /Mac OS X/.test(agente) ? 'macOS'
          : /Linux/.test(agente) ? 'Linux' : ''
  return sistema ? `${navegador}/${sistema}` : navegador
}

/** Seis primeros caracteres de una sesión: bastan para seguirla en el registro sin exponerla completa. */
const corta = (sesion) => (typeof sesion === 'string' && sesion ? sesion.replace(/^cerrada:/, '').slice(0, 6) : '-')

const RUTA_INGRESO = /^\/api\/auth\/ingreso$/

/**
 * Detalle de acceso para el registro: con qué correo se intentó entrar, qué sesión se abrió o
 * por qué se rechazó un token, para poder seguir quién entra, quién sale y quién queda por fuera.
 * @returns {Promise<string>}
 */
async function detalleAcceso(req, res, ruta) {
  if (req.method === 'POST' && RUTA_INGRESO.test(ruta)) {
    const correo = typeof req.body?.correoInstitucional === 'string' ? req.body.correoInstitucional.trim().toLowerCase() : '?'
    return res.statusCode === 200 ? ` [cuenta ${correo}, sesión nueva ${corta(res.locals.sesionNueva)}]` : ` [cuenta ${correo}, ingreso rechazado]`
  }
  if (req.usuario) return ` [sesión ${corta(req.sesionId)}]`
  const rechazo = req.rechazo
  if (!rechazo) return ''
  let correo = rechazo.cuenta?.correoInstitucional
  if (!correo && rechazo.sub) {
    try {
      correo = (await Usuario.findById(rechazo.sub).select('correoInstitucional').lean())?.correoInstitucional
    } catch { /* el registro no debe fallar por esta consulta */ }
  }
  const activa = rechazo.activa ? `, la activa es ${corta(rechazo.activa)}` : ''
  return ` [rechazo: ${rechazo.motivo}; cuenta ${correo ?? '?'}, sesión ${corta(rechazo.sesion)}${activa}]`
}

/**
 * Muestra en consola cada petición: hora, equipo, navegador, quién (nombre, correo y rol si tiene sesión),
 * qué hizo, código de respuesta, duración y, en los accesos, la sesión y el motivo de un rechazo.
 * Nunca registra el cuerpo (salvo el correo del ingreso) ni los encabezados: ahí viajan contraseñas y tokens.
 */
export function registrarPeticiones(req, res, next) {
  if (env.esPrueba) {
    next()
    return
  }
  const inicio = process.hrtime.bigint()
  res.on('finish', async () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6
    // Solo la ruta, sin la cadena de consulta, para no dejar datos personales en el registro.
    const ruta = req.originalUrl.split('?')[0]
    if (req.method === 'OPTIONS') return // las consultas previas de CORS no dicen nada de quién usa la app
    if (ruta === '/api/salud' && res.statusCode === 200) return // Render la consulta cada pocos segundos
    const hora = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' })
    const quien = req.usuario
      ? `${req.usuario.nombre.split(' ')[0]} <${req.usuario.correoInstitucional}> (${req.usuario.tipo.toLowerCase()})`
      : 'invitado'
    const accion = ACCIONES.find(([metodo, patron]) => metodo === req.method && patron.test(ruta))?.[2]
    const detalle = await detalleAcceso(req, res, ruta)
    console.log(`[API] ${hora} ${origenDe(req)} ${dispositivoDe(req.get('user-agent'))} ${quien} · ${req.method} ${ruta} -> ${res.statusCode} (${ms.toFixed(0)} ms)${accion ? ` · ${accion}` : ''}${detalle}`)
  })
  next()
}
