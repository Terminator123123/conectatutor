/**
 * Datos institucionales oficiales (extraídos de uniguajira.edu.co el 2026-10-29).
 * ÚNICA fuente de nombre, dominio, colores, logos y tipografía.
 * Lo marcado PROPUESTA o PENDIENTE UNIGUAJIRA falta por confirmar.
 */
export const INSTITUCION = Object.freeze({
  nombre: 'Universidad de La Guajira',
  nombreCorto: 'Uniguajira',
  nombreApp: 'ConectaTutor Uniguajira',
  dominioCorreo: 'uniguajira.edu.co',            // Oficial: uniguajira.edu.co/estudiantes → correo institucional
  sedes: Object.freeze(['Riohacha', 'Maicao', 'Villanueva', 'Fonseca']),
  canalesPermanencia: Object.freeze({            // Oficial: "Agenda tu tutoría", 14/09/2026
    Riohacha: 'areapermanencia@uniguajira.edu.co',
    Maicao: 'permanenciamaicao@uniguajira.edu.co',
    Villanueva: 'permanenciaygraduacion@uniguajira.edu.co',
    Fonseca: 'permanenciaygraduacionfonseca@uniguajira.edu.co',
  }),
  dependenciaVerificadora: 'Bienestar Social Universitario · Área de Permanencia y Graduación Exitosa', // PROPUESTA: confirmar (Reglamento, Acuerdo 026 de 2018, arts. 116 y 120)
  tutoriasGratuitas: null,                       // PENDIENTE UNIGUAJIRA: true | false
  urlTratamientoDatos: 'https://uniguajira.edu.co/actualidad/acuerdo-no-010-de-2018/',
  logos: Object.freeze({
    horizontal: '/logos/logo-horizontal.webp',   // Texto blanco: solo sobre fondo primario
    vertical: '/logos/logo-vertical.webp',       // A todo color: sobre fondos claros
    favicon: '/favicon.png',
  }),
  colores: Object.freeze({                       // Ver "3 Diseno (Claude)/Design system Uniguajira.md"
    primario: '#01616C',
    primarioOscuro: '#054F59',
    primarioSuave: '#E8F4F6',
    marca: '#62A7B4',                            // Azul Mar del manual: solo decorativo
    acento: '#B54F43',
    exito: '#2E7D5B',
    advertencia: '#8A6400',
    error: '#B3261E',
    texto: '#03090F',
    textoSecundario: '#4A5560',
    borde: '#DCECEF',
    fondo: '#F9FAFB',
    superficie: '#FFFFFF',
    estrella: '#B8860B',
  }),
  tipografia: "'Montserrat', system-ui, sans-serif",
  tipografiaTitulos: "'Roboto', system-ui, sans-serif",
  urlFuentes: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Roboto:wght@600;700&display=swap',
});
