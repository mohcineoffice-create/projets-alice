# conseil (connecteur MCP) — notes

- Projet Vercel : conseil-alice (prj_240EVvZFQZ51wo9KO0xLYAN7vehu), racine `conseil`, URL de base https://conseil-alice.vercel.app/mcp/<jeton> (jeton dans MCP_TOKEN, jamais écrit ici).
- Outils : `consulter_gemini(message, historique?)`, `modeles_gemini()`.
- Variables Vercel : MCP_TOKEN (fait), GEMINI_API_KEY (à créer par Alice), GEMINI_MODEL (facultatif, défaut gemini-3.8-flash).
- Garde-fou : refuse d'envoyer clés, e-mails, téléphones à Google.
- Test du 23/10/2026 : mauvais jeton → 404, bon jeton → 405 en GET. Test d'un vrai appel Gemini : en attente de la clé.
