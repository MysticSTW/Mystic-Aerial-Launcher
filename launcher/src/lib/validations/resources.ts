export function isEvoMat(key: string) {
  return (
    key.includes('reagent_c_t01') ||
    key.includes('reagent_c_t02') ||
    key.includes('reagent_c_t03') ||
    key.includes('reagent_c_t04')
  )
}

/**
 * Legendary defender rewards (`Defender:did_defenderassault_basic_sr_t01`).
 */
export function isDefender(itemId: string) {
  return /^Defender:did_defender\w*?_sr_/i.test(itemId)
}

/**
 * Legendary survivors (`workerbasic_sr_t0X`) and mythic leads. Mythic leads
 * are named (`Worker:managerdoctor_sr_kingsly_t01`); plain legendary leads
 * (`Worker:managerdoctor_sr_t01`) are excluded.
 */
export function isLegendaryOrMythicSurvivor(itemId: string) {
  return (
    itemId.includes('workerbasic_sr') ||
    /^Worker:manager[a-z]+_sr_(?!t\d)/i.test(itemId)
  )
}
