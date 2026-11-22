/**
 * Une nombres como se dicen en español: "A", "A y B", "A, B y C".
 * @param {string[]} nombres
 * @returns {string}
 */
export function unirNombres(nombres) {
  return nombres.length < 2 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}
