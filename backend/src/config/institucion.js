/**
 * Datos institucionales que usa la API. Coinciden con los del frontend
 * (frontend/src/config/institucion.js), que es donde se documenta su fuente.
 */
export const INSTITUCION = Object.freeze({
  nombre: 'Universidad de La Guajira',
  nombreApp: 'ConectaTutor Uniguajira',
  dominioCorreo: 'uniguajira.edu.co',
  sedes: Object.freeze(['Riohacha', 'Maicao', 'Villanueva', 'Fonseca']),
  // PROPUESTA: pendiente de confirmar con Uniguajira.
  dependenciaVerificadora: 'Bienestar Social Universitario · Área de Permanencia y Graduación Exitosa',
  semestreMaximo: 10,
})
