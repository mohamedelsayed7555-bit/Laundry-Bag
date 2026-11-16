/**
 * Ordering for catalogue names.
 *
 * The item list used to come out in whatever order the database happened to
 * return, which changed between launches and scattered related things: the
 * three rugs sat at the top, the middle and the bottom of the same list with
 * pillows and blankets in between.
 *
 * Sorting by the Arabic alphabet fixes the grouping on its own, because these
 * names lead with the family noun — every بطانية lands beside the others, every
 * سجاد, every لحاف, every مخدة. It also happens to put the small size before the
 * large one, since ص comes before ك.
 *
 * Done by hand rather than through localeCompare: Hermes ships without full
 * ICU on some builds, and a comparator that silently falls back to code-point
 * order would scatter the list again on exactly the phones hardest to test on.
 */

const AR = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'

/** letters that are really the same letter wearing a hat */
const FOLD: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ء': 'ا',
  'ة': 'ه', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و',
}

// a space must sort before any letter so "سجاد شعر" precedes "سجادة صلاة"
const SPACE = '\u0001'
// anything that is not an Arabic letter — digits, latin, brackets — sorts last,
// which keeps "(سعر المتر المربع)" from deciding the order
const OTHER = '\u007f'

/** A string that plain < comparison orders the way an Arabic reader expects. */
export function arabicKey(value: string): string {
  const s = (value ?? '')
    .replace(/[ً-ْـ]/g, '') // diacritics and tatweel
    .trim()
  let out = ''
  for (const raw of s) {
    const ch = FOLD[raw] ?? raw
    const i = AR.indexOf(ch)
    out += i >= 0 ? String.fromCharCode(48 + i) : ch === ' ' ? SPACE : OTHER
  }
  return out
}

/** Comparator for catalogue names; pass straight to Array.prototype.sort. */
export function byArabic(a: string, b: string): number {
  const ka = arabicKey(a)
  const kb = arabicKey(b)
  return ka < kb ? -1 : ka > kb ? 1 : a < b ? -1 : a > b ? 1 : 0
}
