# Canonical evidence bundles

Each folder holds the EXACT bytes behind a known submission: `before.png`,
`after.png`, and their SHA-256 in `hashes.json`.

Small files pass through the app byte-identical (no re-encoding), so any
wallet on any browser that submits these files commits exactly these hashes.
No photo infrastructure needed to reproduce any flow below.

## Reproducible separate-wallet flow (studionet)

Two browser profiles: **A** (client, e.g. MetaMask) and **B** (worker,
e.g. Rabby). Same files from `evidence/demo-paint/`.

1. **A** posts a job: code `evinice-pack-01`, any description and criteria,
   wage `2`. No baseline needed for this replay.
2. **B** opens the job, presses Join Job.
3. **A** presses Approve Worker.
4. **B** selects `before.png` + `after.png`, presses Submit Photo Proof,
   then presses Download Evidence Pack and sends `evidence-evinice-pack-01.json`
   to **A** through any channel.
5. **A** imports the pack in the SUBMITTED notice, inspects both photos in
   the comparison slider, then presses Confirm Evidence.
6. Anyone presses Request AI Verification: either re-select the two files
   or import the same pack, then resolve. Expected: APPROVED, confidence
   above 80.
7. **B** presses Claim Wage. Status PAID. Download Receipt works.

To replay the reject path, submit `before.png` twice (no visible change):
expect REJECTED, then appeal with the real pair.
