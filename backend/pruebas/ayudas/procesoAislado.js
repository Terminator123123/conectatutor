import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const requerir = createRequire(import.meta.url)
const RAIZ_BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Ejecuta un programa ESM en un proceso aparte con configuración solo sintética:
 * no hereda el entorno del desarrollador y corre desde una carpeta vacía, así dotenv no encuentra ningún .env.
 * El programa recibe en RAIZ_BACKEND la URL (con barra final) de la carpeta backend y en SUPERTEST la URL del módulo supertest.
 */
export function ejecutarAislado(programa, entorno) {
  const carpeta = mkdtempSync(path.join(tmpdir(), 'conectatutor-aislado-'))
  try {
    return spawnSync(process.execPath, ['--input-type=module', '-e', programa], {
      cwd: carpeta,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        JWT_SECRETO: 'secreto-sintetico-de-prueba-xxxxxxxxxxxx',
        CORS_ORIGIN: 'https://frontend.example.test',
        SUPERTEST: pathToFileURL(requerir.resolve('supertest')).href,
        RAIZ_BACKEND: `${pathToFileURL(RAIZ_BACKEND).href}/`,
        ...entorno,
      },
    })
  } finally {
    rmSync(carpeta, { recursive: true, force: true })
  }
}
