import { setSkipTutorial } from '../../services/endpoints/mcp'
import { storeRequestAccess } from '../../services/endpoints/store'

/**
 * Store access + skip tutorial for newly added accounts. The Unlock SSD
 * Rewards feature that also lived here is archived in
 * archive/removed-features/unlock-ssd-rewards.
 */
export class Unlock {
  static async storeAccess({
    accessToken,
    accountId,
  }: {
    accessToken: string
    accountId: string
  }) {
    try {
      await storeRequestAccess({
        accessToken,
        accountId,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }

    try {
      await setSkipTutorial({
        accessToken,
        accountId,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }
  }
}
