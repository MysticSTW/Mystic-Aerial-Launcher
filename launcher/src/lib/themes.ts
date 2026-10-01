/**
 * Background themes. The default is the STW world/planet image. To add one,
 * put the image in src/_assets/themes, import it below and add it to the list.
 */

import cannyValley from '../_assets/themes/canny-valley.webp'
import stonewoodStorm from '../_assets/themes/stonewood-storm.webp'
import stormShield from '../_assets/themes/storm-shield.webp'
import worldBackground from '../_assets/themes/world-background.jpg'

export type BackgroundTheme = {
  id: string
  name: string
  url: string
}

const storageKey = 'ui:background-theme'

// Imported (not a "./file" path): a relative path broke on any page other
// than the first one, because the page address changes when navigating.
export const defaultTheme: BackgroundTheme = {
  id: 'world',
  name: 'STW World',
  url: worldBackground,
}

export const backgroundThemes: Array<BackgroundTheme> = [
  { id: 'none', name: 'None', url: '' },
  defaultTheme,
  { id: 'canny-valley', name: 'Canny Valley', url: cannyValley },
  { id: 'storm-shield', name: 'Storm Shield', url: stormShield },
  { id: 'stonewood-storm', name: 'Stonewood Storm', url: stonewoodStorm },
]

export function getSavedThemeId() {
  try {
    return localStorage.getItem(storageKey) ?? defaultTheme.id
  } catch {
    return defaultTheme.id
  }
}

/**
 * Decode every theme image once, so switching is instant and never waits
 * on (or repeats) an image decode.
 */
let preloaded = false

function preloadThemeImages() {
  if (preloaded) {
    return
  }

  preloaded = true

  for (const theme of backgroundThemes) {
    if (!theme.url) {
      continue
    }

    const image = new Image()

    image.src = theme.url
    image.decode?.().catch(() => {})
  }
}

// Fast switching only paints the last pick, once per frame.
let pendingId: string | null = null
let frame: number | null = null

function paint() {
  frame = null

  const theme =
    backgroundThemes.find((item) => item.id === pendingId) ?? defaultTheme
  const image = theme.url ? `url("${theme.url}")` : 'none'
  const current = document.getElementById('app-background')

  if (!current) {
    document.body.style.backgroundImage = image

    return
  }

  // A fresh layer each time: changing the image on the existing layer did
  // not always repaint on screen (None -> STW World stayed blank).
  const next = current.cloneNode(false) as HTMLElement

  next.style.backgroundImage = image
  current.replaceWith(next)
}

export function applyBackgroundTheme(id: string) {
  const theme =
    backgroundThemes.find((item) => item.id === id) ?? defaultTheme

  preloadThemeImages()

  pendingId = theme.id

  if (frame === null) {
    frame = requestAnimationFrame(paint)
  }

  try {
    localStorage.setItem(storageKey, theme.id)
  } catch {
    //
  }

  return theme.id
}
