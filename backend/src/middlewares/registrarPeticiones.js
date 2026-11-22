import { env } from '../config/env.js'

// Acciones reconocibles, para leer el registro en vivo sin descifrar rutas.
const ACCIONES = [
  ['POST', /^\/api\/auth\/ingreso$/, 'inició sesión'],
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

/** Dirección del equipo que hizo la petición; detrás del proxy de Vite viene en X-Forwarded-For. */
function origenDe(req) {
  const reenviado = env.esProduccion ? '' : String(req.get('x-forwarded-for') ?? '').split(',')[0].trim()
  return (reenviado || req.ip || '').replace(/^::ffff:/, '')
}

/**
 * Muestra en consola cada petición: hora, equipo, quién (nombre y rol si tiene sesión),
 * qué hizo, código de respuesta y duración.
 * Nunca registra el cuerpo ni los encabezados: ahí viajan contraseñas y tokens.
 */
export function registrarPeticiones(req, res, next) {
  if (env.esPrueba) {
    next()
    return
  }
  const inicio = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6
    // Solo la ruta, sin la cadena de consulta, para no dejar datos personales en el registro.
    const ruta = req.originalUrl.split('?')[0]
    const hora = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' })
    const quien = req.usuario ? `${req.usuario.nombre.split(' ')[0]} (${req.usuario.tipo.toLowerCase()})` : 'invitado'
    const accion = ACCIONES.find(([metodo, patron]) => metodo === req.method && patron.test(ruta))?.[2]
    console.log(`[API] ${hora} ${origenDe(req)} ${quien} · ${req.method} ${ruta} -> ${res.statusCode} (${ms.toFixed(0)} ms)${accion ? ` · ${accion}` : ''}`)
  })
  next()
}
