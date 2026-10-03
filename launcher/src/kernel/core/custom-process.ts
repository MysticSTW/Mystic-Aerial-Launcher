import { execFile } from 'node:child_process'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'

export class CustomProcess {
  private static id: number | null = null
  private static name: string | null = null
  private static isRunning = false
  private static poller: NodeJS.Timeout | null = null

  private static parseTasklistLine(line: string) {
    const values = line.match(/"([^"]*)"/g)

    if (!values || values.length < 2) {
      return null
    }

    const name = values[0].slice(1, -1)
    const pid = Number(values[1].slice(1, -1))

    if (!name || !Number.isFinite(pid)) {
      return null
    }

    return { name, pid }
  }

  private static syncStatus() {
    if (!CustomProcess.name) {
      return
    }

    execFile(
      'tasklist',
      ['/FO', 'CSV', '/NH'],
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          return
        }

        const next = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => CustomProcess.parseTasklistLine(line))
          .find(
            (item) =>
              item !== null &&
              item.name.toLowerCase() ===
                CustomProcess.name!.toLowerCase()
          )

        const nextIsRunning = next !== undefined

        CustomProcess.id = next?.pid ?? null
        CustomProcess.isRunning = nextIsRunning

        MainWindow.send(
          ElectronAPIEventKeys.CustomProcessStatus,
          CustomProcess.isRunning
        )
      }
    )
  }

  static init() {
    if (!CustomProcess.name) {
      return
    }

    if (CustomProcess.poller) {
      clearInterval(CustomProcess.poller)
      CustomProcess.poller = null
    }

    CustomProcess.syncStatus()
    CustomProcess.poller = setInterval(() => {
      CustomProcess.syncStatus()
    }, 2000)
  }

  static kill() {
    if (typeof CustomProcess.id !== 'number') {
      return
    }

    execFile(
      'taskkill',
      ['/PID', `${CustomProcess.id}`, '/F', '/T'],
      { windowsHide: true },
      () => {
        CustomProcess.syncStatus()
      }
    )
  }

  static setName(value: string, restart?: boolean) {
    if (value === CustomProcess.name) {
      return
    }

    CustomProcess.name = value

    if (restart) {
      CustomProcess.destroy()
      CustomProcess.init()
    }
  }

  static destroy() {
    if (CustomProcess.poller) {
      clearInterval(CustomProcess.poller)
      CustomProcess.poller = null
    }

    CustomProcess.id = null
    CustomProcess.name = null
    CustomProcess.isRunning = false
  }
}
