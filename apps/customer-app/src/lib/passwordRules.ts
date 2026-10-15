// Same password rules as the sign-up screen, so changing a password can't make it weaker than signing up allows.
export const PASSWORD_RULES = [
  { key: 'len', labelKey: 'authRuleLength', test: (p: string) => p.length >= 8 },
  { key: 'case', labelKey: 'authRuleCase', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'digit', labelKey: 'authRuleDigit', test: (p: string) => /[0-9]/.test(p) },
  { key: 'symbol', labelKey: 'authRuleSymbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

export function passwordChecks(password: string) {
  return PASSWORD_RULES.map(r => ({ key: r.key, labelKey: r.labelKey, ok: r.test(password) }))
}
