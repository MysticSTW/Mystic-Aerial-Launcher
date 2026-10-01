/**
 * "Hide account names" (for recording/streaming). Renderer only, the main
 * process has no localStorage so names are never hidden there.
 */

const storageKey = 'ui:hide-account-names'

export function areAccountNamesHidden() {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(storageKey) === 'true'
    )
  } catch {
    return false
  }
}

export function setAccountNamesHidden(value: boolean) {
  try {
    localStorage.setItem(storageKey, `${value}`)
  } catch {
    //
  }
}

/**
 * Stand-in name built from the end of the account id, so accounts can
 * still be told apart.
 */
export function maskedAccountName(accountId?: string) {
  return `Account ${(accountId ?? '').slice(-4).toUpperCase() || '????'}`
}

export function visibleAccountName(accountId: string, displayName: string) {
  return areAccountNamesHidden() ? maskedAccountName(accountId) : displayName
}
