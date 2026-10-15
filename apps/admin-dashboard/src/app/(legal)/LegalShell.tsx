import Link from 'next/link'

export type Lang = 'ar' | 'en'
export type Section = { heading: string; body: string[] }

export const CONTACT_PHONE = '01002438847'
export const LAST_UPDATED = { ar: 'آخر تحديث: 15 أكتوبر 2026', en: 'Last updated: October 15, 2026' }

const NAV: { href: string; ar: string; en: string }[] = [
  { href: '/terms', ar: 'الشروط والأحكام', en: 'Terms' },
  { href: '/privacy', ar: 'سياسة الخصوصية', en: 'Privacy' },
  { href: '/delete-account', ar: 'حذف الحساب', en: 'Delete account' },
]

export function langFrom(searchParams: { lang?: string | string[] }): Lang {
  return searchParams.lang === 'en' ? 'en' : 'ar'
}

export default function LegalShell({ lang, path, title, sections }: { lang: Lang; path: string; title: string; sections: Section[] }) {
  const isEn = lang === 'en'
  return (
    <div dir={isEn ? 'ltr' : 'rtl'} lang={lang} className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="text-lg font-bold text-slate-900" dir="ltr">Laundry <span className="text-sky-600">Bag</span></span>
          <Link
            href={`${path}?lang=${isEn ? 'ar' : 'en'}`}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
          >
            {isEn ? 'العربية' : 'English'}
          </Link>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-4 overflow-x-auto px-4 pb-3 text-sm">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={`${n.href}?lang=${lang}`}
              className={n.href === path ? 'font-semibold text-sky-700' : 'text-slate-500 hover:text-slate-800'}
            >
              {isEn ? n.en : n.ar}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{isEn ? LAST_UPDATED.en : LAST_UPDATED.ar}</p>

        <div className="mt-8 space-y-7">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-slate-900">{s.heading}</h2>
              <div className="mt-2 space-y-2 leading-8 text-slate-700">
                {s.body.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          {isEn ? 'Questions? Call or WhatsApp us at ' : 'عندك سؤال؟ كلّمنا أو ابعتلنا واتساب على '}
          <a href={`tel:${CONTACT_PHONE}`} className="font-medium text-sky-700" dir="ltr">{CONTACT_PHONE}</a>
        </footer>
      </main>
    </div>
  )
}
