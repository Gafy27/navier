# Phase 7 design sessions

Filled from `factory/templates/DESIGN_SESSIONS.md`. Each unit ran three passes with the `designer` agent (architecture → program → anexo), each architecture and program followed by fresh `spec-reviewer` rounds (max 3). The owner delegated gate picks and BINDING status (pt151u, 2026-11-04) with the standing factory instruction: "make design phases to add dbos via postgres as the runner replacing temporal ... leave temporal as another runner ... simplify it to the minimum, especially all the things around the main agent workflow"; each design gets independent review rounds, max 3; if not ready after round 3 it is BINDING with the unresolved findings recorded; designs only. Added 2026-11-04: replace Navier's authz with authz-engine (phase 4).

Re-run a pass by pasting its block into a new session. Do not resume an old design chat.

## P7.1 DBOS test matrix — architecture

```
Task: designer, unit P7.1, pass architecture. Write phases/phase-7/PHASE7_P7.1_TEST_MATRIX.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.1 DBOS test matrix — program

```
Task: designer, unit P7.1, pass program. Write phases/phase-7/PHASE7_P7.1_TEST_MATRIX_PROGRAM.md from the configured template. Architecture PHASE7_P7.1_TEST_MATRIX.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.1 DBOS test matrix — anexo

```
Task: designer, unit P7.1, pass anexo. Write phases/phase-7/PHASE7_P7.1_TEST_MATRIX_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.2 Security review — architecture

```
Task: designer, unit P7.2, pass architecture. Write phases/phase-7/PHASE7_P7.2_SECURITY_REVIEW.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.2 Security review — program

```
Task: designer, unit P7.2, pass program. Write phases/phase-7/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md from the configured template. Architecture PHASE7_P7.2_SECURITY_REVIEW.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.2 Security review — anexo

```
Task: designer, unit P7.2, pass anexo. Write phases/phase-7/PHASE7_P7.2_SECURITY_REVIEW_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.3 Open-source readiness — architecture

```
Task: designer, unit P7.3, pass architecture. Write phases/phase-7/PHASE7_P7.3_OSS_READINESS.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.3 Open-source readiness — program

```
Task: designer, unit P7.3, pass program. Write phases/phase-7/PHASE7_P7.3_OSS_READINESS_PROGRAM.md from the configured template. Architecture PHASE7_P7.3_OSS_READINESS.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.3 Open-source readiness — anexo

```
Task: designer, unit P7.3, pass anexo. Write phases/phase-7/PHASE7_P7.3_OSS_READINESS_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.4 Temporal retirement and dead-code removal — architecture

```
Task: designer, unit P7.4, pass architecture. Write phases/phase-7/PHASE7_P7.4_DEAD_CODE.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.4 Temporal retirement and dead-code removal — program

```
Task: designer, unit P7.4, pass program. Write phases/phase-7/PHASE7_P7.4_DEAD_CODE_PROGRAM.md from the configured template. Architecture PHASE7_P7.4_DEAD_CODE.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P7.4 Temporal retirement and dead-code removal — anexo

```
Task: designer, unit P7.4, pass anexo. Write phases/phase-7/PHASE7_P7.4_DEAD_CODE_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-7/PHASE7_OVERVIEW.md; phases/phase-7/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```
