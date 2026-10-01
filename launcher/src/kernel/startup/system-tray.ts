import path from 'node:path'
import { Menu, app, nativeImage, Tray } from 'electron'

import { MainWindow } from './windows/main'

export class SystemTray {
  private static current: Tray | null = null
  private static active = false

  static get isActive() {
    return SystemTray.active
  }

  static setIsActive(value: boolean) {
    SystemTray.active = value
  }

  static async create({ onOpen }: { onOpen: () => Promise<void> }) {
    if (SystemTray.current !== null) {
      return
    }

    try {
      // Packaged: icon.ico is copied to the resources folder (see
      // forge.config.ts extraResource). Dev: it sits in the project root.
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(app.getAppPath(), 'icon.ico')

      SystemTray.current = new Tray(nativeImage.createFromPath(iconPath))

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open Mystic Launcher',
          type: 'normal',
          click: () => {
            onOpen()
          },
        },
        {
          label: 'Exit',
          type: 'normal',
          click: () => {
            MainWindow.closeApp()
          },
        },
      ])

      SystemTray.current.setContextMenu(contextMenu)
      SystemTray.current.setToolTip('This is my application')
      SystemTray.current.setTitle('This is my title')

      SystemTray.current.addListener('click', () => {
        onOpen()
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      //
    }
  }

  static destroy() {
    SystemTray.current?.removeAllListeners()
    SystemTray.current?.destroy()
    SystemTray.current = null
  }
}
