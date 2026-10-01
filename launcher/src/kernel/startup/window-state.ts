import type { BrowserWindow, Rectangle } from 'electron'

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app, screen } from 'electron'

/**
 * Smallest size the full layout fits at 100%. Smaller windows zoom the whole
 * UI down instead of switching to the narrow (mobile) layout.
 */
export const baseWindowSize = { width: 900, height: 540 }

const minZoomFactor = 0.6

/**
 * Window size used when no size has been saved yet.
 */
export const defaultWindowSize = { width: 882, height: 545 }

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

/**
 * Last saved window bounds, if they are still on a connected display.
 */
export function getSavedWindowBounds(): Partial<Rectangle> {
  try {
    const bounds = JSON.parse(
      readFileSync(getStateFilePath(), 'utf8'),
    ) as Rectangle
    const isOnScreen = screen.getAllDisplays().some(({ workArea }) => {
      return (
        bounds.x < workArea.x + workArea.width &&
        bounds.x + bounds.width > workArea.x &&
        bounds.y < workArea.y + workArea.height &&
        bounds.y + bounds.height > workArea.y
      )
    })

    if (bounds.width > 0 && bounds.height > 0) {
      return isOnScreen
        ? bounds
        : { width: bounds.width, height: bounds.height }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    //
  }

  return {}
}

/**
 * Scales the UI with the window, and remembers the window size and position.
 */
export function manageWindowState(window: BrowserWindow) {
  const applyZoom = () => {
    const [width, height] = window.getContentSize()
    const factor = Math.min(
      width / baseWindowSize.width,
      height / baseWindowSize.height,
      1,
    )

    window.webContents.setZoomFactor(Math.max(factor, minZoomFactor))
  }

  let saveTimeout: NodeJS.Timeout | undefined
  const saveBounds = () => {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (window.isDestroyed() || window.isMinimized()) {
        return
      }

      try {
        writeFileSync(
          getStateFilePath(),
          JSON.stringify(window.getNormalBounds()),
        )

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        //
      }
    }, 500)
  }

  window.on('resize', applyZoom)
  window.on('resize', saveBounds)
  window.on('move', saveBounds)
  window.webContents.on('did-finish-load', applyZoom)
}
