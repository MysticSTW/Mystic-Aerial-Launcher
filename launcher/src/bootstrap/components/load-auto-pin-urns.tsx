import { useEffect } from 'react'

import { useGetAutoPinUrnActions } from '../../hooks/stw-operations/urns'

/**
 * Loads the Auto-pin Urns toggles on start (not only when its page opens),
 * so the sidebar can show whether it is active.
 */
export function LoadAutoPinUrns() {
  const { addAccount } = useGetAutoPinUrnActions()

  useEffect(() => {
    const listener = window.electronAPI.notificationAutoPinUrnsData(
      async (data) => {
        Object.entries(data.urns).forEach(([accountId, value]) => {
          addAccount(accountId, {
            type: 'urns',
            value,
          })
        })
        Object.entries(data.miniBosses).forEach(([accountId, value]) => {
          addAccount(accountId, {
            type: 'mini-bosses',
            value,
          })
        })
      }
    )

    window.electronAPI.autoPinUrnsRequestData()

    return () => {
      listener.removeListener()
    }
  }, [])

  return null
}
