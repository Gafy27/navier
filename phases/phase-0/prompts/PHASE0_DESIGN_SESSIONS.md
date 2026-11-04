# Phase 0 design sessions

Filled from `factory/templates/DESIGN_SESSIONS.md`. Each unit ran three passes with the `designer` agent (architecture → program → anexo), each architecture and program followed by fresh `spec-reviewer` rounds (max 3). The owner delegated gate picks and BINDING status (pt151u, 2026-11-04) with the standing factory instruction: "make design phases to add dbos via postgres as the runner replacing temporal ... leave temporal as another runner ... simplify it to the minimum, especially all the things around the main agent workflow"; each design gets independent review rounds, max 3; if not ready after round 3 it is BINDING with the unresolved findings recorded; designs only. Added 2026-11-04: replace Navier's authz with authz-engine (phase 4).

Re-run a pass by pasting its block into a new session. Do not resume an old design chat.

## P0.1 Current-state map of one agent turn — architecture

```
Task: designer, unit P0.1, pass architecture. Write phases/phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.1 Current-state map of one agent turn — program

```
Task: designer, unit P0.1, pass program. Write phases/phase-0/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md from the configured template. Architecture PHASE0_P0.1_CURRENT_STATE_MAP.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.1 Current-state map of one agent turn — anexo

```
Task: designer, unit P0.1, pass anexo. Write phases/phase-0/PHASE0_P0.1_CURRENT_STATE_MAP_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.2 Temporal inventory and what the machinery around it is for — architecture

```
Task: designer, unit P0.2, pass architecture. Write phases/phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.2 Temporal inventory and what the machinery around it is for — program

```
Task: designer, unit P0.2, pass program. Write phases/phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md from the configured template. Architecture PHASE0_P0.2_TEMPORAL_INVENTORY.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.2 Temporal inventory and what the machinery around it is for — anexo

```
Task: designer, unit P0.2, pass anexo. Write phases/phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.3 DBOS fit: each need mapped to a DBOS 5.4.0 API — architecture

```
Task: designer, unit P0.3, pass architecture. Write phases/phase-0/PHASE0_P0.3_DBOS_FIT.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.3 DBOS fit: each need mapped to a DBOS 5.4.0 API — program

```
Task: designer, unit P0.3, pass program. Write phases/phase-0/PHASE0_P0.3_DBOS_FIT_PROGRAM.md from the configured template. Architecture PHASE0_P0.3_DBOS_FIT.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.3 DBOS fit: each need mapped to a DBOS 5.4.0 API — anexo

```
Task: designer, unit P0.3, pass anexo. Write phases/phase-0/PHASE0_P0.3_DBOS_FIT_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.4 Simplification audit of the machinery around the turn workflow — architecture

```
Task: designer, unit P0.4, pass architecture. Write phases/phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.4 Simplification audit of the machinery around the turn workflow — program

```
Task: designer, unit P0.4, pass program. Write phases/phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md from the configured template. Architecture PHASE0_P0.4_SIMPLIFICATION_AUDIT.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P0.4 Simplification audit of the machinery around the turn workflow — anexo

```
Task: designer, unit P0.4, pass anexo. Write phases/phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-0/PHASE0_OVERVIEW.md; phases/phase-0/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```
