# calcul-trs — موصل MCP لحساب TRS/OEE، والمنتج TRS

## الموصل
- **الرابط:** https://calcul-trs-mcp.vercel.app/mcp/<الرمز> — مشروع Vercel `calcul-trs-mcp`. الرمز في متغير البيئة `MCP_TOKEN`، وفي إعدادات الموصل على claude.ai.
- **الكود:** `calcul-trs/api/mcp.js`. خادم JSON-RPC عبر HTTP، بلا حالة، والإصدارات المدعومة: 2025-06-18، 2025-03-26، 2024-11-05.
- **الأداة:** `calculer_trs`.
  - المدخلات: temps_ouverture_min، arrets_min، cadence_theorique_pph، pieces_produites، pieces_bonnes.
  - المخرجات: الإتاحة، والأداء، والجودة، وTRS، والخسائر.
- **نموذج يُعاد استعماله:** هذا القالب نفسه يصلح لأي موصل MCP جديد.

## المنتج للبيع
- **المكان:** `Desktop\Produit TRS a vendre`. الملفات: لوحة TRS بصيغة xlsx، وصورة معاينة، وورقة البيع.
- **قاعدة حساب:** الجودة الإجمالية موزونة بالوقت، حتى يتحقق D×P×Q = TRS.
- **الكود:** `trs/build_xlsx.py` (openpyxl، ثم إعادة الحساب بـ LibreOffice).
