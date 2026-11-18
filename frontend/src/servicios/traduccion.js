// Traducción de la interfaz con el traductor web gratuito de Google (sin clave).
// El español es el idioma original; el inglés lo traduce Google en el navegador.
// Google no ofrece wayuunaiki: esa traducción queda PENDIENTE UNIGUAJIRA.

const COOKIE = 'googtrans'

/** @returns {'es'|'en'} Idioma elegido, guardado en la cookie que usa el traductor. */
export function idiomaActual() {
  const valor = document.cookie.split('; ').find((parte) => parte.startsWith(`${COOKIE}=`))?.split('=')[1] ?? ''
  return decodeURIComponent(valor).endsWith('/en') ? 'en' : 'es'
}

function borrarCookie() {
  const dominios = ['', location.hostname, `.${location.hostname}`]
  for (const dominio of dominios) {
    document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${dominio ? `; domain=${dominio}` : ''}`
  }
}

/**
 * Cambia el idioma y recarga la página para que el traductor se aplique de cero.
 * @param {'es'|'en'} codigo Idioma elegido.
 */
export function cambiarIdioma(codigo) {
  if (codigo === idiomaActual()) return
  borrarCookie()
  if (codigo === 'en') document.cookie = `${COOKIE}=/es/en; path=/`
  location.reload()
}

/**
 * React y el traductor tocan el mismo DOM: si Google envuelve un texto en <font>,
 * React ya no encuentra el nodo al quitarlo. Este ajuste conocido evita el error.
 */
function tolerarCambiosDelTraductor() {
  const quitar = Node.prototype.removeChild
  Node.prototype.removeChild = function removeChild(hijo) {
    if (hijo.parentNode !== this) return hijo
    return quitar.call(this, hijo)
  }
  const insertar = Node.prototype.insertBefore
  Node.prototype.insertBefore = function insertBefore(nuevo, referencia) {
    if (referencia && referencia.parentNode !== this) return nuevo
    return insertar.call(this, nuevo, referencia)
  }
}

/** Carga el traductor solo si el idioma elegido no es el español. */
export function iniciarTraduccion() {
  if (idiomaActual() === 'es') return
  document.documentElement.lang = 'en'
  tolerarCambiosDelTraductor()
  const contenedor = document.createElement('div')
  contenedor.id = 'traductor-google'
  contenedor.hidden = true
  document.body.append(contenedor)
  window.iniciarTraductorGoogle = () => {
    new window.google.translate.TranslateElement({ pageLanguage: 'es', includedLanguages: 'en', autoDisplay: false }, 'traductor-google')
  }
  const script = document.createElement('script')
  script.src = 'https://translate.google.com/translate_a/element.js?cb=iniciarTraductorGoogle'
  script.async = true
  document.head.append(script)
}
