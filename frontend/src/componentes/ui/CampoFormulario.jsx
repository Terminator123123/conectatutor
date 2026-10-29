// Agrupa un control de formulario accesible con su etiqueta, ayuda y error.
import { useId, useState } from 'react'

/**
 * Presenta un campo controlado y comunica siempre texto a alCambiar.
 * @param {object} props Propiedades del campo.
 * @param {string} props.etiqueta Etiqueta visible del control.
 * @param {string|number} [props.valor=''] Valor controlado.
 * @param {function(string): void} props.alCambiar Recibe el texto introducido.
 * @param {'text'|'email'|'password'|'number'|'textarea'|'select'} [props.tipo='text'] Tipo de control.
 * @param {{valor: string|number, etiqueta: string}[]} [props.opciones=[]] Opciones del select.
 * @param {string} [props.ayuda] Ayuda que se muestra cuando no hay error.
 * @param {string} [props.error] Error que sustituye a la ayuda.
 * @param {boolean} [props.obligatorio=false] Indica que el control es obligatorio.
 * @param {boolean} [props.deshabilitado=false] Deshabilita el control y el botón de contraseña.
 * @param {string} [props.placeholder] Texto orientativo del control vacío.
 * @param {string} [props.nombre] Nombre nativo del campo.
 * @param {string} [props.autoComplete] Indicación de autocompletado del navegador.
 * @returns {import('react').ReactElement} Campo con etiqueta y descripción asociadas.
 */
export default function CampoFormulario({
  etiqueta,
  valor = '',
  alCambiar,
  tipo = 'text',
  opciones = [],
  ayuda,
  error,
  obligatorio = false,
  deshabilitado = false,
  placeholder,
  nombre,
  autoComplete,
}) {
  const id = useId()
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const textoApoyo = error || ayuda
  const idApoyo = `${id}-apoyo`
  const esContrasena = tipo === 'password'
  const propiedadesControl = {
    id,
    name: nombre,
    value: valor,
    onChange: (evento) => alCambiar(evento.target.value),
    required: obligatorio,
    disabled: deshabilitado,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': textoApoyo ? idApoyo : undefined,
    className: `ct-campo-control${error ? ' ct-campo-con-error' : ''}${esContrasena ? ' ct-campo-con-ojo' : ''}`,
  }

  return (
    <div className="ct-campo">
      <label className="ct-campo-etiqueta" htmlFor={id}>{etiqueta}</label>
      {tipo === 'textarea' ? (
        <textarea {...propiedadesControl} rows={3} placeholder={placeholder} />
      ) : tipo === 'select' ? (
        <select {...propiedadesControl}>
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
          ))}
        </select>
      ) : (
        <div className="ct-campo-entrada">
          <input
            {...propiedadesControl}
            type={esContrasena && mostrarContrasena ? 'text' : tipo}
            placeholder={placeholder}
          />
          {esContrasena && (
            <button
              className="ct-campo-ojo"
              type="button"
              aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={mostrarContrasena}
              disabled={deshabilitado}
              onClick={() => setMostrarContrasena((visible) => !visible)}
            >
              <i className={`bi ${mostrarContrasena ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {textoApoyo && (
        <p id={idApoyo} className={error ? 'ct-campo-error' : 'ct-campo-ayuda'}>{textoApoyo}</p>
      )}
    </div>
  )
}
