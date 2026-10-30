// Calcula cifras agregadas por sede y las convierte a CSV sin datos personales.
import { EstadoSesion, EstadoVerificacion } from '../modelo/enums.js'

const columnas = ['solicitudes', 'pendientes', 'confirmadas', 'finalizadas', 'rechazadas', 'canceladas',
  'estudiantesAtendidos', 'tutoresVerificados', 'tutoresPendientes', 'calificacionPromedio']
export const ENCABEZADO_CSV = 'Sede;Solicitudes;Pendientes;Confirmadas;Finalizadas;Rechazadas;Canceladas;Estudiantes atendidos;Tutores verificados;Tutores pendientes;Calificación promedio'

/** @returns {object} Acumuladores privados para una fila. */
function crearFila() {
  return { solicitudes: 0, pendientes: 0, confirmadas: 0, finalizadas: 0, rechazadas: 0, canceladas: 0,
    estudiantesAtendidos: 0, tutoresVerificados: 0, tutoresPendientes: 0, calificacionPromedio: null,
    atendidos: new Set(), puntajes: [] }
}

/**
 * Cuenta sesiones, estudiantes únicos, perfiles y calificaciones por sede y en total.
 * @param {import('../modelo/Sesion.js').default[]} sesiones Sesiones del conjunto.
 * @param {import('../modelo/PerfilTutor.js').default[]} perfiles Perfiles del conjunto.
 * @param {string[]} sedes Sedes que deben aparecer, incluso sin actividad.
 * @returns {{porSede: Object<string, object>, total: object}} Filas agregadas sin identificadores.
 */
export function calcularMetricas(sesiones, perfiles, sedes) {
  const porSede = Object.fromEntries(sedes.map((sede) => [sede, crearFila()]))
  const total = crearFila()
  const estados = { [EstadoSesion.PENDIENTE]: 'pendientes', [EstadoSesion.CONFIRMADA]: 'confirmadas',
    [EstadoSesion.FINALIZADA]: 'finalizadas', [EstadoSesion.RECHAZADA]: 'rechazadas', [EstadoSesion.CANCELADA]: 'canceladas' }
  for (const sesion of sesiones) {
    for (const fila of [total, porSede[sesion.getSolicitante().getSede()]].filter(Boolean)) {
      fila.solicitudes += 1
      fila[estados[sesion.getEstado()]] += 1
      if (sesion.getEstado() === EstadoSesion.FINALIZADA) fila.atendidos.add(sesion.getSolicitante().getId())
      if (sesion.getCalificacion()) fila.puntajes.push(sesion.getCalificacion().getPuntaje())
    }
  }
  for (const perfil of perfiles) {
    for (const fila of [total, porSede[perfil.getEstudiante().getSede()]].filter(Boolean)) {
      if (perfil.getEstadoVerificacion() === EstadoVerificacion.VERIFICADO) fila.tutoresVerificados += 1
      if (perfil.getEstadoVerificacion() === EstadoVerificacion.PENDIENTE) fila.tutoresPendientes += 1
    }
  }
  for (const fila of [total, ...Object.values(porSede)]) {
    fila.estudiantesAtendidos = fila.atendidos.size
    fila.calificacionPromedio = fila.puntajes.length
      ? Math.round(fila.puntajes.reduce((suma, puntaje) => suma + puntaje, 0) / fila.puntajes.length * 10) / 10 : null
    delete fila.atendidos
    delete fila.puntajes
  }
  return { porSede, total }
}

/**
 * Exporta las filas en orden institucional, con BOM, separadores y decimales para Excel.
 * @param {{porSede: Object<string, object>, total: object}} metricas Cifras calculadas.
 * @param {string[]} sedes Orden de las sedes en el archivo.
 * @returns {string} CSV con saltos CRLF y una última fila Total.
 */
export function metricasACsv(metricas, sedes) {
  const escapar = (valor) => /[;"\r\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
  const fila = (sede, valores) => [escapar(sede), ...columnas.map((clave) => clave === 'calificacionPromedio'
    ? (valores[clave] === null ? '' : valores[clave].toFixed(1).replace('.', ',')) : valores[clave])].join(';')
  return '\uFEFF' + [ENCABEZADO_CSV, ...sedes.map((sede) => fila(sede, metricas.porSede[sede])), fila('Total', metricas.total)].join('\r\n')
}
