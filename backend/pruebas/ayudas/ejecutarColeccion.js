import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, Script } from 'node:vm'

function ejecutarEventos(eventos, tipo, pm) {
  for (const evento of eventos ?? []) {
    if (evento.listen !== tipo) continue
    const contexto = createContext({ pm }, { codeGeneration: { strings: false, wasm: false } })
    new Script(evento.script.exec.join('\n'), { filename: `coleccion-${tipo}.js` }).runInContext(contexto, { timeout: 1000 })
  }
}

export async function ejecutarColeccion(urlBase, alVerificar = () => {}, antesDeCaso = async () => {}) {
  const base = new URL(urlBase)
  assert.ok(base.protocol === 'http:' && base.hostname === 'localhost' && Number(base.port) > 0
    && base.pathname === '/api' && !base.search && !base.hash && !base.username && !base.password,
  'La colección exige una API de prueba en localhost con puerto explícito y ruta /api')
  const coleccion = JSON.parse(await readFile(new URL('../Coleccion ConectaTutor.json', import.meta.url), 'utf8'))
  const variables = new Map(coleccion.variable.map(({ key, value }) => [key, value]))
  variables.set('baseUrl', urlBase)
  const resultados = []

  const interpolar = texto => texto.replace(/\{\{([^}]+)\}\}/g, (_, clave) => {
    assert.ok(variables.has(clave), `Variable sin preparar: ${clave}`)
    return String(variables.get(clave))
  })

  try {
    for (const grupo of coleccion.item) {
      for (const item of grupo.item) {
        const pruebas = []
        const pm = {
          collectionVariables: { get: clave => variables.get(clave), set: (clave, valor) => variables.set(clave, valor), unset: clave => variables.delete(clave) },
          variables: { replaceIn: interpolar },
          request: { url: { toString: () => item.request.url } },
          test: (nombre, verificar) => {
            try { verificar(); pruebas.push({ nombre, cumple: true }) }
            catch (error) { pruebas.push({ nombre, cumple: false, error: error.message }) }
          },
        }
        await antesDeCaso(item.name, variables)
        ejecutarEventos(coleccion.event, 'prerequest', pm)
        ejecutarEventos(item.event, 'prerequest', pm)
        const destino = new URL(interpolar(item.request.url))
        assert.ok(destino.origin === base.origin && destino.pathname.startsWith('/api/'), 'Petición fuera de la API temporal')
        const respuesta = await fetch(destino, {
          method: item.request.method,
          headers: Object.fromEntries(item.request.header.map(({ key, value }) => [key, interpolar(value)])),
          ...(item.request.body ? { body: interpolar(item.request.body.raw) } : {}),
          signal: AbortSignal.timeout(10000), redirect: 'error',
        })
        const cuerpo = await respuesta.text()
        pm.response = { code: respuesta.status, json: () => JSON.parse(cuerpo) }
        ejecutarEventos(item.event, 'test', pm)
        const resultado = { caso: item.name, metodo: item.request.method, ruta: destino.pathname + destino.search, http: respuesta.status, pruebas }
        resultados.push(resultado)
        alVerificar(resultado)
        assert.ok(pruebas.length > 0 && pruebas.every(prueba => prueba.cumple),
          `${item.name}: ${pruebas.filter(prueba => !prueba.cumple).map(prueba => prueba.error).join('; ')}`)
      }
    }
    return resultados
  } finally {
    // Los JWT de la fixture solo viven durante esta ejecución y no forman parte del resultado
    variables.clear()
  }
}
