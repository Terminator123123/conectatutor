import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba } from './base.js'

import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { createServer } from '../../../frontend/node_modules/vite/dist/node/index.js'
import { app } from '../../src/app.js'
import { cargarSemilla } from '../../src/services/semilla.service.js'

const raizFrontend = fileURLToPath(new URL('../../../frontend/', import.meta.url))
let api = null
let vite = null
let arranque = null
let cierre = null
let detenerSolicitado = false
let control = null
let colaComandos = Promise.resolve()
let cierreApi = null

async function cerrarApi() {
  if (cierreApi) return cierreApi
  if (!api?.listening) return
  const servidor = api
  cierreApi = new Promise((resolver, rechazar) => {
    servidor.close((error) => error ? rechazar(error) : resolver())
    servidor.closeAllConnections()
  })
  try {
    await cierreApi
  } finally {
    cierreApi = null
  }
}

async function iniciarApi() {
  if (cierreApi) await cierreApi
  if (detenerSolicitado || api?.listening) return
  api = app.listen(3000, 'localhost')
  await once(api, 'listening')
}

async function apagar(codigo = 0) {
  detenerSolicitado = true
  control?.close()
  process.stdin.pause()
  if (codigo !== 0) process.exitCode = codigo
  if (cierre) return cierre
  cierre = (async () => {
    await arranque?.catch(() => {})
    const resultados = await Promise.allSettled([cerrarApi(), vite?.close()])
    try {
      await detenerBaseDePrueba()
    } catch {
      process.exitCode = 1
    }
    if (resultados.some((resultado) => resultado.status === 'rejected')) process.exitCode = 1
  })()
  return cierre
}

async function ejecutarComando(comando) {
  if (detenerSolicitado) return
  if (comando === 'api apagar') {
    await cerrarApi()
    console.log('API APAGADA')
  } else if (comando === 'api iniciar') {
    await iniciarApi()
    if (!detenerSolicitado) console.log('API LISTA')
  } else if (comando === 'salir') {
    await apagar()
  } else {
    console.error('ERROR: comando de control no reconocido')
  }
}

function iniciarControl() {
  control = createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity })
  control.on('line', (comando) => {
    colaComandos = colaComandos.then(() => ejecutarComando(comando)).catch((error) => {
      const motivo = error?.code === 'EADDRINUSE' ? ': puerto API ocupado' : ''
      console.error(`ERROR: no se pudo ejecutar el comando de control${motivo}`)
    })
  })
}

async function iniciar() {
  await iniciarBaseDePrueba()
  if (detenerSolicitado) return
  const conexion = mongoose.connection
  if (!['127.0.0.1', '::1', 'localhost'].includes(conexion.host)
    || conexion.name !== 'conectatutor_pruebas' || conexion.readyState !== 1) {
    throw new Error('La base temporal no cumple el aislamiento de las pruebas')
  }
  await cargarSemilla(CLAVE_DE_PRUEBA)
  if (detenerSolicitado) return
  await iniciarApi()
  if (detenerSolicitado) return
  vite = await createServer({
    root: raizFrontend,
    configFile: fileURLToPath(new URL('../../../frontend/vite.config.js', import.meta.url)),
    envDir: false,
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:3000/api') },
    logLevel: 'silent',
    clearScreen: false,
    server: { host: 'localhost', port: 5173, strictPort: true, open: false },
  })
  if (detenerSolicitado) return
  await vite.listen()
  if (detenerSolicitado) return
  console.log('READY')
  console.log('API: http://localhost:3000/api')
  console.log('Interfaz: http://localhost:5173')
  iniciarControl()
}

process.once('SIGINT', () => { void apagar() })
process.once('SIGTERM', () => { void apagar() })

try {
  arranque = iniciar()
  await arranque
} catch (error) {
  const motivo = error?.code === 'EADDRINUSE' ? ': puerto ocupado' : ''
  console.error(`ERROR: no se pudo iniciar el servidor temporal de interfaz${motivo}`)
  await apagar(1)
}
