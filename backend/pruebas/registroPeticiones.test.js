import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dispositivoDe, origenDe } from '../src/middlewares/registrarPeticiones.js'

const peticion = (encabezados, ip = '10.0.0.1') => ({ ip, get: (nombre) => encabezados[nombre.toLowerCase()] })

describe('Registro de peticiones', () => {
  it('toma la dirección del cliente que pone Cloudflare antes que la del proxy interno', () => {
    assert.equal(origenDe(peticion({ 'cf-connecting-ip': '190.1.2.3', 'x-forwarded-for': '200.0.0.9, 10.0.0.2' })), '190.1.2.3')
  })

  it('sin Cloudflare usa la primera dirección de X-Forwarded-For y, sin ella, req.ip', () => {
    assert.equal(origenDe(peticion({ 'x-forwarded-for': '200.0.0.9, 10.0.0.2' })), '200.0.0.9')
    assert.equal(origenDe(peticion({}, '::ffff:127.0.0.1')), '127.0.0.1')
  })

  it('resume navegador y sistema a partir del User-Agent', () => {
    assert.equal(dispositivoDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'), 'Chrome/Windows')
    assert.equal(dispositivoDe('Mozilla/5.0 (Windows NT 10.0) Chrome/142 Safari/537.36 Edg/142'), 'Edge/Windows')
    assert.equal(dispositivoDe('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/142 Mobile Safari/537.36'), 'Chrome/Android')
    assert.equal(dispositivoDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605 Version/18 Mobile Safari/604.1'), 'Safari/iOS')
    assert.equal(dispositivoDe('PostmanRuntime/7.43.0'), 'Postman')
    assert.equal(dispositivoDe(undefined), 'sin navegador')
  })
})
