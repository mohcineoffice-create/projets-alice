# Lqta — تطبيق مشاركة الصور (شبيه بإنستغرام)

- **الرابط:** https://lqta.vercel.app — مشروع Vercel `lqta` (prj_FSNIuzYi91YpXBZY0vD3i8xJAI38).
- **الكود:** ملف واحد `index.html` (واجهة بالفرنسية). نسخة قديمة في `Desktop\Lqta app\index.html` (بلا ميزة استرجاع كلمة السر).
- **Supabase:** مشروع `lqta` (npfidgwfnyccijfbgekb)، يُستعمل بالمفتاح العام (publishable).
- **المكتبة:** supabase-js 2.45.4 من jsdelivr (`dist/umd/supabase.js`).

## الصفحات (روابط hash)
`#/` الصفحة الرئيسية للمتابَعين · `#/decouvrir?c=` اكتشاف حسب الفئة · `#/publier` نشر · `#/modifier` تعديل الملف الشخصي · `#/connexion?m=signup` الدخول والتسجيل · `#/p/:id` منشور · `#/u/:username` ملف شخصي.

## الميزات
- منشورات بصورة، تُصغَّر في المتصفح إلى 1080px بصيغة JPEG، وتُرفع إلى `photos/<uid>/...`.
- الإعجاب (فوري قبل رد الخادم)، والتعليقات، والمتابعة، وفئات الاكتشاف.
- التبليغ بأسباب محددة: عند 3 تبليغات يُخفى المنشور تلقائيًا.
- عبارة «Vous avez tout vu» حين يصل المستخدم إلى آخر ما لم يره.
- استرجاع كلمة السر: `resetPasswordForEmail` ثم `pageNewPassword`.

## قاعدة البيانات
- **الجداول:** profiles، posts، likes، comments، follows، reports. RLS مفعّل على كل الجداول.
- **المشغّلات (Triggers):**
  - `handle_new_user`: ينشئ الملف الشخصي عند التسجيل.
  - `protect_hidden`: يمنع المستخدم من تعديل حقل الإخفاء ومسار الصورة.
  - `auto_hide`: يخفي المنشور عند 3 تبليغات.
- **العرض:** `posts_feed` (security_invoker)، ويضم عدد الإعجابات وعدد التعليقات.
- **مخزن الصور:** `photos` عام، الحد 3MB، الصيغ jpeg/png/webp، والرفع والحذف في مجلد المستخدم فقط.
- **المستخدمون:** mohcine (Alice نفسه)، وdouaa.rami. لا ندخل حساب douaa أبدًا.

## مهام معلقة
1. إيقاف «Confirm email»، وضبط Site URL إلى `https://lqta.vercel.app`، وRedirect URLs إلى `https://lqta.vercel.app/**`. يتم من لوحة Supabase: يسجّل Alice الدخول بنفسه، وأغيّر أنا الإعداد بموافقته.
2. تقوية الأمان، تنتظر موافقته:
   - حدود لعدد العمليات (rate limits).
   - تجاهل تبليغات الحسابات التي عمرها أقل من 24 ساعة، ورفع حد الإخفاء إلى 5.
   - صفحة إدارة.
   - SRI وCSP.
   - ربط `image_path` بمجلد صاحب المنشور.
   - تفعيل الحماية من كلمات السر المسرّبة.
3. ميزة الرسائل الخاصة: اقتُرحت ولم تُعتمد.
