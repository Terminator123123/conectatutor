import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crearClienteApi, ErrorApi } from '../src/servicios/api.js'
import { crearRepositorioApi } from '../src/servicios/repositorioApi.js'

function crearAlmacen() {
  const valores = new Map([['otra.aplicacion', 'conservar']])
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, valor),
    removeItem: (clave) => valores.delete(clave),
  }
}

const json = (datos, status = 200) => new Response(JSON.stringify(datos), {
  status, headers: { 'Content-Type': 'application/json' },
})

function preparar(fetchImpl, opciones = {}) {
  const almacen = crearAlmacen()
  const cliente = crearClienteApi({ urlBase: 'http://localhost:3000/api/', almacen, fetchImpl, ...opciones })
  return { cliente, almacen }
}

test('consulta la URL configurada, codifica filtros y omite los vacíos', async () => {
  const { cliente } = preparar(async (url, opciones) => {
    assert.equal(url, 'https://api.ejemplo.test/api/tutores?materia=%C3%81lgebra+lineal&gratuita=false&minimo=0')
    assert.equal(opciones.method, 'GET')
    assert.deepEqual(opciones.headers, { Accept: 'application/json' })
    assert.equal(opciones.body, undefined)
    return json([{ id: 'tutor' }])
  }, { urlBase: 'https://api.ejemplo.test/api///' })
  assert.deepEqual(await cliente.peticion('/tutores', {
    parametros: { materia: 'Álgebra lineal', gratuita: false, minimo: 0, programa: '', sede: null, dia: undefined },
  }), [{ id: 'tutor' }])
})

test('envía JSON y el token actual en cada petición', async () => {
  const peticiones = []
  const { cliente } = preparar(async (_url, opciones) => { peticiones.push(opciones); return json({ id: 'sesion' }, 201) })
  cliente.guardarToken('token-uno')
  await cliente.peticion('/sesiones', { metodo: 'POST', datos: { tema: 'Ciclos y arreglos' } })
  cliente.guardarToken('token-dos')
  await cliente.peticion('/auth/yo')
  assert.equal(peticiones[0].headers.Authorization, 'Bearer token-uno')
  assert.equal(peticiones[0].headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(peticiones[0].body), { tema: 'Ciclos y arreglos' })
  assert.equal(peticiones[1].headers.Authorization, 'Bearer token-dos')
})

test('restaura el token desde otro cliente y al salir conserva claves ajenas', () => {
  const { cliente, almacen } = preparar(async () => json({}))
  cliente.guardarToken('token-persistido')
  const restaurado = crearClienteApi({ almacen, fetchImpl: async () => json({}) })
  assert.equal(restaurado.obtenerToken(), 'token-persistido')
  assert.equal(restaurado.tieneSesionGuardada(), true)
  restaurado.cerrarSesion()
  assert.equal(cliente.obtenerToken(), null)
  assert.equal(cliente.tieneSesionGuardada(), false)
  assert.equal(almacen.getItem('otra.aplicacion'), 'conservar')
})

test('un 401 autenticado borra el token y avisa de expiración una vez', async () => {
  let expiraciones = 0
  const { cliente } = preparar(async () => json({ mensaje: 'La sesión expiró' }, 401), { alExpirarSesion: () => { expiraciones += 1 } })
  cliente.guardarToken('token-vencido')
  await assert.rejects(cliente.peticion('/auth/yo'), (error) => error instanceof ErrorApi && error.status === 401)
  await assert.rejects(cliente.peticion('/auth/yo'))
  assert.equal(cliente.obtenerToken(), null)
  assert.equal(expiraciones, 1)
})

test('ingreso y registro son públicos y sus errores no cierran una sesión existente', async () => {
  let expiraciones = 0
  const { cliente } = preparar(async (_url, opciones) => {
    assert.equal(opciones.headers.Authorization, undefined)
    return json({ mensaje: 'El correo o la contraseña no son correctos' }, 401)
  }, { alExpirarSesion: () => { expiraciones += 1 } })
  cliente.guardarToken('sesion-existente')
  for (const ruta of ['/auth/ingreso', '/auth/registro/']) {
    await assert.rejects(cliente.peticion(ruta, { metodo: 'POST', datos: { clave: 'clave-de-prueba' } }))
  }
  assert.equal(cliente.obtenerToken(), 'sesion-existente')
  assert.equal(expiraciones, 0)
})

test('una consulta pública explícita no envía ni invalida el token', async () => {
  const { cliente } = preparar(async (_url, opciones) => {
    assert.equal(opciones.headers.Authorization, undefined)
    return json({ mensaje: 'Acceso no disponible' }, 401)
  })
  cliente.guardarToken('sesion-existente')
  await assert.rejects(cliente.peticion('/programas', { autenticada: false }))
  assert.equal(cliente.obtenerToken(), 'sesion-existente')
})

test('un 403 conserva la sesión y un 409 conserva el código y detalles del servidor', async () => {
  const respuestas = [json({ mensaje: 'Solo coordinación' }, 403), json({ mensaje: 'La franja está ocupada', regla: 'RQNF012', errores: ['Elige otra franja'] }, 409)]
  const { cliente } = preparar(async () => respuestas.shift())
  cliente.guardarToken('token-valido')
  await assert.rejects(cliente.peticion('/coordinacion/metricas'), { status: 403, message: 'Solo coordinación' })
  await assert.rejects(cliente.peticion('/sesiones', { metodo: 'POST', datos: {} }), (error) => {
    assert.equal(error.status, 409)
    assert.equal(error.regla, 'RQNF012')
    assert.deepEqual(error.errores, ['Elige otra franja'])
    return true
  })
  assert.equal(cliente.obtenerToken(), 'token-valido')
})

test('un 401 atrasado no borra un token nuevo', async () => {
  let responder
  let expiraciones = 0
  const { cliente } = preparar(() => new Promise((resolver) => { responder = resolver }), { alExpirarSesion: () => { expiraciones += 1 } })
  cliente.guardarToken('token-anterior')
  const pendiente = cliente.peticion('/auth/yo')
  cliente.guardarToken('token-nuevo')
  responder(json({ mensaje: 'La sesión expiró' }, 401))
  await assert.rejects(pendiente)
  assert.equal(cliente.obtenerToken(), 'token-nuevo')
  assert.equal(expiraciones, 0)
})

test('renovar incluso con el mismo token protege frente a un 401 atrasado', async () => {
  let responder
  const { cliente } = preparar(() => new Promise((resolver) => { responder = resolver }))
  cliente.guardarToken('mismo-token')
  const pendiente = cliente.peticion('/auth/yo')
  cliente.guardarToken('mismo-token')
  responder(json({ mensaje: 'La sesión expiró' }, 401))
  await assert.rejects(pendiente)
  assert.equal(cliente.obtenerToken(), 'mismo-token')
})

test('dos 401 simultáneos solo notifican una expiración', async () => {
  const respuestas = []
  let expiraciones = 0
  const { cliente } = preparar(() => new Promise((resolver) => { respuestas.push(resolver) }), { alExpirarSesion: () => { expiraciones += 1 } })
  cliente.guardarToken('token-vencido')
  const pendientes = Promise.allSettled([cliente.peticion('/auth/yo'), cliente.peticion('/sesiones')])
  respuestas.forEach((resolver) => resolver(json({ mensaje: 'La sesión expiró' }, 401)))
  assert.deepEqual((await pendientes).map((resultado) => resultado.status), ['rejected', 'rejected'])
  assert.equal(cliente.obtenerToken(), null)
  assert.equal(expiraciones, 1)
})

test('un error de red permite reintentar sin perder la sesión ni duplicar automáticamente mutaciones', async () => {
  let peticiones = 0
  const { cliente } = preparar(async () => {
    peticiones += 1
    if (peticiones === 1) throw new TypeError('fetch failed')
    return json({ id: 'sesion' }, 201)
  })
  cliente.guardarToken('token-valido')
  await assert.rejects(cliente.peticion('/sesiones', { metodo: 'POST', datos: {} }), (error) => {
    assert.ok(error instanceof ErrorApi)
    assert.equal(error.status, 0)
    assert.match(error.message, /No se pudo conectar con la API/)
    return true
  })
  assert.equal(peticiones, 1)
  assert.equal(cliente.obtenerToken(), 'token-valido')
  assert.deepEqual(await cliente.peticion('/sesiones', { metodo: 'POST', datos: {} }), { id: 'sesion' })
  assert.equal(peticiones, 2)
})

test('una respuesta exitosa con JSON inválido produce un error claro', async () => {
  const { cliente } = preparar(async () => new Response('<html>Intermediario</html>'))
  await assert.rejects(cliente.peticion('/programas'), (error) => {
    assert.equal(error.status, 200)
    assert.match(error.message, /respuesta que no se puede leer/)
    assert.doesNotMatch(error.message, /html/)
    return true
  })
})

test('un error HTTP sin JSON conserva el estado y un 401 igualmente expira', async () => {
  const { cliente } = preparar(async () => new Response('Unauthorized', { status: 401 }))
  cliente.guardarToken('token-vencido')
  await assert.rejects(cliente.peticion('/auth/yo'), { status: 401, message: 'No se pudo completar la solicitud (HTTP 401)' })
  assert.equal(cliente.obtenerToken(), null)
})

test('respuestas 204 y 205 no exigen JSON', async () => {
  const respuestas = [new Response(null, { status: 204 }), new Response(null, { status: 205 })]
  const { cliente } = preparar(async () => respuestas.shift())
  assert.equal(await cliente.peticion('/favoritos/tutor', { metodo: 'DELETE' }), null)
  assert.equal(await cliente.peticion('/favoritos/tutor', { metodo: 'DELETE' }), null)
})

test('la cancelación propaga AbortError y conserva el token', async () => {
  const controller = new AbortController()
  const cancelacion = new DOMException('Petición cancelada', 'AbortError')
  const { cliente } = preparar(async (_url, opciones) => {
    assert.equal(opciones.signal, controller.signal)
    throw cancelacion
  })
  cliente.guardarToken('token-valido')
  await assert.rejects(cliente.peticion('/sesiones', { signal: controller.signal }), (error) => error === cancelacion)
  assert.equal(cliente.obtenerToken(), 'token-valido')
})

test('rechaza rutas externas para no enviarles el token', async () => {
  let peticiones = 0
  const { cliente } = preparar(async () => { peticiones += 1; return json({}) })
  cliente.guardarToken('token-valido')
  for (const ruta of ['https://otro.test/robar', '//otro.test/robar', '/sesiones?estado=PENDIENTE', '/\\otro.test']) {
    await assert.rejects(cliente.peticion(ruta), TypeError)
  }
  assert.equal(peticiones, 0)
})

test('rechaza configuración ajena a HTTP y tokens vacíos', () => {
  for (const urlBase of ['file:///tmp/api', 'https://usuario:clave@ejemplo.test/api', 'https://ejemplo.test/api?otra=1', 'https://ejemplo.test/api#otro']) {
    assert.throws(() => crearClienteApi({ urlBase, almacen: crearAlmacen() }), TypeError)
  }
  const { cliente } = preparar(async () => json({}))
  for (const token of ['', ' ', null, 123]) assert.throws(() => cliente.guardarToken(token), TypeError)
})

const cuentaDeAcceso = {
  id: '111111111111111111111111', tipo: 'ESTUDIANTE', nombre: 'Estudiante de prueba',
  correoInstitucional: 'estudiante@uniguajira.edu.co', semestre: 3, sede: 'Riohacha',
  programa: { id: '222222222222222222222222', nombre: 'Ingeniería de Sistemas', facultad: 'Ingeniería' },
}

test('salir durante un ingreso pendiente impide que su respuesta restaure el token', async () => {
  let responder
  const { cliente } = preparar(() => new Promise((resolver) => { responder = resolver }))
  const repositorio = crearRepositorioApi({ cliente })
  const pendiente = repositorio.iniciarSesion('estudiante@uniguajira.edu.co', 'clave-de-prueba')
  repositorio.cerrarSesion()
  responder(json({ usuario: cuentaDeAcceso, token: 'token-atrasado' }))
  await assert.rejects(pendiente, /solicitud de acceso ya no está vigente/)
  assert.equal(cliente.obtenerToken(), null)
})

test('un ingreso anterior no reemplaza el token de un acceso más reciente', async () => {
  const respuestas = []
  const { cliente } = preparar(() => new Promise((resolver) => { respuestas.push(resolver) }))
  const repositorio = crearRepositorioApi({ cliente })
  const anterior = repositorio.iniciarSesion('estudiante@uniguajira.edu.co', 'clave-anterior')
  const reciente = repositorio.iniciarSesion('estudiante@uniguajira.edu.co', 'clave-reciente')
  respuestas[1](json({ usuario: cuentaDeAcceso, token: 'token-reciente' }))
  assert.equal((await reciente).getId(), cuentaDeAcceso.id)
  respuestas[0](json({ usuario: cuentaDeAcceso, token: 'token-anterior' }))
  await assert.rejects(anterior, /solicitud de acceso ya no está vigente/)
  assert.equal(cliente.obtenerToken(), 'token-reciente')
})
