# الرفض التاني — Guideline 5.1.1(v) (28 أكتوبر 2026، build 6)

Apple رفضت لأن التطبيق كان بيطلب تسجيل قبل ما تشوف أي حاجة. المطلوب: الخدمات والأسعار
والباقات تتشاف من غير حساب، والتسجيل يتطلب بس للحاجات اللي محتاجة حساب (الطلب، الاشتراك،
الطلبات، الرسائل).

اللي اتعمل في build 7:
- زرار **"تصفح من غير حساب"** في شاشة الترحيب، يدخل على الرئيسية على طول.
- الزائر يشوف الخدمات والأسعار والعروض والباقات، ويضيف للسلة ويشوف الإجمالي.
- تأكيد الطلب أو الاشتراك أو إضافة عنوان بيطلب تسجيل دخول، والسلة بتفضل بعد الدخول.
- تبويبات الطلبات والرسائل وحسابي بتعرض للزائر شاشة "سجّل دخولك" بزرار دخول.
- Migration `supabase/migrations/20261028_open_catalog_to_visitors.sql` بتفتح قراءة الأسعار
  والباقات وإعدادات معينة للزائر — **لازم تتنفذ على قاعدة البيانات قبل الـ Resubmit**،
  وإلا الزائر هيشوف الأسعار فاضية.

### الرد (Reply to App Review)

```
Hello,

Thank you for the feedback. We have revised the app in build 1.0.0 (7) so that registration is no longer required to use the features that are not account based.

On the first screen, "Browse without an account" opens the app directly. Without signing in, users can browse all services and their prices, view offers and monthly plans with their prices, and add items to the cart to see the order total.

Registration is requested only for features that are account based: placing a pickup order (we need the customer's address and phone number to collect and deliver the laundry), subscribing to a plan, saving addresses, and viewing personal orders and chats with the driver.

The demo account in the Sign-In Information field still works for reviewing the account-based features.

Thank you.
```

### سطر يتضاف أول الـ Notes (App Review Information)

```
NO ACCOUNT NEEDED TO BROWSE: on the first screen tap "Browse without an account" to see services, prices, offers and plans and to fill the cart. Signing in is only asked for when placing an order or subscribing.
```

---

# الرد على رفض Apple — Guideline 2.1 (Information Needed)

الرفض مش بسبب crash ولا كود، Apple طالبة **معلومات + فيديو**. فيه 3 حاجات:

1. **فيديو من موبايل حقيقي** (آخر iOS) — لازم تصوّره إنت، الخطوات تحت في القسم (ج).
2. **الرد** في App Store Connect ← App Review ← Reply to App Review: انسخ القسم (أ) وارفق الفيديو.
3. **Notes** في App Review Information: انسخ القسم (ب)، وصحّح بيانات الـ demo account
   (اللي كانت متسجلة إيميل شخصي وباسورد قديم):
   - User name: `01000000001`
   - Password: الباسورد بتاع حساب المراجعة

وبعدها اختار البناء الجديد (build 6) في نفس النسخة 1.0.0 قبل Resubmit — البناء القديم (1)
فيه مشكلة إن إضافة عنوان على الآيفون مابتشتغلش، يعني المراجع مش هيقدر يعمل طلب.

---

## (أ) Reply to App Review

```
Hello,

Thank you for reviewing Laundry Bag. Please find the requested information below; the same text has been added to the Notes field of App Review Information. A new build (1.0.0, build 6) is attached to this submission and fixes an issue where saving a new address could silently fail on iPhone.

1. Screen recording
Attached: a recording captured on a physical iPhone running the latest iOS. It starts from launching the app and shows sign-up, sign-in, adding a pickup address, placing an order, following the order, messaging the driver, subscribing to a plan, and deleting the account (Profile > Edit Profile > Delete Account Permanently).

2. Purpose and audience
Laundry Bag is the customer app of an on-demand laundry service in New Cairo, Egypt. Households and busy professionals order washing, ironing, dry cleaning, carpet and blanket cleaning and home cleaning; a driver collects the items from their door and brings them back clean. The app shows a clear per-item price before the order is confirmed, tracks the driver live, and lets the customer chat with the driver about the order. It replaces calling a local laundry, guessing the price and waiting without knowing when the driver will arrive.

3. Setup and access
Demo account (customer):
- Phone: 01000000001 (or email: review@laundrybag.app)
- Password: provided in the Sign-In Information field
Steps: open the app > Sign in > enter the phone number and password. Main features: Home tab (services and offers) > choose a service and items > Cart > choose a pickup address and time > Place order. Orders tab shows each order and its live status; Messages tab holds the chat with the driver; Profile > Plans shows monthly plans; Profile > Edit Profile > Delete Account Permanently removes the account.
Note: pickup is available only inside our service zone in New Cairo, Egypt. When adding an address, place the map pin in New Cairo; otherwise the cart explains that the address is outside the service area.
New users can also register with a phone number and password, Sign in with Apple, or Google.

4. External services
- Supabase: authentication, database, realtime order updates, file storage
- Sign in with Apple and Google Sign-In: optional sign-in methods
- Apple Push Notification service (via Expo notifications): order status notifications
- OpenStreetMap tiles, Nominatim and Leaflet: map display and address lookup
- Paymob: optional online card payment through Paymob's hosted payment page (when enabled)
- InstaPay: manual bank transfer inside Egypt
- WhatsApp: customer support link
- Expo EAS: app builds and updates

All payments are for physical laundry services delivered in person outside the app (guideline 3.1.3(e)), so no digital content is sold and In-App Purchase does not apply. Cash on pickup is always available.

5. Regional differences
The app's features and content are identical in all regions. The physical service, pickup and delivery are only offered in New Cairo, Egypt; outside the zone the app works the same but an order cannot be placed for an out-of-zone address.

6. Regulated industry
Laundry and cleaning are not a regulated industry, and the app contains no protected third-party material. We do not hold card data — card payments, when enabled, are entered on Paymob's own page.

Contact: Mohamed Hassan, +201126992465, mohamedelsayed7555@gmail.com

Thank you.
```

---

## (ب) Notes (App Review Information) — أقل من 4000 حرف

```
Laundry Bag is the customer app of an on-demand laundry service in New Cairo, Egypt: customers order washing, ironing, dry cleaning, carpet and home cleaning, a driver collects from their door and brings it back.

DEMO ACCOUNT (customer): phone 01000000001 (or email review@laundrybag.app), password in Sign-In Information. Open the app > Sign in > phone + password.

MAIN FLOW: Home > choose a service and items > Cart > pickup address and time > Place order. Orders tab: live status and driver tracking. Messages tab: chat with the assigned driver (one-to-one, about that order only). Profile > Plans: monthly plans. Profile > Edit Profile > Delete Account Permanently.

SERVICE ZONE: pickup is only offered inside New Cairo, Egypt. When adding an address, place the map pin in New Cairo; an address outside the zone is reported in the cart as outside the service area. Features and content are otherwise identical in every region.

SIGN-IN: phone + password, Sign in with Apple, or Google. Account deletion is in Edit Profile.

PAYMENTS: cash on pickup, InstaPay transfer, or Paymob card page when enabled. All are for physical services delivered outside the app (3.1.3(e)); no digital goods, so no In-App Purchase.

EXTERNAL SERVICES: Supabase (auth, database, realtime, storage), Sign in with Apple, Google Sign-In, APNs via Expo notifications, OpenStreetMap/Nominatim/Leaflet (maps), Paymob (cards), InstaPay, WhatsApp (support), Expo EAS.

Not a regulated industry; no protected third-party content.
```

---

## (ج) الفيديو — صوّره على آيفون حقيقي بآخر iOS

من Control Center ← Screen Recording. لازم يبدأ من **فتح التطبيق** من الشاشة الرئيسية.
خلّيه 2–4 دقايق، من غير قص في النص.

1. افتح Laundry Bag من الـ Home Screen.
2. **التسجيل**: سجّل حساب جديد برقم موبايل وباسورد (رقم تجريبي غير حساب المراجعة).
3. **الحذف**: Profile ← Edit Profile ← Delete Account Permanently ← أكّد. (Apple بتطلب الحذف صراحة)
4. **الدخول**: Sign in بحساب المراجعة `01000000001`.
5. **عنوان**: Profile ← العناوين ← أضف عنوان في القاهرة الجديدة ← احفظ وأكّد. (دي اللي كانت بايظة في build 1)
6. **طلب**: Home ← خدمة ← اختار قطع ← السلة ← العنوان والميعاد ← كاش ← أكّد الطلب.
7. **متابعة**: Orders ← افتح الطلب، وبيّن الحالة والتتبّع.
8. **رسائل**: افتح الشات مع السواق (لو الطلب ليه سواق).
9. **الباقات**: Profile ← Plans ← اعرض الباقات وخطوة الاشتراك (مش لازم تدفع).
10. سجّل خروج.

**قبل التصوير**: اتأكد إن حساب المراجعة فيه عنوان محفوظ جوه القاهرة الجديدة وطلب واحد
على الأقل — المراجع في أمريكا غالباً، ولو العنوان برا المنطقة مش هيقدر يكمّل طلب.
