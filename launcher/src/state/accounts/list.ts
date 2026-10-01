import type { AccountData, AccountDataRecord } from '../../types/accounts'

import { create } from 'zustand'

const lastSelectedStorageKey = 'accounts:last-selected'

function getLastSelected() {
  try {
    return localStorage.getItem(lastSelectedStorageKey)

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null
  }
}

function saveLastSelected(accountId: string | null) {
  try {
    if (accountId) {
      localStorage.setItem(lastSelectedStorageKey, accountId)
    } else {
      localStorage.removeItem(lastSelectedStorageKey)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    //
  }
}

export type AccountListState = {
  accounts: AccountDataRecord
  idsList: Array<string>
  selected: string | null

  addOrUpdate: (accountId: string, account: AccountData) => void
  changeSelected: (accountId: string | null) => void
  getSelected: () => AccountData | null
  register: (accounts: AccountDataRecord, overwrite?: boolean) => void
  remove: (accountId: string) => AccountDataRecord
}

export const useAccountListStore = create<AccountListState>()(
  (set, get) => ({
    accounts: {},
    idsList: [],
    selected: null,

    addOrUpdate: (accountId, account) => {
      const accounts = get().accounts
      const idsList = get().idsList
      const current = accounts[accountId]

      if (current !== undefined) {
        const newIdsList = [...idsList]

        if (!newIdsList.includes(accountId)) {
          newIdsList.push(accountId)
        }

        set({
          accounts: {
            ...accounts,
            [accountId]: {
              ...current,
              ...account,
            },
          },
          idsList: newIdsList,
        })
      }
    },
    changeSelected: (accountId) => {
      if (accountId === null) {
        return set(() => ({
          selected: null,
        }))
      }

      const current = get().accounts[accountId] as AccountData | undefined
      const selected = current?.accountId ?? null

      saveLastSelected(selected)
      set(() => ({
        selected,
      }))
    },
    getSelected: () => {
      const selected = get().selected
      const accounts = Object.values(get().accounts)
      const current = accounts.find(
        ({ accountId }) => accountId === selected
      )

      return current ?? null
    },
    register: (accounts, overwrite) => {
      set((state) => {
        const newAccounts = overwrite
          ? accounts
          : {
              ...state.accounts,
              ...accounts,
            }

        const lastSelected = getLastSelected()
        const selected =
          (lastSelected && newAccounts[lastSelected]?.accountId) ||
          (state.selected && newAccounts[state.selected]?.accountId) ||
          Object.values(newAccounts)[0]?.accountId ||
          null

        return {
          accounts: newAccounts,
          idsList: Object.keys(newAccounts),
          selected,
        }
      })
    },
    remove: (accountId) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [accountId]: _current, ...accounts } = get().accounts
      const idsList = get().idsList
      const currentSelected = get().selected
      const newSelected = ((currentSelected && accounts[currentSelected]) ??
        Object.values(accounts)[0]) as AccountData | undefined

      saveLastSelected(newSelected?.accountId ?? null)
      set({
        accounts,
        idsList: idsList.filter((currentId) => currentId !== accountId),
        selected: newSelected?.accountId ?? null,
      })

      return accounts
    },
  })
)
