import type { TodaysLlama, WeeklyReward } from '../../types/llama-shop'

import { AccountsManager } from '../startup/accounts'
import { Authentication } from './authentication'
import { WorldInfoManager } from './world-info'

import {
  getQueryProfile,
  setClientQuestLogin,
} from '../../services/endpoints/mcp'

type ProfileItem = {
  attributes?: Record<string, unknown>
  templateId?: string
}

/**
 * The weekly "Complete Mission Alerts" quest (Twine Peaks) rewards one of
 * these, picked at random each week.
 */
const weeklyRewards: Record<string, Omit<WeeklyReward, 'accounts'>> = {
  weekly_elder_missionalerts_gameplayreperk: {
    name: 'Core RE-PERK!',
    resource: 'reagent_alteration_gameplay_generic',
  },
  weekly_elder_missionalerts_herosupercharge: {
    name: 'Hero Supercharger',
    resource: 'reagent_promotion_heroes',
  },
  weekly_elder_missionalerts_survivorsupercharge: {
    name: 'Survivor Supercharger',
    resource: 'reagent_promotion_survivors',
  },
  weekly_elder_missionalerts_trapsupercharge: {
    name: 'Trap Supercharger',
    resource: 'reagent_promotion_traps',
  },
  weekly_elder_missionalerts_weaponsupercharge: {
    name: 'Weapon Supercharger',
    resource: 'reagent_promotion_weapons',
  },
}

type CatalogEntry = {
  devName?: string
  title?: string
  itemGrants?: Array<{ templateId: string }>
  prices?: Array<{ currencySubType?: string; finalPrice?: number }>
}

const catalogUrl =
  'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/storefront/v2/catalog'

/**
 * The Upgrade Llama is always in the X-Ray shop, so it is left out.
 */
const alwaysAvailable = new Set(['cardpack_bronze'])

/**
 * The weekly quest asks for 10 mission alerts in the 160 zones.
 */
const weeklyRequired = 10

/**
 * Accounts already sent a ClientQuestLogin this week, so it only happens once
 * per weekly reset even when Home is opened many times. Keyed by account and
 * week, so a launcher left open over the reset still asks for the new quest.
 */
const questLoginSent = new Set<string>()

/**
 * Start of the current STW week: the weekly quests reset on Thursday at
 * 00:00 UTC.
 */
function currentWeekStart(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const daysSinceThursday = (start.getUTCDay() - 4 + 7) % 7

  start.setUTCDate(start.getUTCDate() - daysSinceThursday)

  return start.getTime()
}

/**
 * The newest weekly quest on the account. After a weekly reset the old quest
 * stays in the profile until the account logs in, so taking the first one
 * found showed last week's reward.
 */
function findWeeklyQuest(items: Record<string, ProfileItem>) {
  let newest: {
    item: ProfileItem
    reward: Omit<WeeklyReward, 'accounts'>
    created: number
  } | null = null

  for (const item of Object.values(items)) {
    const questId = item.templateId?.replace(/^Quest:/i, '').toLowerCase()

    if (!questId || !weeklyRewards[questId]) {
      continue
    }

    const created = Date.parse(`${item.attributes?.creation_time ?? ''}`)
    const time = Number.isNaN(created) ? 0 : created

    if (!newest || time > newest.created) {
      newest = { item, reward: weeklyRewards[questId], created: time }
    }
  }

  return newest
}

/**
 * True when the quest was handed out before this week's reset.
 */
function isStale(found: { created: number }) {
  return found.created < currentWeekStart()
}

export class LlamaShop {
  static async request(): Promise<Array<TodaysLlama>> {
    try {
      const accessToken = await WorldInfoManager.getAccessToken()

      if (!accessToken) {
        return []
      }

      const response = await fetch(catalogUrl, {
        headers: { Authorization: `bearer ${accessToken}` },
      })

      if (!response.ok) {
        return []
      }

      const catalog = (await response.json()) as {
        storefronts?: Array<{ name: string; catalogEntries: Array<CatalogEntry> }>
      }
      const entries =
        catalog.storefronts?.find(
          (storefront) => storefront.name === 'CardPackStorePreroll'
        )?.catalogEntries ?? []
      const llamas = new Map<string, TodaysLlama>()

      for (const entry of entries) {
        const templateId = entry.itemGrants
          ?.find((grant) => /^CardPack:/i.test(grant.templateId))
          ?.templateId.toLowerCase()
        const id = templateId?.replace(/^cardpack:/, '')
        const price = entry.prices?.find(
          (item) =>
            item.currencySubType === 'AccountResource:currency_xrayllama'
        )?.finalPrice

        if (!templateId || !id || alwaysAvailable.has(id) || llamas.has(id)) {
          continue
        }

        // Virtual entries have no title, their name is inside devName:
        // "[VIRTUAL]1 x Legendary Troll Stash Llama for 500 GameItem : ..."
        const name =
          entry.title?.trim() ||
          entry.devName?.match(/\d+ x (.+?) for \d+/)?.[1]?.trim() ||
          'Llama'

        if (!/llama/i.test(name)) {
          continue
        }

        llamas.set(id, { name, price: price ?? null, templateId })
      }

      return [...llamas.values()]

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    return []
  }

  /**
   * Returns each different weekly reward found on the logged-in accounts
   * (only accounts that have unlocked the weekly quest have one), with each
   * account's mission progress.
   *
   * Weekly quests are only handed out when the account logs in to STW, so an
   * account without one gets a ClientQuestLogin (the same call the game makes)
   * and is read again. That way the reward shows without opening the game.
   */
  static async requestWeekly(): Promise<Array<WeeklyReward>> {
    const rewards = new Map<string, WeeklyReward>()

    try {
      await AccountsManager.ensureLoaded()

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    await Promise.allSettled(
      [...AccountsManager.getAccounts().values()].map(async (account) => {
        const accessToken = await Authentication.verifyAccessToken(account)

        if (!accessToken) {
          return
        }

        const readItems = async () => {
          const response = await getQueryProfile({
            accessToken,
            accountId: account.accountId,
          })

          return (response.data.profileChanges?.[0]?.profile?.items ??
            {}) as Record<string, ProfileItem>
        }

        let found = findWeeklyQuest(await readItems())
        const loginKey = `${account.accountId}:${currentWeekStart()}`

        // No quest yet, or only last week's: log in to STW (the same call the
        // game makes) so Epic hands out this week's quest.
        if ((!found || isStale(found)) && !questLoginSent.has(loginKey)) {
          questLoginSent.add(loginKey)

          await setClientQuestLogin({
            accessToken,
            accountId: account.accountId,
          })

          found = findWeeklyQuest(await readItems())
        }

        // Never show last week's reward.
        if (!found || isStale(found)) {
          return
        }

        const attributes = found.item.attributes ?? {}
        const state = `${attributes.quest_state ?? ''}`.toLowerCase()
        const completed = state === 'completed' || state === 'claimed'
        const counted = Object.entries(attributes)
          .filter(
            ([key, value]) =>
              key.startsWith('completion_') && typeof value === 'number'
          )
          .reduce((total, [, value]) => total + (value as number), 0)
        const entry = rewards.get(found.reward.resource) ?? {
          ...found.reward,
          accounts: [],
        }

        entry.accounts.push({
          accountId: account.accountId,
          completed,
          displayName: account.displayName,
          progress: completed
            ? weeklyRequired
            : Math.min(counted, weeklyRequired),
          required: weeklyRequired,
        })
        rewards.set(found.reward.resource, entry)
      })
    )

    return [...rewards.values()]
  }
}
