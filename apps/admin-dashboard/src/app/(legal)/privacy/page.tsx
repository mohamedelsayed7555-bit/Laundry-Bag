import type { Metadata } from 'next'
import LegalShell, { langFrom, CONTACT_PHONE, type Section } from '../LegalShell'

export const metadata: Metadata = { title: 'Laundry Bag — سياسة الخصوصية | Privacy Policy' }

const AR: Section[] = [
  { heading: '1. مين إحنا', body: [
    'Laundry Bag هي خدمة غسيل وكي باستلام وتوصيل لحد البيت. السياسة دي بتشرح البيانات اللي بنجمعها في التطبيق، وبنستخدمها إزاي، وحقوقك عليها.',
  ] },
  { heading: '2. البيانات اللي بنجمعها', body: [
    'بيانات الحساب: الاسم، ورقم الموبايل، والإيميل، والصورة الشخصية لو رفعتها. كلمة السر بتتخزن مشفّرة، ومحدش عندنا يقدر يشوفها.',
    'الدخول بجوجل: لو اخترت تدخل بحساب جوجل، بنستقبل من جوجل اسمك وإيميلك وصورتك ومعرّف حسابك. إحنا مش بنستقبل ولا بنخزن كلمة سر جوجل خالص، والحساب ده مالوش كلمة سر عندنا أصلاً. بنسألك عن رقم موبايلك لأن جوجل مابتديهولناش، وإحنا محتاجينه نستلم منك ونسلّمك.',
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
    'Google: لما تختار الدخول بحساب جوجل، وده للتحقق من هويتك بس.',
    'Supabase: الاستضافة وقاعدة البيانات اللي بيتحفظ عليها حسابك وطلباتك.',
    'Brevo: إرسال الإيميلات، زي رسالة استرجاع الحساب وتأكيد البريد.',
    'Expo: إرسال إشعارات التطبيق لجهازك.',
    'الجهات دي بتعالج البيانات نيابة عننا وللغرض ده بس، ومش مسموح لها تستخدمها في أي حاجة تانية.',
    'إحنا مش بنبيع بياناتك لأي حد. ممكن نفصح عنها لو القانون طلب كده.',
  ] },
  { heading: '5. استرجاع حسابك', body: [
    'لو نسيت كلمة السر، لينك الاسترجاع بيروح لإيميلك المسجّل هو بس، ومينفعش يتوجّه لأي إيميل تاني.',
    'ولو بتدخل بجوجل، مفيش كلمة سر من الأساس — بترجع حسابك من جوجل نفسها.',
    'موظفينا مايقدروش يشوفوا كلمة سرك ولا يحددوها. لو مش قادر توصل لإيميلك، الدعم يقدر يصدرلك كود لمرة واحدة بينتهي بعد مدة قصيرة، وبيتسجّل باسم الموظف اللي أصدره — وإنت لوحدك اللي بتحدد كلمة السر الجديدة من التطبيق.',
    'وفي كل الحالات بيوصلك إشعار أول ما كلمة سرك تتغير.',
  ] },
  { heading: '6. حماية البيانات', body: [
    'الاتصال بين التطبيق والسيرفر مشفّر، والوصول للبيانات محدود بالصلاحيات: كل عميل بيشوف بياناته هو بس.',
  ] },
  { heading: '7. مدة الاحتفاظ بالبيانات', body: [
    'بنحتفظ ببياناتك طول ما حسابك شغال.',
    'لما تطلب حذف حسابك، بنمسح بياناتك الشخصية خلال 30 يوم. ممكن نحتفظ بسجل الطلبات والفواتير من غير ما يكون مربوط بيك، للمدة اللي القانون بيطلبها.',
  ] },
  { heading: '8. حقوقك', body: [
    'تقدر تشوف بياناتك وتعدّلها من صفحة البروفايل في التطبيق.',
    'تقدر تحذف حسابك في أي وقت. التفاصيل في صفحة "حذف الحساب".',
    'تقدر تقفل الإشعارات من إعدادات الموبايل.',
  ] },
  { heading: '9. الأطفال', body: [
    'الخدمة مش موجهة لأي حد أقل من 18 سنة، ومش بنجمع بيانات عنهم عن قصد.',
  ] },
  { heading: '10. تعديل السياسة', body: [
    'ممكن نحدّث السياسة دي، وهنكتب تاريخ آخر تحديث فوق.',
  ] },
  { heading: '11. التواصل', body: [
    `لأي سؤال عن بياناتك: Laundry Bag — موبايل وواتساب ${CONTACT_PHONE}`,
  ] },
]

const EN: Section[] = [
  { heading: '1. Who we are', body: [
    'Laundry Bag is a laundry and ironing service with pickup and delivery to your door. This policy explains what data we collect in the app, how we use it, and your rights over it.',
  ] },
  { heading: '2. Data we collect', body: [
    'Account details: name, mobile number, email, and a profile photo if you upload one. Passwords are stored hashed and nobody here can read them.',
    'Signing in with Google: if you choose Google, we receive your name, email, profile picture and account identifier from Google. We never receive or store your Google password, and such an account has no password with us at all. We ask for your mobile number because Google does not give it to us and we need it to collect and deliver your order.',
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
    'Google: when you choose to sign in with Google, for identity verification only.',
    'Supabase: hosting and the database where your account and orders are stored.',
    'Brevo: email delivery, for account recovery and email confirmation messages.',
    'Expo: delivering app notifications to your device.',
    'These providers process data on our behalf and only for that purpose; they may not use it for anything else.',
    'We do not sell your data. We may disclose it if required by law.',
  ] },
  { heading: '5. Recovering your account', body: [
    'If you forget your password, the recovery link goes only to the email registered on your account, and it cannot be redirected anywhere else.',
    'If you sign in with Google there is no password at all — you recover through Google.',
    'Our staff cannot see or set your password. If you cannot reach your email, support can issue a single-use code that expires after a short time and is recorded against the member of staff who issued it; you alone choose the new password, inside the app.',
    'You are notified whenever your password changes.',
  ] },
  { heading: '6. Security', body: [
    'Traffic between the app and our servers is encrypted, and access is restricted so each customer can only see their own data.',
  ] },
  { heading: '7. Retention', body: [
    'We keep your data while your account is active.',
    'When you ask us to delete your account, we delete your personal data within 30 days. We may keep order and invoice records, no longer linked to you, for as long as the law requires.',
  ] },
  { heading: '8. Your rights', body: [
    'You can view and edit your details from the profile page in the app.',
    'You can delete your account at any time. See the "Delete account" page.',
    'You can turn off notifications from your phone settings.',
  ] },
  { heading: '9. Children', body: [
    'The service is not intended for anyone under 18, and we do not knowingly collect their data.',
  ] },
  { heading: '10. Changes to this policy', body: [
    'We may update this policy and will show the date of the latest update above.',
  ] },
  { heading: '11. Contact', body: [
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
