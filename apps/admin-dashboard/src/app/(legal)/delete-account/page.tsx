import type { Metadata } from 'next'
import LegalShell, { langFrom, CONTACT_PHONE, type Section } from '../LegalShell'

export const metadata: Metadata = { title: 'Laundry Bag — حذف الحساب | Delete account' }

const AR: Section[] = [
  { heading: 'من التطبيق', body: [
    'افتح تطبيق Laundry Bag، وروح البروفايل، وبعدين "تعديل البيانات"، ودوس على "حذف الحساب نهائياً"، وأكّد بـ "احذف حسابي".',
    'حسابك هيتقفل على طول، ومش هتقدر تدخل بيه تاني.',
  ] },
  { heading: 'من غير التطبيق', body: [
    `ابعتلنا واتساب أو كلّمنا على ${CONTACT_PHONE} من رقم الموبايل المسجل في حسابك، وقول إنك عايز تحذف حسابك. هنتأكد إن الرقم بتاعك، وننفذ الطلب.`,
  ] },
  { heading: 'إيه اللي بيتمسح', body: [
    'خلال 30 يوم من الطلب بنمسح اسمك، ورقم موبايلك، وإيميلك، وعناوينك، وصورتك الشخصية، ورمز الإشعارات.',
    'الباقات اللي لسه فيها رصيد بتتلغي، والرصيد مش بيرجع.',
  ] },
  { heading: 'إيه اللي ممكن يفضل', body: [
    'سجل الطلبات والفواتير، من غير ما يكون مربوط ببياناتك الشخصية، للمدة اللي القانون بيطلبها لأغراض محاسبية.',
  ] },
]

const EN: Section[] = [
  { heading: 'From the app', body: [
    'Open the Laundry Bag app, go to your profile, then "Edit Profile", tap "Delete Account Permanently" and confirm with "Delete My Account".',
    'Your account is closed immediately and can no longer be used to sign in.',
  ] },
  { heading: 'Without the app', body: [
    `Call or WhatsApp us at ${CONTACT_PHONE} from the mobile number registered on your account and ask us to delete it. We will confirm the number is yours and process the request.`,
  ] },
  { heading: 'What we delete', body: [
    'Within 30 days of your request we delete your name, mobile number, email, addresses, profile photo and notification token.',
    'Any plan with remaining balance is cancelled, and the balance is not refunded.',
  ] },
  { heading: 'What we may keep', body: [
    'Order and invoice records, no longer linked to your personal details, for as long as the law requires for accounting purposes.',
  ] },
]

export default function DeleteAccountPage({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = langFrom(searchParams)
  return (
    <LegalShell
      lang={lang}
      path="/delete-account"
      title={lang === 'en' ? 'Delete your Laundry Bag account' : 'حذف حساب Laundry Bag'}
      sections={lang === 'en' ? EN : AR}
    />
  )
}
