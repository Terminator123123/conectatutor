/**
 * Catálogo académico real de Uniguajira: programas y materias de los primeros semestres de cada plan de
 * estudios. No tiene cuentas ni datos personales, así que se puede cargar en producción con
 * `npm run cargar-catalogo` (ver README, «Catálogo académico inicial»). La semilla de demostración usa el mismo.
 */

/** Programas. Fuente: uniguajira.edu.co/ofertas-academicas (consultado el 2026-10-29). */
export const PROGRAMAS = [
  { nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de Ingeniería' },
  { nombre: 'Administración de Empresas', facultad: 'Facultad de Ciencias Económicas y Administrativas' },
  { nombre: 'Biología', facultad: 'Facultad de Ciencias Básicas y Aplicadas' },
  { nombre: 'Psicología', facultad: 'Facultad de Ciencias Sociales y Humanas' },
]

/** Materias. El código es interno de la aplicación: el plan de estudios no publica códigos. */
export const MATERIAS = [
  { codigo: 'SIS-01', nombre: 'Cálculo Diferencial', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-02', nombre: 'Lógica y Teoría de Conjuntos', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-03', nombre: 'Introducción a la Ingeniería de Sistemas', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-04', nombre: 'Algoritmo y Programación I', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-05', nombre: 'Cálculo Integral', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-06', nombre: 'Álgebra Lineal', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-07', nombre: 'Algoritmo y Programación II', programa: 'Ingeniería de Sistemas' },
  { codigo: 'SIS-08', nombre: 'Estructura de Datos I', programa: 'Ingeniería de Sistemas' },
  { codigo: 'ADM-01', nombre: 'Fundamentos de Matemáticas', programa: 'Administración de Empresas' },
  { codigo: 'ADM-02', nombre: 'Fundamentos de Administración', programa: 'Administración de Empresas' },
  { codigo: 'ADM-03', nombre: 'Fundamentos en Economía', programa: 'Administración de Empresas' },
  { codigo: 'ADM-04', nombre: 'Contabilidad Financiera', programa: 'Administración de Empresas' },
  { codigo: 'ADM-05', nombre: 'Cálculo Diferencial', programa: 'Administración de Empresas' },
  { codigo: 'ADM-06', nombre: 'Procesos Administrativos I', programa: 'Administración de Empresas' },
  { codigo: 'ADM-07', nombre: 'Microeconomía', programa: 'Administración de Empresas' },
  { codigo: 'ADM-08', nombre: 'Contabilidad de Costos', programa: 'Administración de Empresas' },
  { codigo: 'BIO-01', nombre: 'Biología General', programa: 'Biología' },
  { codigo: 'BIO-02', nombre: 'Lab. Biología General', programa: 'Biología' },
  { codigo: 'BIO-03', nombre: 'Fundamentos de Matemáticas', programa: 'Biología' },
  { codigo: 'BIO-04', nombre: 'Fundamentos de Química', programa: 'Biología' },
  { codigo: 'BIO-05', nombre: 'Biología Celular', programa: 'Biología' },
  { codigo: 'BIO-06', nombre: 'Biofísica I', programa: 'Biología' },
  { codigo: 'BIO-07', nombre: 'Cálculo I', programa: 'Biología' },
  { codigo: 'BIO-08', nombre: 'Química Inorgánica', programa: 'Biología' },
  { codigo: 'PSI-01', nombre: 'Psicobiología', programa: 'Psicología' },
  { codigo: 'PSI-02', nombre: 'Antropología Social', programa: 'Psicología' },
  { codigo: 'PSI-03', nombre: 'Historia y Fundamentos de la Psicología', programa: 'Psicología' },
  { codigo: 'PSI-04', nombre: 'Percepción y Atención', programa: 'Psicología' },
  { codigo: 'PSI-05', nombre: 'Competencias Comunicativas', programa: 'Psicología' },
  { codigo: 'PSI-06', nombre: 'Desarrollo Personal', programa: 'Psicología' },
  { codigo: 'PSI-07', nombre: 'Psicofisiología', programa: 'Psicología' },
  { codigo: 'PSI-08', nombre: 'Epistemología de las Ciencias Sociales', programa: 'Psicología' },
]
