import { pathToFileURL } from 'node:url'
import { leerRespaldo } from '../services/respaldo.service.js'

/**
 * Comprueba un respaldo sin conectarse a ninguna base: manifiesto, un archivo legible por colección y el
 * mismo número de documentos que anota el manifiesto.
 * Uso desde backend/: npm run verificar-respaldo -- respaldos/respaldo-AAAA-MM-DDTHH-MM-SSZ
 * @returns {Promise<number>} Código de salida: 0 si el respaldo está completo; 1 si no.
 */
export async function ejecutar({ argumentos = process.argv.slice(2), leer = leerRespaldo, registro = console } = {}) {
  const [carpeta] = argumentos
  if (!carpeta) {
    registro.error('[Respaldo] Indica la carpeta del respaldo: npm run verificar-respaldo -- <carpeta>')
    return 1
  }
  try {
    const { manifiesto, documentos } = await leer(carpeta)
    registro.log(`[Respaldo] Completo: base «${manifiesto.baseDeDatos}», hecho el ${manifiesto.fecha}`)
    for (const [nombre, lista] of Object.entries(documentos)) registro.log(`[Respaldo]   ${nombre}: ${lista.length}`)
    return 0
  } catch (error) {
    registro.error('[Respaldo] El respaldo no está completo:', error.message)
    return 1
  }
}

// Solo corre al ejecutar `npm run verificar-respaldo`, no al importarlo desde las pruebas
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await ejecutar()
