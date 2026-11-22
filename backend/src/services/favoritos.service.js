import { Estudiante, PerfilTutor } from '../models/index.js'
import { HttpError } from '../utils/HttpError.js'
import { calcularEstadisticas, FILTRO_PUBLICADO, presentarPerfil } from './tutores.service.js'

export async function listar(estudianteId) {
  const estudiante = await Estudiante.findById(estudianteId).select('favoritos')
  const perfiles = await PerfilTutor.find({
    _id: { $in: estudiante.favoritos },
    ...FILTRO_PUBLICADO,
  }).populate([
    { path: 'estudiante', populate: { path: 'programa' } },
    { path: 'materias', populate: { path: 'programa' } },
  ])
  const estadisticas = await calcularEstadisticas(perfiles.map((perfil) => perfil._id))
  return perfiles.map((perfil) => presentarPerfil(perfil, estadisticas.get(perfil.id)))
}

export async function agregar(estudianteId, perfilId) {
  const existe = await PerfilTutor.exists({ _id: perfilId, ...FILTRO_PUBLICADO })
  if (!existe) throw new HttpError(404, 'El tutor no existe')
  await Estudiante.updateOne({ _id: estudianteId }, { $addToSet: { favoritos: perfilId } })
  return listar(estudianteId)
}

export async function quitar(estudianteId, perfilId) {
  await Estudiante.updateOne({ _id: estudianteId }, { $pull: { favoritos: perfilId } })
  return listar(estudianteId)
}
