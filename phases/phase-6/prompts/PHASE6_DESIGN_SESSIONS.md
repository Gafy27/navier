# Phase 6 design sessions

Filled from `factory/templates/DESIGN_SESSIONS.md`. Each unit ran three passes with the `designer` agent (architecture → program → anexo), each architecture and program followed by fresh `spec-reviewer` rounds (max 3). The owner delegated gate picks and BINDING status (pt151u, 2026-11-04) with the standing factory instruction: "make design phases to add dbos via postgres as the runner replacing temporal ... leave temporal as another runner ... simplify it to the minimum, especially all the things around the main agent workflow"; each design gets independent review rounds, max 3; if not ready after round 3 it is BINDING with the unresolved findings recorded; designs only. Added 2026-11-04: replace Navier's authz with authz-engine (phase 4).

Re-run a pass by pasting its block into a new session. Do not resume an old design chat.

## P6.1 Worker deployment and lifecycle — architecture

```
Task: designer, unit P6.1, pass architecture. Write phases/phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.1 Worker deployment and lifecycle — program

```
Task: designer, unit P6.1, pass program. Write phases/phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM.md from the configured template. Architecture PHASE6_P6.1_WORKER_DEPLOYMENT.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.1 Worker deployment and lifecycle — anexo

```
Task: designer, unit P6.1, pass anexo. Write phases/phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.2 Queues, partitions and sizing — architecture

```
Task: designer, unit P6.2, pass architecture. Write phases/phase-6/PHASE6_P6.2_SCALING_QUEUES.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.2 Queues, partitions and sizing — program

```
Task: designer, unit P6.2, pass program. Write phases/phase-6/PHASE6_P6.2_SCALING_QUEUES_PROGRAM.md from the configured template. Architecture PHASE6_P6.2_SCALING_QUEUES.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.2 Queues, partitions and sizing — anexo

```
Task: designer, unit P6.2, pass anexo. Write phases/phase-6/PHASE6_P6.2_SCALING_QUEUES_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.3 Traces, metrics and alerts — architecture

```
Task: designer, unit P6.3, pass architecture. Write phases/phase-6/PHASE6_P6.3_OBSERVABILITY.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.3 Traces, metrics and alerts — program

```
Task: designer, unit P6.3, pass program. Write phases/phase-6/PHASE6_P6.3_OBSERVABILITY_PROGRAM.md from the configured template. Architecture PHASE6_P6.3_OBSERVABILITY.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.3 Traces, metrics and alerts — anexo

```
Task: designer, unit P6.3, pass anexo. Write phases/phase-6/PHASE6_P6.3_OBSERVABILITY_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.4 Failure-mode table — architecture

```
Task: designer, unit P6.4, pass architecture. Write phases/phase-6/PHASE6_P6.4_FAILURE_MODES.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.4 Failure-mode table — program

```
Task: designer, unit P6.4, pass program. Write phases/phase-6/PHASE6_P6.4_FAILURE_MODES_PROGRAM.md from the configured template. Architecture PHASE6_P6.4_FAILURE_MODES.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.4 Failure-mode table — anexo

```
Task: designer, unit P6.4, pass anexo. Write phases/phase-6/PHASE6_P6.4_FAILURE_MODES_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.5 Load and chaos tests — architecture

```
Task: designer, unit P6.5, pass architecture. Write phases/phase-6/PHASE6_P6.5_LOAD_CHAOS.md from the configured template.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.5 Load and chaos tests — program

```
Task: designer, unit P6.5, pass program. Write phases/phase-6/PHASE6_P6.5_LOAD_CHAOS_PROGRAM.md from the configured template. Architecture PHASE6_P6.5_LOAD_CHAOS.md is BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: artifact on disk, registered in the phase README file table, handed to spec-reviewer (architecture/program).
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```

## P6.5 Load and chaos tests — anexo

```
Task: designer, unit P6.5, pass anexo. Write phases/phase-6/PHASE6_P6.5_LOAD_CHAOS_TICKETS.md from the configured template. Architecture and program are BINDING.
Read: skills design-docs then modular-design (full); the template; README.md (product contract, wins);
factory/profile/navier_dbos/layering.md; phases/phase-6/PHASE6_OVERVIEW.md; phases/phase-6/indexing/README.md;
the sibling BINDING specs cited in Depends on (slices only).
Gates: delegated (pt151u). Record picks as 'delegated to designer (pt151u), recommend-A'; list top gates in the phase README.
Done means: anexo on disk with SESSION blocks; parent runs bundle-session --all.
Do not: write product code, review your own work, edit /workspace/attach/navier, or change owner decisions (profile requirements).
```
