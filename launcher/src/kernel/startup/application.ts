import type { NewVersionStatusCallbackResponseParam } from '../../types/preload'

import { repositoryURL } from '../../config/about/links'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from './windows/main'

import packageJson from '../../../package.json'

// How often the latest GitHub release is checked while the launcher is open.
const checkEvery = 3 * 60 * 60 * 1000 // 3 hours

/**
 * "1.0.2" > "1.0.1"? Compares dotted version numbers (a leading "v" is
 * ignored).
 */
function isNewer(latest: string, current: string) {
  const parse = (value: string) =>
    value
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const a = parse(latest)
  const b = parse(current)

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) {
      return (a[i] ?? 0) > (b[i] ?? 0)
    }
  }

  return false
}

export class Application {
  private static timer: NodeJS.Timeout | null = null
  private static last: NewVersionStatusCallbackResponseParam = null

  /**
   * Asks GitHub for the latest release and tells the window when it is newer
   * than this build's releaseVersion (the GitHub release number, e.g. 1.0.2;
   * package.json "version" is only the Windows installer number).
   */
  static async checkVersion() {
    Application.timer ??= setInterval(() => {
      Application.checkVersion().catch(() => {})
    }, checkEvery)

    try {
      const apiURL = repositoryURL.replace(
        'https://github.com/',
        'https://api.github.com/repos/',
      )
      const response = await fetch(`${apiURL}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Mystic-Launcher',
        },
      })

      if (response.ok) {
        const release = (await response.json()) as {
          tag_name?: string
          html_url?: string
          draft?: boolean
          prerelease?: boolean
        }
        const current = `${packageJson.releaseVersion ?? ''}`

        Application.last =
          release.tag_name &&
          release.html_url &&
          !release.draft &&
          !release.prerelease &&
          current &&
          isNewer(release.tag_name, current)
            ? {
                link: release.html_url,
                version: release.tag_name.replace(/^v/i, ''),
              }
            : null
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Offline or GitHub unreachable: keep the last known result.
    }

    MainWindow.send(
      ElectronAPIEventKeys.ResponseNewVersionStatus,
      Application.last,
    )
  }
}
