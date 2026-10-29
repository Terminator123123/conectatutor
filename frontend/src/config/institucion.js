/**
 * Datos institucionales. ÚNICA fuente de nombre, dominio, colores y logo.
 * Valores marcados TEMPORAL o PENDIENTE UNIGUAJIRA se reemplazan con la carpeta "2 Uniguajira".
 */
export const INSTITUCION = Object.freeze({
  nombre: 'Universidad de La Guajira',
  nombreCorto: 'Uniguajira',
  nombreApp: 'ConectaTutor Uniguajira',
  dominioCorreo: 'uniguajira.edu.co',            // PENDIENTE UNIGUAJIRA: confirmar
  sedes: ['PENDIENTE UNIGUAJIRA'],
  dependenciaVerificadora: 'PENDIENTE UNIGUAJIRA',
  tutoriasGratuitas: null,                      // PENDIENTE UNIGUAJIRA: true | false
  urlTratamientoDatos: '#',                     // PENDIENTE UNIGUAJIRA
  logo: null,                                   // PENDIENTE UNIGUAJIRA: ruta en /public
  colores: Object.freeze({                      // TEMPORAL (paleta de la Entrega 1)
    primario: '#0F4C5C',
    primarioClaro: '#1B6E80',
    acento: '#9E2A2B',
    exito: '#2E7D5B',
    advertencia: '#8A6400',
    error: '#B3261E',
    texto: '#111827',
    textoSecundario: '#6B7280',
    borde: '#E5E7EB',
    fondo: '#F9FAFB',
    superficie: '#FFFFFF',
  }),
  tipografia: "'Inter', system-ui, sans-serif", // TEMPORAL
});
