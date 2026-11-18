// Cambia la foto de perfil: la reduce en el navegador a 320 × 320 y advierte qué imágenes no se permiten.
import { useState } from 'react'
import { repositorio } from '../../servicios/instancias.js'
import { avisarFotoCambiada } from '../../servicios/fotos.js'
import Avatar from '../ui/Avatar.jsx'
import Boton from '../ui/Boton.jsx'
import MensajeError from '../ui/MensajeError.jsx'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const LADO = 320

/** Recorta al centro, reduce y convierte a WebP (o JPEG si el navegador no sabe). */
async function prepararImagen(archivo) {
  const mapa = await createImageBitmap(archivo)
  const lado = Math.min(mapa.width, mapa.height)
  const lienzo = document.createElement('canvas')
  lienzo.width = LADO
  lienzo.height = LADO
  lienzo.getContext('2d').drawImage(mapa, (mapa.width - lado) / 2, (mapa.height - lado) / 2, lado, lado, 0, 0, LADO, LADO)
  mapa.close?.()
  const webp = lienzo.toDataURL('image/webp', 0.85)
  return webp.startsWith('data:image/webp') ? webp : lienzo.toDataURL('image/jpeg', 0.85)
}

/**
 * @param {object} props Propiedades.
 * @param {import('../../modelo/Usuario.js').default} props.usuario Usuario con la sesión iniciada.
 * @returns {import('react').ReactElement} Sección de foto de perfil.
 */
export default function FotoPerfil({ usuario }) {
  const [vista, setVista] = useState('')
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const idEntrada = `foto-${usuario.getId()}`

  async function elegir(evento) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    setError(''); setAviso('')
    if (!archivo) return
    if (!TIPOS.includes(archivo.type)) { setError('Elige una imagen JPG, PNG o WebP.'); return }
    if (archivo.size > 8 * 1024 * 1024) { setError('La imagen pesa más de 8 MB. Elige una más liviana.'); return }
    try { setVista(await prepararImagen(archivo)) } catch { setError('No pudimos leer esa imagen. Prueba con otra.') }
  }
  async function guardar() {
    setEstado('guardando'); setError('')
    try { await repositorio.guardarFoto(vista); setVista(''); avisarFotoCambiada(); setAviso('Foto actualizada.') }
    catch (fallo) { setError(fallo.message) }
    finally { setEstado('') }
  }
  async function quitar() {
    setEstado('quitando'); setError('')
    try { await repositorio.quitarFoto(); avisarFotoCambiada(); setAviso('Quitamos tu foto. Se mostrarán tus iniciales.') }
    catch (fallo) { setError(fallo.message) }
    finally { setEstado('') }
  }

  return <section className="ct-cuenta-seccion" aria-labelledby="titulo-foto">
    <h2 id="titulo-foto">Foto de perfil</h2>
    <div className="ct-foto-fila">
      {vista ? <img className="ct-foto-vista" src={vista} alt="Vista previa de tu nueva foto" width="88" height="88" />
        : <Avatar nombre={usuario.getNombre()} usuarioId={usuario.getId()} tamano={88} />}
      <div className="ct-foto-acciones">
        <input id={idEntrada} className="visually-hidden" type="file" accept={TIPOS.join(',')} onChange={elegir} disabled={!!estado} />
        {vista ? <>
          <Boton cargando={estado === 'guardando'} alHacerClic={guardar}>Guardar foto</Boton>
          <Boton variante="secundario" alHacerClic={() => setVista('')} deshabilitado={!!estado}>Cancelar</Boton>
        </> : <>
          <label htmlFor={idEntrada} className="ct-boton btn-ct-secundario"><i className="bi bi-camera" aria-hidden="true" /> Cambiar foto</label>
          <button type="button" className="ct-enlace-pequeno" onClick={quitar} disabled={!!estado}>Quitar foto</button>
        </>}
      </div>
    </div>
    <div className="ct-nota-cuidado" role="note">
      <i className="bi bi-exclamation-triangle" aria-hidden="true" />
      <p><strong>Cuida lo que subes.</strong> Tu foto la ven otros estudiantes. Usa una imagen tuya y apropiada para un espacio académico. No subas desnudos ni contenido sexual, violencia, armas o drogas, símbolos de odio, documentos con datos personales ni fotos de otras personas sin su permiso. Cualquier estudiante puede reportar un perfil con una foto inapropiada.</p>
    </div>
    {error && <MensajeError mensaje={error} />}
    <p role="status" className={aviso ? 'ct-aviso' : 'visually-hidden'}>{aviso}</p>
  </section>
}
