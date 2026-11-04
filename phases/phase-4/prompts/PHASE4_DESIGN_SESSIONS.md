# Phase 4 design sessions

Filled from `factory/templates/DESIGN_SESSIONS.md`. Each unit ran three passes with the `designer` agent (architecture → program → anexo), each architecture and program followed by fresh `spec-reviewer` rounds (max 3). The owner delegated gate picks and BINDING status (pt151u, 2026-11-04) with the standing factory instruction: "make design phases to add dbos via postgres as the runner replacing temporal ... leave temporal as another runner ... simplify it to the minimum, especially all the things around the main agent workflow"; each design gets independent review rounds, max 3; if not ready after round 3 it is BINDING with the unresolved findings recorded; designs only. Added 2026-11-04: replace Navier's authz with authz-engine (phase 4).

Re-run a pass by pasting its block into a new session. Do not resume an old design chat.

## P4.1 Authz seam and call-site inventory — architecture

```
Task: designer, unit P4.1, pass architecture. Write phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.1 Authz seam and call-site inventory — program

```
Task: designer, unit P4.1, pass program. Write phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md from the configured template. Architecture PHASE4_P4.1_AUTHZ_SEAM.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.1 Authz seam and call-site inventory — anexo

```
Task: designer, unit P4.1, pass anexo. Write phases/phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.2 Navier as an authz-engine model — architecture

```
Task: designer, unit P4.2, pass architecture. Write phases/phase-4/PHASE4_P4.2_NAVIER_MODEL.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.2 Navier as an authz-engine model — program

```
Task: designer, unit P4.2, pass program. Write phases/phase-4/PHASE4_P4.2_NAVIER_MODEL_PROGRAM.md from the configured template. Architecture PHASE4_P4.2_NAVIER_MODEL.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.2 Navier as an authz-engine model — anexo

```
Task: designer, unit P4.2, pass anexo. Write phases/phase-4/PHASE4_P4.2_NAVIER_MODEL_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.3 Identity propagation and checks inside DBOS steps — architecture

```
Task: designer, unit P4.3, pass architecture. Write phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.3 Identity propagation and checks inside DBOS steps — program

```
Task: designer, unit P4.3, pass program. Write phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md from the configured template. Architecture PHASE4_P4.3_WORKFLOW_AUTHZ.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.3 Identity propagation and checks inside DBOS steps — anexo

```
Task: designer, unit P4.3, pass anexo. Write phases/phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.4 Migration and cutover from the old authz service — architecture

```
Task: designer, unit P4.4, pass architecture. Write phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.4 Migration and cutover from the old authz service — program

```
Task: designer, unit P4.4, pass program. Write phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md from the configured template. Architecture PHASE4_P4.4_AUTHZ_CUTOVER.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.4 Migration and cutover from the old authz service — anexo

```
Task: designer, unit P4.4, pass anexo. Write phases/phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.5 Removal of the old gRPC authz client — architecture

```
Task: designer, unit P4.5, pass architecture. Write phases/phase-4/PHASE4_P4.5_GRPC_REMOVAL.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.5 Removal of the old gRPC authz client — program

```
Task: designer, unit P4.5, pass program. Write phases/phase-4/PHASE4_P4.5_GRPC_REMOVAL_PROGRAM.md from the configured template. Architecture PHASE4_P4.5_GRPC_REMOVAL.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P4.5 Removal of the old gRPC authz client — anexo

```
Task: designer, unit P4.5, pass anexo. Write phases/phase-4/PHASE4_P4.5_GRPC_REMOVAL_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-4/PHASE4_OVERVIEW.md; phases/phase-4/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```
