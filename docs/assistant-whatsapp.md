# المساعد الآلي للواتساب (assistant-whatsapp)

- **الرابط:** https://assistant-whatsapp-two.vercel.app
  - `/webhook`: نقطة استقبال رسائل Meta.
  - `/admin?key=...`: لوحة المحادثات (المفتاح في ملف الدليل على سطح المكتب).
- **الكود:** `wa/` في بيئة العمل، ونسخة في `Desktop\Kit freelance sites\assistant-whatsapp\`.
  - `lib/bot.js`: النوايا بالفرنسية والدارجة: السعر، الأمثلة، المدة، المراحل، «5» للحديث مع إنسان، الشكر، التحية، القائمة. يتعرف على الدارجة المكتوبة بحروف لاتينية (arabizi).
  - `lib/db.js`: استدعاءات RPC إلى Supabase بالمفتاح العام مع `DB_SECRET`.
  - `api/whatsapp.js`: التحقق من الويبهوك، وتوقيع HMAC (`X-Hub-Signature-256`)، ومنع تكرار الرسائل، والرد عبر Graph v23.0.
- **Supabase:** مشروع `assistant-whatsapp` (eahdciqzdmjfaakzsfml).
  - الدوال: `log_message`، `set_state`، `admin_conversations`، `admin_set_handled`.
  - السر محفوظ في `private.settings`.
- **متغيرات البيئة الموجودة:** WA_VERIFY_TOKEN، ADMIN_KEY، DB_SECRET، SUPABASE_URL، SUPABASE_ANON_KEY، BRAND، DEMO_URL، GRAPH_VERSION.

## الحالة: ينتظر Alice
1. يكمل إعداد Meta حسب الدليل، ويضيف بنفسه في Vercel: WA_TOKEN، WA_PHONE_NUMBER_ID، WA_APP_SECRET.
2. ثم يطلب «redeploy assistant-whatsapp»، فأعيد النشر وأتحقق.

## قيود
- لا إرسال آلي جماعي، ولا انتحال شخصية: الرد على الزبائن الذين يراسلون أولًا فقط.
- الرد يعرّف نفسه بأنه مساعد آلي.
- كل رد مدفوع لـ Meta منذ 1 أكتوبر 2026.
