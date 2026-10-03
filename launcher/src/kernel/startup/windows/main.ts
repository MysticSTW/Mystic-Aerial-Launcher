import { app, BrowserWindow } from 'electron'
import schedule from 'node-schedule'

import { CustomProcess } from '../../core/custom-process'
import { Automation } from '../automation'
import { SystemTray } from '../system-tray'

export class MainWindow {
  private static value: BrowserWindow
  private static quitting = false

  static get instance() {
    return MainWindow.value
  }

  static get isQuitting() {
    return MainWindow.quitting
  }

  static setQuitting() {
    MainWindow.quitting = true
  }

  /**
   * False once the window is gone. With the system tray on the app keeps
   * running after its window closes, and touching a destroyed window throws
   * "Object has been destroyed" (on every background check, so it looped).
   */
  static get isAvailable() {
    return (
      MainWindow.value !== undefined &&
      !MainWindow.value.isDestroyed() &&
      !MainWindow.value.webContents.isDestroyed()
    )
  }

  static send(channel: string, ...args: Array<unknown>) {
    if (!MainWindow.isAvailable) {
      return
    }

    MainWindow.value.webContents.send(channel, ...args)
  }

  static setInstance(value: BrowserWindow) {
    if (!MainWindow.value) {
      MainWindow.value = value
    }
  }

  static cleanup() {
    if (!MainWindow.value.isDestroyed()) {
      MainWindow.value.removeAllListeners()
    }

    Automation.clearActiveChecks(null)
    Automation.getServices().forEach((accountService) => {
      accountService.destroy()
    })
    schedule.gracefulShutdown().catch(() => {})

    CustomProcess.destroy()
    SystemTray.destroy()
  }

  static closeApp() {
    MainWindow.quitting = true

    if (process.platform !== 'darwin') {
      MainWindow.cleanup()
      app.quit()
    }
  }
}
