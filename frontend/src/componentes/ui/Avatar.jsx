// Representa a una persona con su foto de perfil o, si no tiene, con las iniciales de su nombre.
import { useState } from 'react'
import { urlFotoDe } from '../../servicios/api.js'
import { useVersionFoto } from '../../servicios/fotos.js'

/**
 * Muestra un avatar decorativo junto al nombre que presenta el componente padre.
 * @param {object} props Propiedades del avatar.
 * @param {string} props.nombre Nombre del que se toman las dos primeras iniciales.
 * @param {string} [props.usuarioId] Si llega, se intenta mostrar la foto de esa persona.
 * @param {number} [props.tamano=48] Diámetro del avatar en píxeles.
 * @returns {import('react').ReactElement} Avatar circular.
 */
export default function Avatar({ nombre, usuarioId, tamano = 48 }) {
  const version = useVersionFoto()
  const fuente = usuarioId ? urlFotoDe(usuarioId, version) : ''
  const [cargada, setCargada] = useState('')
  const iniciales = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((palabra) => palabra[0].toUpperCase()).join('')

  return (
    <span
      className={`ct-avatar${cargada === fuente && fuente ? ' ct-avatar-con-foto' : ''}`}
      style={{ '--ct-avatar-tamano': `${tamano}px` }}
      aria-hidden="true"
    >
      {iniciales}
      {fuente && <img src={fuente} alt="" width={tamano} height={tamano} loading="lazy" decoding="async"
        onLoad={() => setCargada(fuente)} onError={() => setCargada('')} />}
    </span>
  )
}
