// Razones de la encuesta de cancelación. Son las mismas claves y textos del backend (utils/enums.js).
export const MOTIVOS_CANCELACION = Object.freeze({
  CRUCE_HORARIO: 'Tengo un cruce de horario',
  YA_RESOLVI: 'Ya resolví la duda',
  SALUD_PERSONAL: 'Motivos de salud o personales',
  TRANSPORTE_CONEXION: 'Problemas de transporte o de conexión',
  SIN_RESPUESTA: 'La otra persona no respondió',
  OTRO: 'Otro',
})

/**
 * Revisa la encuesta: al menos una razón y, con «Otro», una explicación de 5 caracteres o más.
 * @param {{motivos: string[], otro: string}} encuesta Respuestas marcadas.
 * @returns {string} Problema a mostrar, o '' si está completa.
 */
export function revisarEncuesta({ motivos, otro }) {
  if (!motivos.length) return 'Marca al menos una razón.'
  if (motivos.includes('OTRO') && otro.trim().length < 5) return 'Cuéntanos la otra razón (al menos 5 caracteres).'
  return ''
}

/** Texto que verá la otra parte; el servidor lo arma igual. */
export function textoEncuesta({ motivos, otro }) {
  const partes = motivos.filter((clave) => clave !== 'OTRO').map((clave) => MOTIVOS_CANCELACION[clave])
  if (motivos.includes('OTRO') && otro.trim()) partes.push(otro.trim())
  return partes.join('. ').slice(0, 300)
}
