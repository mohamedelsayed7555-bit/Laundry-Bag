import { Linking } from 'react-native'

const LEGAL_BASE_URL = 'https://laundry-bag-admin-dashboard.vercel.app'

export type LegalPage = 'terms' | 'privacy' | 'delete-account'

export function openLegalPage(page: LegalPage, locale: string) {
  Linking.openURL(`${LEGAL_BASE_URL}/${page}${locale === 'en' ? '?lang=en' : ''}`).catch(() => {})
}
