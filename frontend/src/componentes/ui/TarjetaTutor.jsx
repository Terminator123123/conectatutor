// Resume un tutor mediante datos de presentación y un enlace a su perfil.
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import ChipMateria from './ChipMateria.jsx'
import BloqueCalificacion from './BloqueCalificacion.jsx'

const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

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
 * @returns {import('react').ReactElement} Tarjeta de tutor.
 */
export default function TarjetaTutor({
  nombre, programa, semestre, materias, promedio, totalCalificaciones, tarifaHora, ruta,
}) {
  const gratuita = tarifaHora === null

  return (
    <article className="ct-tarjeta-tutor">
      <div className="ct-tarjeta-encabezado">
        <Avatar nombre={nombre} />
        <div className="ct-tarjeta-identidad">
          <h3>{nombre}</h3>
          <p>{programa} · {semestre}.º semestre</p>
        </div>
      </div>
      <div className="ct-lista-chips">
        {materias.map((materia) => <ChipMateria key={materia} nombre={materia} />)}
      </div>
      <div className="ct-tarjeta-resumen">
        <BloqueCalificacion promedio={promedio} total={totalCalificaciones} />
        <span className={`ct-tarifa${gratuita ? ' ct-tarifa-gratuita' : ''}`}>
          {gratuita ? 'Gratuita' : `${formatoMoneda.format(tarifaHora)} / hora`}
        </span>
      </div>
      <Link className="btn-ct-secundario ct-boton ct-tarjeta-enlace" to={ruta}>Ver perfil</Link>
    </article>
  )
}
