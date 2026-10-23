# Vultr Agent Rush Hackathon — Project brief (team Kenitra Agents)

Build window: Nov 3–8, 2026 (online). Team page: https://lablab.ai/ai-hackathons/vultr-hackathon/kenitra-agents
Track: 02 "Powering the Future of Work" — Sales Operations (fallback: 01 "Blast Radius Zero").

## 0. Official facts (from the challenge page, read Oct 23, 2026)
- **Schedule (UTC):** kickoff Nov 3 16:00 · Discord Q&A Nov 3 17:00 · submissions close Nov 8 23:00.
- **Teams:** 1–6 people.
- **Credits:** $200 Vultr credit, given as a gift code at kickoff, applied at https://console.vultr.com/billing/?promo=HACKATHON. The account email must never have been used on Vultr before (ours is new, verified, $0 owed).
- **Challenge 2 requirements:** backend on a Vultr VM + a web deployment, with Vultr as the central orchestration layer. Vultr Serverless Inference is optional (but helps the "Application of Technology" score). No Vultr GPUs.
- **Challenge 1 requirements (fallback):** Serverless Inference + an agent sandbox (Docker, or OpenSandbox / gVisor / E2B / Microsandbox).
- **Rules:** original work, MIT-compatible licence for the public repo.
- **Judging:** Application of Technology · Presentation · Business Value · Originality.
- **Prizes:** 1st $5,000 + $3k credits · 2nd $3,000 + $1k · 3rd $1,000 + $1k.
- **Serverless Inference:** OpenAI-compatible API at https://api.vultrinference.com/v1 (model list at /v1/models). The list seen on Oct 23 includes chat models with tool calling and long context (e.g. DeepSeek V4.1 Flash, 1M tokens), rerankers, decision models, and multilingual text-to-speech (e.g. Chatterbox, 23 languages). Re-check the list at kickoff.
- **Resources:**
  - Inference provisioning: https://docs.vultr.com/products/serverless/inference/provisioning
  - Agent sandboxing with Microsandbox (microVMs on KVM, VX1 instance, Ubuntu 24.04): https://docs.vultr.com/how-to-set-up-agent-sandboxing-on-vultr-cloud-compute
  - Supabase on Vultr / Coolify on Vultr deployment guides (linked from the challenge page)
  - API reference: https://www.vultr.com/api/

## 1. One-line pitch
**ShopScout** — an AI sales agent that finds local businesses with no website, proves it with a sandboxed browser, builds each one a personalized demo site, and drafts the outreach message — a human approves every send.

## 2. Problem (real, tested)
- In Moroccan cities most small shops (restaurants, cafés, salons, clinics) have no website; freelancers who sell sites waste hours finding leads and pitching with generic examples.
- Tested on Oct 23, 2026 in Kénitra: 43 restaurants without a listed website found on the map; 6 personalized demo sites generated; 2 WhatsApp pitches sent; 1 number turned out not to be on WhatsApp (the agent must handle this).

## 3. Agent workflow (multi-step, verifiable)
1. **Plan** — user gives city + business type ("restaurants in Kénitra").
2. **Discover** — OpenStreetMap (Nominatim/Overpass): name, address, phone, coordinates, website tag.
3. **Verify in sandbox** — headless Chromium inside an isolated sandbox on Vultr: search the business, check whether a website exists, screenshot evidence; destroy the sandbox after each task.
4. **Score** — lead score (no site + mobile phone + opening hours known = high); reranker can order leads.
5. **Generate** — personalized demo site from verified public data only (name, address, phone, map, hours); menu shown as labelled examples; "unofficial mock-up" banner; noindex.
6. **Draft outreach** — message in the right language (Darija/French/English) with the demo link; optional voice note via Vultr TTS.
7. **Human-in-the-loop** — dashboard: approve / edit / reject each message; nothing is sent automatically.
8. **Track** — status per lead (sent, replied, not on WhatsApp, visit needed).

## 4. Architecture on Vultr
- **Vultr VM (VX1, Ubuntu 24.04)** — control layer: web app (dashboard) + API + job queue + SQLite/Postgres. This satisfies "Vultr as central orchestration".
- **Sandbox runner** — preferred: **Microsandbox** (each browser task in its own microVM with a separate kernel, CPU/memory caps, sandboxes cannot reach each other, Python SDK). Fallback: Docker with limits. No secrets inside sandboxes; egress limited to public sites (block private IP ranges — reuse the SSRF guard idea from navigateur-cloud).
- **Vultr Serverless Inference** — planning, lead-score explanations, message drafting (tool-calling chat model); TTS for optional voice notes.
- **Static demo sites** served from the VM under /demo/<slug> (noindex).
- Reusable ideas already written privately: SSRF guard + Chromium tool code (navigateur-cloud), OSM search with Nominatim fallback (gps), demo-site generator (propositions). The public repo is rewritten cleanly during the event, MIT licence, no secrets.

## 5. "Containment moment" for the video
Show a lead whose page tries something unsafe (e.g. redirect to an internal IP or a huge download) → the sandbox blocks it, the microVM is destroyed, the agent logs the event and continues.

## 6. Build plan
- **Before Nov 3 (no paid resources):** finalize architecture diagram, slide outline, video script, repo skeleton locally; read the Microsandbox guide; list exact inference models to use.
- **Day 1 (Nov 3, kickoff 16:00 UTC):** apply gift code, attend Discord Q&A 17:00 UTC, set a billing alert, create the VX1 VM, install Microsandbox (`msb doctor`), repo skeleton, health checks.
- **Day 2:** discovery (OSM) + verification (sandboxed Chromium + screenshots).
- **Day 3:** lead scoring + demo-site generator + outreach drafts (Serverless Inference).
- **Day 4:** dashboard with approve/edit/reject, status tracking, containment logs.
- **Day 5:** end-to-end run on a real city, polish, README with architecture diagram.
- **Day 6 (Nov 8, before 23:00 UTC):** 3-min video (English), slides PDF, submission form, final checks. Shut down paid resources after judging.

## 7. Submission checklist
- [ ] Public GitHub repo (MIT licence, README, setup, architecture)
- [ ] Live URL on Vultr
- [ ] Video MP4 (< 3–5 min, English) incl. one containment moment
- [ ] Slides PDF (problem, solution, demo, architecture, business value, next steps)
- [ ] Clear use-case explanation; tags; cover image 16:9

## 8. Judging angles
- Business value: real freelancers/agencies; tested with real shops; human approval keeps outreach ethical.
- Application of technology: Vultr VM orchestration + Serverless Inference + microVM sandboxes; real executed work with verifiable evidence (screenshots); multi-step agent.
- Originality: local-market focus (Morocco, Darija), proof-based leads instead of scraped lists.
- Presentation: live demo on a real city.

## 9. Status (Oct 23, 2026) — start here in a new conversation
- Decision: keep ShopScout in Track 02 (Sales Operations). Alternative discussed and not chosen: a sandboxed-browser MCP tool for any AI in Track 01.
- Slide deck (English, 12 slides, speaker notes = video narration): https://claude.ai/artifact/DL4BNGqWKHRYmJqhEC6jhi
  - Placeholders to fill: monthly prices for freelancers/agencies (Alice decides), dashboard screenshot, live URL, GitHub link (after Nov 3).
- Honest outlook given to Alice: top 10 plausible if fully built and working; top 3 possible but well under 50 %; main risk = Claude subscription ending at month-end, before kickoff.
- Next steps: lablab project card text (short + long description, tags), 16:9 cover image, architecture diagram for README, repo skeleton (MIT) prepared locally — no paid Vultr resources before the gift code.

## 10. Open points
- Do not deploy any server before the gift code is applied (avoid charges on the card).
- Set a low billing alert (e.g. $5) right after applying the credit.
- Confirm at kickoff that VX1 instances support KVM for Microsandbox; otherwise use Docker + gVisor.
