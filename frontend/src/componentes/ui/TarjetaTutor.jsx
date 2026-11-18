import { formatearMoneda } from './moneda.js'
// Resume un tutor mediante datos de presentación y un enlace a su perfil.
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import BloqueCalificacion from './BloqueCalificacion.jsx'


/**
 * Presenta un tutor sin acceder a clases ni servicios del dominio.
 * @param {object} props Datos de presentación del tutor.
 * @param {string} props.nombre Nombre visible del tutor.
 * @param {string} props.programa Programa académico.
 * @param {number} props.semestre Semestre que cursa.
 * @param {string[]} props.materias Nombres de las materias ofrecidas.
 * @param {number} props.promedio Promedio de calificaciones.
 * @param {number} props.totalCalificaciones Número de calificaciones recibidas.
 * @param {number|null} props.tarifaHora Tarifa en pesos o null si es gratuita.
 * @param {string} props.ruta Destino del enlace al perfil.
 * @param {boolean} [props.favorito] Si el tutor está en los favoritos de quien mira.
 * @param {function(): void} [props.alAlternarFavorito] Guarda o quita el favorito; sin ella no hay corazón.
 * @param {boolean} [props.guardando] Deshabilita el corazón mientras se guarda.
 * @param {string} [props.usuarioId] Id del estudiante tutor, para su foto.
 * @param {string} [props.sede] Sede a la que pertenece el tutor.
 * @returns {import('react').ReactElement} Tarjeta de tutor.
 */
export default function TarjetaTutor({
  nombre, programa, semestre, materias, promedio, totalCalificaciones, tarifaHora, ruta,
  favorito = false, alAlternarFavorito, guardando = false, usuarioId, sede,
}) {
  const gratuita = tarifaHora === null

  return (
    <article className="ct-tarjeta-tutor">
      <div className="ct-tarjeta-encabezado">
        <Avatar nombre={nombre} usuarioId={usuarioId} />
        <div className="ct-tarjeta-identidad">
          <h3>{nombre}</h3>
          {sede && <p className="ct-tarjeta-sede"><i className="bi bi-geo-alt" aria-hidden="true" />Sede {sede}</p>}
          <p>{programa} · {semestre}.º semestre</p>
        </div>
        {alAlternarFavorito && <button type="button" className={`ct-corazon${favorito ? ' ct-corazon-activo' : ''}`}
          aria-pressed={favorito} disabled={guardando} onClick={alAlternarFavorito}
          aria-label={favorito ? `Quitar a ${nombre} de favoritos` : `Guardar a ${nombre} en favoritos`}
          title={favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}>
          <i className={`bi ${favorito ? 'bi-heart-fill' : 'bi-heart'}`} aria-hidden="true" />
        </button>}
      </div>
      <p className="ct-tarjeta-materias" title={materias.join(', ')}>{materias.join(', ')}</p>
      <div className="ct-tarjeta-resumen">
        <BloqueCalificacion promedio={promedio} total={totalCalificaciones} />
        <span className={`ct-tarifa${gratuita ? ' ct-tarifa-gratuita' : ''}`}>
          {gratuita ? 'Gratuita' : `${formatearMoneda(tarifaHora)}/h`}
        </span>
      </div>
      <Link className="btn-ct-secundario ct-boton ct-tarjeta-enlace" to={ruta}>Ver perfil</Link>
    </article>
  )
}
