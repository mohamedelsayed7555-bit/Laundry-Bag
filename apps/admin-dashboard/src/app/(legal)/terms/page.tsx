import type { Metadata } from 'next'
import LegalShell, { langFrom, CONTACT_PHONE, type Section } from '../LegalShell'

export const metadata: Metadata = { title: 'Laundry Bag — الشروط والأحكام | Terms' }

const AR: Section[] = [
  { heading: '1. مقدمة', body: [
    'أهلاً بيك في Laundry Bag. الشروط دي بتنظم استخدامك لتطبيق Laundry Bag وخدماتنا. لما تعمل حساب أو تطلب خدمة، تبقى موافق على الشروط دي.',
  ] },
  { heading: '2. الخدمة', body: [
    'بنستلم الهدوم من عنوانك، ونغسلها أو نكويها أو ننضفها تنظيف جاف حسب اللي تختاره، وبنقدم كمان تنظيف السجاد والبطاطين وتنظيف المنازل وبيع بعض المنتجات، وبعدين بنرجّعلك الطلب.',
    'الخدمة متاحة جوه نطاق التوصيل اللي بيظهر في التطبيق. مواعيد الاستلام والتسليم تقريبية، وممكن تتأخر لأسباب خارجة عن إرادتنا زي الزحمة أو الضغط.',
  ] },
  { heading: '3. حسابك', body: [
    'لازم تكون بياناتك صحيحة: الاسم ورقم الموبايل والإيميل والعنوان. كل رقم موبايل ليه حساب واحد بس.',
    'انت مسؤول عن الحفاظ على كلمة السر، وعن أي استخدام لحسابك. لازم يكون سنك 18 سنة أو أكتر عشان تعمل حساب.',
    'تقدر تدخل بحساب جوجل بدل كلمة السر. في الحالة دي استخدامك لحساب جوجل خاضع كمان لشروط جوجل وسياسة الخصوصية بتاعتها، واحنا مش مسؤولين عن أي قيد أو إيقاف يحصل من ناحيتها لحسابك عندهم.',
    'لو دخلت بجوجل، حسابك عندنا مالوش كلمة سر، وبترجعه من جوجل نفسها. ولو بتستخدم كلمة سر، لينك الاسترجاع بيروح لإيميلك المسجّل هو بس.',
    'موظفينا مايقدروش يشوفوا كلمة سرك ولا يحددوها. أي كود استرجاع بيصدره الدعم بيبقى لمرة واحدة ولمدة قصيرة ومسجّل باسم اللي أصدره، وإنت اللي بتحدد كلمة السر الجديدة.',
  ] },
  { heading: '4. الأسعار والدفع', body: [
    'الأسعار المعتمدة هي اللي بتظهر في التطبيق وقت تأكيد الطلب. رسوم التوصيل بتتحسب حسب المسافة بين عنوانك والمغسلة.',
    'تقدر تدفع كاش أو فيزا أو محفظة إلكترونية أو إنستاباي. الدفع الأونلاين بيتم عن طريق Paymob، والطلب المدفوع أونلاين بيتأكد بعد نجاح الدفع.',
    'لو عدّلت الطلب بعد ما دفعت وزادت القطع، هيتطلب منك دفع الفرق بس.',
  ] },
  { heading: '5. الإلغاء', body: [
    'تقدر تلغي الطلب مجاناً قبل ما المندوب يوصل. لو ألغيت بعد وصوله، بتتحسب رسوم التوصيل.',
    'بعد ما المندوب يستلم الهدوم، مينفعش تلغي الطلب من التطبيق. تقدر تتواصل معانا وهنشوف الحل.',
  ] },
  { heading: '6. الباقات والاشتراكات', body: [
    'كل باقة ليها مدة وعدد قطع محدد. القطع اللي ما تستخدمتش بتنتهي مع نهاية مدة الباقة.',
    'لو ألغيت الباقة، المبلغ المدفوع مش بيرجع. تقدر توقف التجديد التلقائي في أي وقت من صفحة الباقات.',
    'لو طلبك فيه قطع أكتر من رصيد باقتك، القطع الزيادة بتتحاسب بالسعر العادي.',
  ] },
  { heading: '7. الكوبونات والهدايا', body: [
    'كوبونات الخصم والهدية الترحيبية ليها شروط بتظهر وقت استخدامها، زي الحد الأدنى للطلب وعدد مرات الاستخدام وتاريخ الانتهاء.',
    'العروض دي مينفعش تتحول لفلوس، ومن حقنا نوقفها أو نعدّلها في أي وقت.',
  ] },
  { heading: '8. الهدوم والمسؤولية', body: [
    'من فضلك فضّي الجيوب قبل التسليم. إحنا مش مسؤولين عن أي حاجة متسابة في الجيوب.',
    'بلّغ المندوب عن أي قطعة حساسة أو محتاجة معاملة خاصة. ممكن يحصل تغيير بسيط في اللون أو المقاس بسبب طبيعة خامة القطعة، وده مش بنتحمل مسؤوليته.',
    'لو قطعة اتلفت أو ضاعت بسبب تقصير مننا، بنعوّضك بمبلغ لحد 10 أضعاف سعر خدمة القطعة دي. لازم تبلّغنا خلال 48 ساعة من استلام الطلب.',
  ] },
  { heading: '9. الاستخدام المقبول', body: [
    'ممنوع استخدام التطبيق في أي حاجة مخالفة للقانون، أو محاولة التلاعب في الأسعار أو الكوبونات أو أنظمة الدفع. من حقنا نوقف أي حساب بيخالف الشروط دي.',
  ] },
  { heading: '10. تعديل الشروط', body: [
    'ممكن نحدّث الشروط دي من وقت للتاني، وهنكتب تاريخ آخر تحديث فوق. استمرارك في استخدام التطبيق بعد التحديث معناه إنك موافق عليه.',
  ] },
  { heading: '11. التواصل', body: [
    `Laundry Bag — موبايل وواتساب: ${CONTACT_PHONE}`,
  ] },
]

const EN: Section[] = [
  { heading: '1. Introduction', body: [
    'Welcome to Laundry Bag. These terms govern your use of the Laundry Bag app and our services. By creating an account or placing an order, you agree to them.',
  ] },
  { heading: '2. The service', body: [
    'We pick up your clothes from your address, wash, iron or dry-clean them as you choose, and deliver them back. We also offer carpet and blanket cleaning, home cleaning, and sell some products.',
    'The service is available within the delivery zone shown in the app. Pickup and delivery times are estimates and may be delayed by factors outside our control, such as traffic or high demand.',
  ] },
  { heading: '3. Your account', body: [
    'Your details must be accurate: name, mobile number, email and address. Each mobile number can have only one account.',
    'You are responsible for keeping your password safe and for any activity on your account. You must be 18 or older to create an account.',
    'You may sign in with a Google account instead of a password. Your use of that account is also governed by Google’s own terms and privacy policy, and we are not responsible for any restriction or suspension Google applies to it.',
    'If you sign in with Google, your account with us has no password and you recover it through Google. If you use a password, the recovery link is sent only to the email registered on your account.',
    'Our staff cannot see or set your password. Any recovery code issued by support is single-use, short-lived and recorded against the member of staff who issued it; you choose the new password yourself.',
  ] },
  { heading: '4. Prices and payment', body: [
    'The prices that apply are the ones shown in the app when you confirm your order. The delivery fee depends on the distance between your address and our laundry.',
    'You can pay by cash, card, mobile wallet or InstaPay. Online payments are processed by Paymob, and an order paid online is confirmed once the payment succeeds.',
    'If you edit an order after paying and add items, you will only be asked to pay the difference.',
  ] },
  { heading: '5. Cancellation', body: [
    'You can cancel for free before the driver arrives. If you cancel after the driver arrives, the delivery fee applies.',
    'Once the driver has collected your clothes, the order can no longer be cancelled in the app. Contact us and we will help.',
  ] },
  { heading: '6. Plans and subscriptions', body: [
    'Each plan has a set duration and number of items. Unused items expire when the plan period ends.',
    'If you cancel a plan, the amount paid is not refunded. You can turn off auto-renew at any time from the plans page.',
    'If an order has more items than your plan balance, the extra items are charged at regular prices.',
  ] },
  { heading: '7. Coupons and gifts', body: [
    'Discount coupons and the welcome gift have conditions shown when you use them, such as a minimum order, usage limits and an expiry date.',
    'These offers cannot be exchanged for cash, and we may change or end them at any time.',
  ] },
  { heading: '8. Your clothes and our liability', body: [
    'Please empty all pockets before handing over your clothes. We are not responsible for items left in pockets.',
    'Tell the driver about any delicate item or one that needs special care. Minor changes in colour or size caused by the fabric itself are not our responsibility.',
    'If an item is damaged or lost through our fault, we will compensate you up to 10 times the service price of that item. You must report it within 48 hours of receiving your order.',
  ] },
  { heading: '9. Acceptable use', body: [
    'Do not use the app for anything unlawful, or try to manipulate prices, coupons or payments. We may suspend any account that breaks these terms.',
  ] },
  { heading: '10. Changes to these terms', body: [
    'We may update these terms from time to time and will show the date of the latest update above. Continuing to use the app after an update means you accept it.',
  ] },
  { heading: '11. Contact', body: [
    `Laundry Bag — phone and WhatsApp: ${CONTACT_PHONE}`,
  ] },
]

export default function TermsPage({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = langFrom(searchParams)
  return (
    <LegalShell
      lang={lang}
      path="/terms"
      title={lang === 'en' ? 'Terms and Conditions' : 'الشروط والأحكام'}
      sections={lang === 'en' ? EN : AR}
    />
  )
}
