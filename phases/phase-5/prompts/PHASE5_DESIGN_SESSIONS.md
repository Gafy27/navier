# Phase 5 design sessions

Filled from `factory/templates/DESIGN_SESSIONS.md`. Each unit ran three passes with the `designer` agent (architecture → program → anexo), each architecture and program followed by fresh `spec-reviewer` rounds (max 3). The owner delegated gate picks and BINDING status (pt151u, 2026-11-04) with the standing factory instruction: "make design phases to add dbos via postgres as the runner replacing temporal ... leave temporal as another runner ... simplify it to the minimum, especially all the things around the main agent workflow"; each design gets independent review rounds, max 3; if not ready after round 3 it is BINDING with the unresolved findings recorded; designs only. Added 2026-11-04: replace Navier's authz with authz-engine (phase 4).

Re-run a pass by pasting its block into a new session. Do not resume an old design chat.

## P5.1 Drain and dual-run — architecture

```
Task: designer, unit P5.1, pass architecture. Write phases/phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.1 Drain and dual-run — program

```
Task: designer, unit P5.1, pass program. Write phases/phase-5/PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM.md from the configured template. Architecture PHASE5_P5.1_DRAIN_DUALRUN.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.1 Drain and dual-run — anexo

```
Task: designer, unit P5.1, pass anexo. Write phases/phase-5/PHASE5_P5.1_DRAIN_DUALRUN_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.2 Rollout flags and order — architecture

```
Task: designer, unit P5.2, pass architecture. Write phases/phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.2 Rollout flags and order — program

```
Task: designer, unit P5.2, pass program. Write phases/phase-5/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM.md from the configured template. Architecture PHASE5_P5.2_ROLLOUT_FLAGS.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.2 Rollout flags and order — anexo

```
Task: designer, unit P5.2, pass anexo. Write phases/phase-5/PHASE5_P5.2_ROLLOUT_FLAGS_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.3 Rollback and compatibility — architecture

```
Task: designer, unit P5.3, pass architecture. Write phases/phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.3 Rollback and compatibility — program

```
Task: designer, unit P5.3, pass program. Write phases/phase-5/PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM.md from the configured template. Architecture PHASE5_P5.3_ROLLBACK_COMPAT.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.3 Rollback and compatibility — anexo

```
Task: designer, unit P5.3, pass anexo. Write phases/phase-5/PHASE5_P5.3_ROLLBACK_COMPAT_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.4 Cutover runbook (runner and authz) — architecture

```
Task: designer, unit P5.4, pass architecture. Write phases/phase-5/PHASE5_P5.4_RUNBOOK.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.4 Cutover runbook (runner and authz) — program

```
Task: designer, unit P5.4, pass program. Write phases/phase-5/PHASE5_P5.4_RUNBOOK_PROGRAM.md from the configured template. Architecture PHASE5_P5.4_RUNBOOK.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P5.4 Cutover runbook (runner and authz) — anexo

```
Task: designer, unit P5.4, pass anexo. Write phases/phase-5/PHASE5_P5.4_RUNBOOK_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-5/PHASE5_OVERVIEW.md; phases/phase-5/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```
