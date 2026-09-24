# AGENT.md — multi-modal-usecase (GenLayer)

## Tujuan Utama (JANGAN LUPA)
Bangun **SiteVerdict**: performance-based contracting dengan verifikasi foto tugas fisik oleh validator AI GenLayer + cryptographically signed proofs.

Brief resmi: "Integrate real-world images for performance-based contracting, such as verifying the completion of physical tasks, with cryptographically signed proofs."

## Sub-tema Terkunci
**B: Konstruksi / renovasi ONLY** (bukan cleaning). Contoh: pengecatan tembok, pasangan bata/plester, perbaikan atap, instalasi keramik/pipa.
Verifikasi WAJIB before-after: 2 foto (sebelum + sesudah) lokasi sama, progres terlihat, sesuai requirements.

## Arsitektur (disepakati)
- `contracts/site_verdict.py` = Intelligent Contract, class `SiteVerdict`.
  - `create_task(description, requirements)` payable escrow GEN.
  - `submit_proof(task_id, proof_hash, before_hash)` worker upload hash 2 foto.
  - `resolve_task(task_id, before_image, after_image)` AI consensus via `gl.nondet.exec_prompt(images=[before, after])` + `gl.vm.run_nondet_unsafe`.
  - `claim_reward(task_id)` / `refund(task_id)` deterministik setelah verdict.
  - `appeal(task_id)` maksimal 1x.
- Storage: dataclass `Task` (creator, worker, description, requirements, reward_atto u256, status str, proof_hash str, verdict_json str).
- Yang disimpan permanen: hash + verdict + metadata. JANGAN simpan full image bytes permanen (mahal).
- Validator: bandingkan hanya field keputusan (`approved`, confidence toleransi ±15). Abaikan `reasoning`.
- Signed proofs = (1) `gl.message.sender_address` bawaan chain + (2) `proof_hash` SHA256 dari frontend.
- Runner header WAJIB pinned: `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`. DILARANG `test`/`latest`/unversioned.
- Selalu `genvm-lint check` setelah edit kontrak (dengan `$env:GENVM_VERSION="v0.3.0-rc7"` + `$env:PYTHONUTF8="1"` di Windows).

## Status
- [x] Analisis docs GenLayer + image-processing + equivalence principle
- [x] Scaffold work_verifier.py (fokus konstruksi/renovasi, before-after)
- [x] Lint + validate lolos (WorkVerifier, 8 methods: 6 write, 2 view)
- [x] Integration test studionet: 3/3 lolos (create/submit/refund, appeal-guard, full AI before-after APPROVED conf 95 -> PAID)
- [x] Demo live di kontrak persisten (tests/integration/test_demo_live.py): demo-paint-01 APPROVED conf 98 → PAID; demo-roof-01 REJECTED conf 99 → appeal → APPROVED → PAID. Data konsensus nyata: rotasi leader saat gagal, validator 3-4 setuju.
- [x] Struk PAID: jurnal tx localStorage + tombol Download Receipt (data chain + hash/waktu + link explorer, siap print/PDF).
- [x] Kontrak v2 staff-review hardened (hash binding, dual-confirm, baseline, appeal worker-only + histori, recovery tanpa clock, settlement guards).
- [x] Fix "No account set": client tulis diikat ke provider + alamat dompet terpilih (viem butuh account eksplisit).
- [x] Rebrand SiteVerdict + pemisahan peran + worker kosong (zero address). Test 3 peran 8/8, demo 2 peran lolos. Deploy final: 0xc80f0F6999Ce85f64c74Cc6667Fc2C77C4d8E79F.
