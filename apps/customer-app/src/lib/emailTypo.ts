/**
 * Catches a mistyped e-mail domain before it becomes an unrecoverable account.
 *
 * The e-mail is the customer's only way back in if he forgets his password, and a typo
 * is silent: he signs up fine, and only finds out months later when the recovery link
 * goes nowhere. So we check the domain against the handful of providers people here
 * actually use, and offer a correction he can accept with one tap.
 */

const KNOWN_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'live.com',
  'msn.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'yandex.com',
]

/** Classic Levenshtein; the inputs are domain names, so the cost is irrelevant. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const previousDiagonal = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,                                        // deletion
        prev[j - 1] + 1,                                    // insertion
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),         // substitution
      )
      diagonal = previousDiagonal
    }
  }
  return prev[b.length]
}

/**
 * Returns a corrected address, or null when there is nothing to suggest — either the
 * domain is already known, or it is too far from any of them to guess at.
 */
export function suggestEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!domain.includes('.')) return null
  // A domain we know is correct by definition, and company domains are left alone.
  if (KNOWN_DOMAINS.includes(domain)) return null

  let best: string | null = null
  let bestDistance = Infinity
  for (const candidate of KNOWN_DOMAINS) {
    const distance = editDistance(domain, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  // One or two edits away is a typo. Further than that is somebody's own domain, and
  // guessing at it would be worse than saying nothing.
  if (!best || bestDistance > 2) return null
  return `${local}@${best}`
}
