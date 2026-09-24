# SiteVerdict

**Renovation work, settled by photo evidence.**

A client posts a renovation job. A worker proves completion with
before-and-after photos. Independent GenLayer AI validators inspect the pair
and settle the verdict on-chain. No adjuster, no waiting room.

> Multi-modal contracting: verifying completion of physical tasks with
> cryptographically signed proofs.

---

## The loop

```
Client posts job (+ optional baseline photo hash)
        |
Worker submits before + after photos (SHA-256 committed)
        |
Client confirms the evidence
        |
Validators re-run the inspection and must agree
        |
Approved -> worker claims -> PAID + printable receipt
Rejected -> one appeal or client refund
```

## Completion receipt

Every PAID job offers a **Download Receipt** button: company header,
job details, parties, the AI verdict with confidence and reasoning,
per-round evidence history, and a timeline where each step links to its
explorer transaction. Times come from chain blocks (device time is only a
labeled fallback). The transaction journal lives in the browser; verdicts
and hashes always come from the contract.

## Why it holds up

- **Hash-bound evidence.** Both photos are hashed in the browser after a
  1280px downscale. `resolve_task` re-hashes the judged bytes on-chain, so
  substituted photos fail before any AI runs.
- **Split parties.** The client can attest a baseline; the contract rejects
  creator self-submission, so poster and worker are always two wallets.
- **Dual confirmation.** Resolution stays locked until the client confirms
  the submitted evidence.
- **Real consensus.** Leader proposes, every validator re-runs the same
  vision inspection. Decision must match, confidence within 15 points.
  Reasoning text is display-only and never drives state.
- **Appeal with memory.** One worker-only appeal; every round is preserved
  in on-chain evidence history.
- **Recovery without a clock.** Retract, reject, or cancel pre-confirmation.
  No state locks permanently.

## Stack

| Layer | Tech |
|---|---|
| Contract | Python intelligent contract, GenLayer GenVM |
| Tests | `gltest` on studionet, full leader + validator consensus |
| App | Next.js 16, TypeScript, Tailwind v4, genlayer-js 1.1.8 |
| Wallet | EIP-6963 picker (MetaMask, Rabby) |

## Run it

```bash
# Contract checks
genvm-lint check contracts/site_verdict.py
gltest tests/integration/ -v -s --network studionet

# App
cd frontend && npm install && npm run dev
```

## Deploy the app (Vercel)

1. Push this repo to GitHub.
2. Vercel: Add New, Project, import the repo.
3. **Root Directory:** `frontend`. Framework preset: Next.js (auto-detected).
   Build: `npm run build`. No environment variables needed.
4. Open `/console`, connect MetaMask or Rabby, switch to the GenLayer
   Studio network when asked.

Deployed contract (studionet): `0x2Fa0b73B2A61007820947786353480572B3eDB03`

Verify it yourself in the [Studio explorer](https://explorer-studio.genlayer.com/address/0x2Fa0b73B2A61007820947786353480572B3eDB03):
every verdict, appeal, and settlement above is a finalized on-chain transaction.

## Contract API

| Method | Caller | Result |
|---|---|---|
| `create_task(id, description, requirements, reward_atto, baseline_hash)` | client | OPEN |
| `submit_proof(id, proof_hash, before_hash)` | a different wallet | SUBMITTED |
| `confirm_evidence(id)` | client | CONFIRMED |
| `reject_submission(id)` / `retract_proof(id)` | client / worker | back to OPEN |
| `cancel_task(id)` | client, pre-confirm | CANCELLED |
| `resolve_task(id, before_image, after_image)` | anyone, CONFIRMED only | APPROVED / REJECTED |
| `appeal(id, proof_hash, before_hash)` | worker, once | SUBMITTED |
| `claim_reward(id)` | worker, APPROVED only | PAID |
| `refund(id)` | client, REJECTED only | REFUNDED |
| `get_task(id)` / `list_tasks()` | anyone | read |

## Test report

8 integration tests on studionet with real consensus, plus 2 live demo
lifecycles on the deployed contract: approve at confidence 98-100, reject
at 95-100, appeal recovery with 2-round history, rotation recovering a
failed leader. Wrong-state guards cover all 12 methods. See
`tests/integration/`.

## Honest limitations

- **Accounting only, not escrow.** Wages are recorded numbers; no GEN is
  locked or moved. `PAID` authorizes payment off-chain.
- **No on-chain clock** in this runner, so expiry is state-based.
- **Vision variance** on borderline photos; strict pairs decide consistently.
- **Studionet rate limits** (60 req/min shared); the app explains waits.
