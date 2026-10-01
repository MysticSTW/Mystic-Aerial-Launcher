import type { AccountData } from '../../types/accounts'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useAccountListStore } from '../../state/accounts/list'

export function LoadAccounts() {
  const { accounts, addOrUpdate, register } =
    useAccountListStore(
      useShallow((state) => ({
        accounts: state.accounts,
        addOrUpdate: state.addOrUpdate,
        register: state.register,
      }))
    )

  useEffect(() => {
    const accountsLoaderListener = window.electronAPI.onAccountsLoaded(
      async (accounts) => {
        register(accounts)
      }
    )

    window.electronAPI.requestAccounts()

    return () => {
      accountsLoaderListener.removeListener()
    }
  }, [])

  useEffect(() => {
    const syncAccessTokenListener = window.electronAPI.syncAccountData(
      async ({ accountId, data }) => {
        addOrUpdate(accountId, data as AccountData)
      }
    )

    return () => {
      syncAccessTokenListener.removeListener()
    }
  }, [accounts])

  return null
}
