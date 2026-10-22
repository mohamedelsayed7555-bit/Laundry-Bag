import * as Linking from 'expo-linking'

/**
 * Holds the deep link that opened the app.
 *
 * A screen cannot listen for its own link: when the app is already running, Android
 * hands the link to the live window, expo-router reads it and navigates, and the
 * screen only mounts afterwards — by which time the event has been and gone, and
 * getInitialURL() reports nothing because this was not the launch intent. A perfectly
 * valid recovery link therefore looked like no link at all.
 *
 * So the listener is registered here, when the bundle loads, long before any screen
 * exists, and whatever arrives is kept for the screen to collect.
 */

let lastUrl: string | null = null
const waiting = new Set<(url: string) => void>()

function remember(url: string | null) {
  if (!url) return
  lastUrl = url
  for (const fn of waiting) fn(url)
}

Linking.getInitialURL().then(remember).catch(() => {})
Linking.addEventListener('url', ({ url }) => remember(url))

/** The link the app was opened with, if one has arrived yet. */
export function takeIncomingUrl(): string | null {
  return lastUrl
}

/** Called as soon as a link arrives, for a screen that mounted before it did. */
export function onIncomingUrl(fn: (url: string) => void): () => void {
  waiting.add(fn)
  return () => { waiting.delete(fn) }
}
