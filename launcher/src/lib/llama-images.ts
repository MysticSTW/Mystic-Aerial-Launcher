import artDeco from '../../assets/images/llamas/art-deco.png'
import birthday from '../../assets/images/llamas/birthday.png'
import fortnitemares from '../../assets/images/llamas/fortnitemares.png'
import founders from '../../assets/images/llamas/founders.png'
import gold from '../../assets/images/llamas/gold.png'
import holiday from '../../assets/images/llamas/holiday.png'
import lunar from '../../assets/images/llamas/lunar.png'
import melee from '../../assets/images/llamas/melee.png'
import military from '../../assets/images/llamas/military.png'
import miniReward from '../../assets/images/llamas/mini-reward.png'
import people from '../../assets/images/llamas/people.png'
import pirate from '../../assets/images/llamas/pirate.png'
import rad from '../../assets/images/llamas/rad.png'
import ranged from '../../assets/images/llamas/ranged.png'
import sciFi from '../../assets/images/llamas/sci-fi.png'
import silver from '../../assets/images/llamas/silver.png'
import spy from '../../assets/images/llamas/spy.png'
import trap from '../../assets/images/llamas/trap.png'
import trollStash from '../../assets/images/llamas/troll-stash.png'
import upgrade from '../../assets/images/llamas/upgrade.png'
import weapon from '../../assets/images/llamas/weapon.png'
import wildWest from '../../assets/images/llamas/wild-west.png'

/**
 * Card pack ID (from the storefront itemGrants "CardPack:<id>") -> llama image.
 * Covers the daily X-Ray rotation, the weekly expansion llamas and the loot tab.
 */
const llamaImages: Record<string, string> = {
  // Daily X-Ray
  cardpack_bronze: upgrade,
  cardpack_bronze_02x: silver,
  cardpack_bronze_03x: silver,
  cardpack_bronze_04x: silver,
  cardpack_bronze_05x: silver,
  cardpack_bronze_06x: silver,
  cardpack_bronze_07x: gold,
  cardpack_bronze_08x: gold,
  cardpack_bronze_09x: gold,
  cardpack_bronze_10x: gold,
  cardpack_bronze_traps: trap,
  cardpack_bronze_personnel: people,
  cardpack_rare_personnel: people,
  cardpack_rare_heroes: people,
  cardpack_bronze_weapons: weapon,
  cardpack_bronze_melee: melee,
  cardpack_rare_melee: melee,
  cardpack_bronze_ranged: ranged,
  cardpack_rare_ranged: ranged,
  cardpack_jackpot: trollStash,
  cardpack_jackpot_super: trollStash,
  cardpack_jackpot_superchoice: trollStash,

  // Expansion (weekly X-Ray)
  cardpack_event_2019_season11_ww: wildWest,
  cardpack_event_2019_military: military,
  cardpack_event_season12: spy,
  cardpack_event_2020_artdeco: artDeco,
  cardpack_event_2019_season9: sciFi,

  // Loot tab
  cardpack_basic: miniReward,
  cardpack_event_persistent_lunar: lunar,
  cardpack_event_persistent_pirate: pirate,
  cardpack_event_persistent_rad: rad,
  cardpack_event_persistent_fortnitemares: fortnitemares,
  cardpack_event_persistent_holiday: holiday,
  cardpack_event_persistent_anniversary: birthday,
  cardpack_event_2021_anniversary: birthday,
  cardpack_event_founders: founders,
}

export function getLlamaImage(templateId: string) {
  const id = templateId.replace(/^CardPack:/i, '').toLowerCase()

  return llamaImages[id] ?? upgrade
}
