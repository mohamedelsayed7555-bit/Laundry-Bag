import type { Metadata } from 'next'
import LegalShell, { langFrom, CONTACT_PHONE, type Section } from '../LegalShell'

export const metadata: Metadata = { title: 'Laundry Bag — سياسة الخصوصية | Privacy Policy' }

const AR: Section[] = [
  { heading: '1. مين إحنا', body: [
    'Laundry Bag هي خدمة غسيل وكي باستلام وتوصيل لحد البيت. السياسة دي بتشرح البيانات اللي بنجمعها في التطبيق، وبنستخدمها إزاي، وحقوقك عليها.',
  ] },
  { heading: '2. البيانات اللي بنجمعها', body: [
    'بيانات الحساب: الاسم، ورقم الموبايل، والإيميل، والصورة الشخصية لو رفعتها.',
    'العناوين والموقع: العناوين اللي بتحفظها، وموقعك على الخريطة لما تختار عنوان. بنستخدمهم في تحديد مكان الاستلام وحساب رسوم التوصيل.',
    'الطلبات: القطع والخدمات والأسعار، ومواعيد الاستلام والتسليم، والتقييمات، والرسايل بينك وبين المندوب.',
    'الدفع: طريقة الدفع وحالته. بيانات الكارت أو المحفظة بتدخلها مباشرة عند Paymob، وإحنا مش بنشوفها ولا بنخزنها.',
    'الجهاز: رمز الإشعارات عشان نبعتلك تحديثات طلبك.',
    'البصمة: لو فعّلت الدخول بالبصمة، الموبايل نفسه هو اللي بيتحقق منها. إحنا مش بنوصل للبصمة ولا بنخزنها.',
  ] },
  { heading: '3. بنستخدم البيانات في إيه', body: [
    'تنفيذ طلباتك وتوصيلها، وحساب الأسعار ورسوم التوصيل، وإدارة باقاتك وكوبوناتك.',
    'إننا نبعتلك إشعارات عن حالة الطلب، ونرد عليك في الدعم.',
    'تحسين الخدمة، ومنع الاحتيال وإساءة الاستخدام.',
  ] },
  { heading: '4. مين بيشوف بياناتك', body: [
    'المندوب: بيشوف اسمك ورقمك وعنوانك بس، وده للطلبات المتعيّنة ليه.',
    'Paymob: لمعالجة الدفع الأونلاين.',
    'مزودين الخدمات التقنية اللي بنستخدمهم في الاستضافة وقواعد البيانات والإشعارات، وده في حدود تشغيل الخدمة بس.',
    'إحنا مش بنبيع بياناتك لأي حد. ممكن نفصح عنها لو القانون طلب كده.',
  ] },
  { heading: '5. حماية البيانات', body: [
    'الاتصال بين التطبيق والسيرفر مشفّر، والوصول للبيانات محدود بالصلاحيات: كل عميل بيشوف بياناته هو بس.',
  ] },
  { heading: '6. مدة الاحتفاظ بالبيانات', body: [
    'بنحتفظ ببياناتك طول ما حسابك شغال.',
    'لما تطلب حذف حسابك، بنمسح بياناتك الشخصية خلال 30 يوم. ممكن نحتفظ بسجل الطلبات والفواتير من غير ما يكون مربوط بيك، للمدة اللي القانون بيطلبها.',
  ] },
  { heading: '7. حقوقك', body: [
    'تقدر تشوف بياناتك وتعدّلها من صفحة البروفايل في التطبيق.',
    'تقدر تحذف حسابك في أي وقت. التفاصيل في صفحة "حذف الحساب".',
    'تقدر تقفل الإشعارات من إعدادات الموبايل.',
  ] },
  { heading: '8. الأطفال', body: [
    'الخدمة مش موجهة لأي حد أقل من 18 سنة، ومش بنجمع بيانات عنهم عن قصد.',
  ] },
  { heading: '9. تعديل السياسة', body: [
    'ممكن نحدّث السياسة دي، وهنكتب تاريخ آخر تحديث فوق.',
  ] },
  { heading: '10. التواصل', body: [
    `لأي سؤال عن بياناتك: Laundry Bag — موبايل وواتساب ${CONTACT_PHONE}`,
  ] },
]

const EN: Section[] = [
  { heading: '1. Who we are', body: [
    'Laundry Bag is a laundry and ironing service with pickup and delivery to your door. This policy explains what data we collect in the app, how we use it, and your rights over it.',
  ] },
  { heading: '2. Data we collect', body: [
    'Account details: name, mobile number, email, and a profile photo if you upload one.',
    'Addresses and location: the addresses you save and your location on the map when you pick one. We use them to set the pickup point and calculate the delivery fee.',
    'Orders: items, services and prices, pickup and delivery times, ratings, and messages between you and the driver.',
    'Payments: payment method and status. Card or wallet details are entered directly with Paymob; we never see or store them.',
    'Device: a notification token so we can send you order updates.',
    'Fingerprint: if you turn on fingerprint sign-in, your phone checks it itself. We never access or store your fingerprint.',
  ] },
  { heading: '3. How we use it', body: [
    'To fulfil and deliver your orders, calculate prices and delivery fees, and manage your plans and coupons.',
    'To send you order status notifications and answer support requests.',
    'To improve the service and prevent fraud and abuse.',
  ] },
  { heading: '4. Who can see your data', body: [
    'Drivers: only your name, number and address, for orders assigned to them.',
    'Paymob: to process online payments.',
    'The technical providers we use for hosting, databases and notifications, only as needed to run the service.',
    'We do not sell your data. We may disclose it if required by law.',
  ] },
  { heading: '5. Security', body: [
    'Traffic between the app and our servers is encrypted, and access is restricted so each customer can only see their own data.',
  ] },
  { heading: '6. Retention', body: [
    'We keep your data while your account is active.',
    'When you ask us to delete your account, we delete your personal data within 30 days. We may keep order and invoice records, no longer linked to you, for as long as the law requires.',
  ] },
  { heading: '7. Your rights', body: [
    'You can view and edit your details from the profile page in the app.',
    'You can delete your account at any time. See the "Delete account" page.',
    'You can turn off notifications from your phone settings.',
  ] },
  { heading: '8. Children', body: [
    'The service is not intended for anyone under 18, and we do not knowingly collect their data.',
  ] },
  { heading: '9. Changes to this policy', body: [
    'We may update this policy and will show the date of the latest update above.',
  ] },
  { heading: '10. Contact', body: [
    `For any question about your data: Laundry Bag — phone and WhatsApp ${CONTACT_PHONE}`,
  ] },
]

export default function PrivacyPage({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = langFrom(searchParams)
  return (
    <LegalShell
      lang={lang}
      path="/privacy"
      title={lang === 'en' ? 'Privacy Policy' : 'سياسة الخصوصية'}
      sections={lang === 'en' ? EN : AR}
    />
  )
}
