import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../src/app.js'

// Comprueba que lo que la API responde de verdad cumple lo que promete Swagger.

/**
 * Compara un valor con un esquema OpenAPI sencillo: tipos, propiedades, enum, $ref y allOf.
 * También avisa de las propiedades que llegan y no están documentadas.
 * @returns {string[]} Lista de incumplimientos; vacía si el valor cumple.
 */
export function incumplimientos(valor, esquema, componentes, ruta = 'respuesta', esParte = false) {
  if (esquema.$ref) return incumplimientos(valor, componentes[esquema.$ref.split('/').pop()], componentes, ruta, esParte)
  if (valor === null) return esquema.nullable ? [] : [`${ruta}: no admite null`]
  // Cada parte de un allOf se revisa por separado; las propiedades sin documentar se
  // buscan una sola vez, contra la suma de todas las partes.
  const fallos = (esquema.allOf ?? []).flatMap((parte) => incumplimientos(valor, parte, componentes, ruta, true))
  const tipo = Array.isArray(valor) ? 'array' : Number.isInteger(valor) ? 'integer' : typeof valor
  const esperado = esquema.type
  if (esperado && esperado !== tipo && !(esperado === 'number' && tipo === 'integer')) {
    fallos.push(`${ruta}: se documenta ${esperado} y llega ${tipo}`)
    return fallos
  }
  if (esquema.enum && !esquema.enum.includes(valor)) fallos.push(`${ruta}: valor fuera del enum`)
  if (tipo === 'object') {
    const documentadas = propiedadesDe(esquema, componentes)
    for (const [clave, contenido] of Object.entries(valor)) {
      if (esquema.properties?.[clave]) {
        // Dentro de una parte de allOf, lo anidado también puede completarse en otra parte
        fallos.push(...incumplimientos(contenido, esquema.properties[clave], componentes, `${ruta}.${clave}`, esParte))
      } else if (!esParte && documentadas && !documentadas.has(clave) && !esquema.additionalProperties) {
        fallos.push(`${ruta}.${clave}: no está documentado`)
      } else if (esquema.additionalProperties && typeof esquema.additionalProperties === 'object') {
        fallos.push(...incumplimientos(contenido, esquema.additionalProperties, componentes, `${ruta}.${clave}`))
      }
    }
  }
  if (tipo === 'array' && esquema.items) {
    valor.forEach((elemento, indice) => fallos.push(...incumplimientos(elemento, esquema.items, componentes, `${ruta}[${indice}]`)))
  }
  return fallos
}

/** Nombres de todas las propiedades que un esquema documenta, sumando sus partes allOf y $ref. */
function propiedadesDe(esquema, componentes) {
  if (esquema.$ref) return propiedadesDe(componentes[esquema.$ref.split('/').pop()], componentes)
  const partes = (esquema.allOf ?? []).map((parte) => propiedadesDe(parte, componentes))
  if (!esquema.properties && partes.every((parte) => parte === null)) return null
  const nombres = new Set(Object.keys(esquema.properties ?? {}))
  for (const parte of partes) for (const nombre of parte ?? []) nombres.add(nombre)
  return nombres
}

let documento = null

/**
 * Afirma que una respuesta real cumple el esquema que Swagger publica para esa
 * ruta, método y código de estado.
 * @param {import('supertest').Response} respuesta
 * @param {string} ruta Ruta tal como aparece en la documentación, por ejemplo '/auth/yo'.
 * @param {string} metodo get, post, put, patch o delete.
 */
export async function afirmarContrato(respuesta, ruta, metodo) {
  documento ??= (await request(app).get('/api/docs.json')).body
  const operacion = documento.paths[ruta]?.[metodo]
  assert.ok(operacion, `Swagger no documenta ${metodo.toUpperCase()} ${ruta}`)
  let definicion = operacion.responses[respuesta.status]
  assert.ok(definicion, `Swagger no documenta el código ${respuesta.status} de ${metodo.toUpperCase()} ${ruta}`)
  if (definicion.$ref) definicion = documento.components.responses[definicion.$ref.split('/').pop()]
  const esquema = definicion.content['application/json'].schema
  assert.deepEqual(
    incumplimientos(respuesta.body, esquema, documento.components.schemas),
    [],
    `${metodo.toUpperCase()} ${ruta} -> ${respuesta.status}`,
  )
}
