# فهرس مشاريع Alice — اقرأني أولًا

آخر تحديث: 2026-10-22

## الحسابات والبنية
- **Vercel** — الفريق `team_F7BxKdUFvXI2HkC0v9wrXVO0`. المشاريع: lqta، sites-commerces-maroc، assistant-whatsapp، calcul-trs-mcp، test-claude-alice (تجربة).
- **Supabase** — المنظمة `evzbgaudsxgvgggklsvd`، المنطقة eu-west-3. المشاريع: `lqta` (npfidgwfnyccijfbgekb)، `assistant-whatsapp` (eahdciqzdmjfaakzsfml).
- **موصلات أخرى:** Netlify، Render، Google Drive، calcul-trs (موصل MCP خاص).
- **GitHub:** الحساب `mohcineoffice-create`، والمستودع الخاص `projets-alice` يضم كل المشاريع (الفرع main). تطبيق Claude مثبّت بصلاحية على هذا المستودع فقط. أضِف إليه كل مشروع جديد، ولا تضع فيه أي سر.
- **الحاسوب:** Windows، اسمه «pc». المجلدات الموصولة: Desktop، Documents، Downloads.
- **الأسرار** (رموز، مفاتيح): لا تُكتب هنا أبدًا. توجد في متغيرات البيئة على Vercel، وفي `Desktop\Kit freelance sites\3_Assistant_WhatsApp_Guide.txt` على حاسوبه.

## ملفات المشاريع
- `claude/lqta.md` — تطبيق Lqta (نسخة شبيهة بإنستغرام).
- `claude/sites-commerces.md` — عرض بيع المواقع للمحلات ومواقع الأمثلة.
- `claude/assistant-whatsapp.md` — المساعد الآلي للواتساب.
- `claude/calcul-trs.md` — موصل MCP لحساب TRS، والمنتج TRS المعروض للبيع.
- `claude/outils-pc.md` — أدوات على حاسوبه (المونتاج، تصحيح TP).

## قواعد العمل مع Alice
- اللغة: العربية الفصحى في المحادثة. كل ملف أو منتج بلغة واحدة فقط.
- **الاتفاق الدائم:** قبل إضافة أي أداة أو مهارة، أشرح له: لماذا، ماذا تفعل، إلى ماذا تصل، أين تعمل، الكلفة، الحماية. ثم أنتظر موافقته.
- الموصلات يضيفها هو بنفسه. الرموز السرية يُدخلها هو في Vercel، لا في المحادثة.
- لا أدخل حسابات أشخاص آخرين، ولا أكتب كلمات السر، ولا أتجاوز CAPTCHA، ولا أرسل رسائل باسمه دون موافقة.
- لا أنقل اختصارات سطح المكتب ولا أخفيها (أزعجه ذلك من قبل).

## دروس تقنية مجرّبة (لتجنب تكرار الأخطاء)
- بيئة العمل السحابية لا تصل إلى `*.vercel.app` ولا `*.supabase.co`. للتحقق: `web_fetch_vercel_url`، أو المتصفح، أو device_bash على حاسوبه.
- Vercel: عند إنشاء مشروع عام، اضبط `ssoProtection: null`، وإلا تظهر صفحة دخول للزوار.
- Supabase Auth: لا تستعمل `await` على استدعاءات Supabase داخل `onAuthStateChange` (يتجمد التطبيق). أجّلها بـ `setTimeout(...,0)`.
- Supabase Auth: اضبط Site URL وRedirect URLs قبل الإطلاق، وإلا توجّه روابط التأكيد إلى localhost:3000.
- بريد Supabase المدمج: يرسل لأعضاء الفريق فقط، وبحد ساعي ضيّق (رسالتان تقريبًا). للإنتاج يلزم SMTP خاص.
- حزمة supabase-js 2.45.4 بصيغة UMD: الملف هو `dist/umd/supabase.js` (لا يوجد `supabase.min.js`).
- ffmpeg drawtext: النص الذي فيه `:` أو `%` يُمرَّر عبر `textfile` مع `expansion=none`.
- WhatsApp Cloud API: الرد على كل رسالة مدفوع منذ 1 أكتوبر 2026.
