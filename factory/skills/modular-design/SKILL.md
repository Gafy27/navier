---
name: modular-design
description: >
  MUST load when designing or reviewing a binding design (immediately after
  design-docs). Split a system into modules with few dependencies between
  them. Each module is an interface (what another developer must know to use
  it) and an implementation (how it keeps those promises); the best modules have
  an interface much simpler than their implementation. Deep modules, designing
  methods, information hiding and leakage, somewhat general-purpose interfaces.
  From A Philosophy of Software Design, Ch. 4–6. Trigger: design a unit,
  module boundary, interface, public API, method or function, dependency
  between units, split a crate or service, review a design.
---

# Modular design

**Required read** for any binding design session or spec review: load this skill
right after `design-docs`, before `paths.design_template` or drafting APIs.

The goal is to minimize the dependencies between modules. A module is any code
with an interface and an implementation: a crate, a service, a struct, a single
function. These rules apply at every level.

## Rules

1. **Every dependency is a cost.** If module A changes and B must change to
   match, B depends on A. Arguments are the obvious form; shared formats,
   ordering assumptions, and config keys are subtler forms. Count them.
2. **Interface is everything a caller must know.** Not only the signature: the
   preconditions, errors, side effects, and ordering a caller relies on are part
   of it. The interface says what the module does, not how.
3. **Omit every unimportant detail, and only those.** An interface that
   includes details callers do not need adds cognitive load. An interface that
   omits a detail callers do need causes obscurity: they cannot use the module
   correctly from the interface alone.
4. **Callers read interfaces, never implementations.** A developer in one module
   should need only that module's code plus the interfaces of what it calls. If
   using a module requires reading its internals, the interface is leaking.
5. **Prefer deep modules.** A deep module hides a lot of functionality behind a
   simple interface: it does a lot and asks little of the caller. A balanced
   tree takes a key and a value; rebalancing stays hidden. A shallow module is
   the opposite: its interface is complicated relative to what it does, so
   learning the interface costs as much as learning the internals. Small
   modules tend to be shallow.
6. **Hide design decisions.** Each module encapsulates a few pieces of
   knowledge that are design decisions. That knowledge lives in the
   implementation and does not appear in the interface, so other modules never
   see it. This is the main way to get a deep module. The same knowledge in two
   modules is leakage: a change to that decision changes both. Fix it by
   putting the knowledge in one module — merge the two when they are small and
   exist for that knowledge, or extract a new module only when its interface
   hides the knowledge instead of exposing it.
7. **Put likely changes behind the interface.** A change that leaves the
   interface alone affects no other module. Choose the boundary so the parts
   most likely to change sit inside it.
8. **Make modules somewhat general-purpose.** Whatever the module is — a
   crate, a trait, a type and its methods, or a function — its functionality
   covers today's needs only, but its interface is not tied to today's caller.
   Name and shape it so a second use would fit: `insert(range, text)`, not
   `insert_at_cursor(text)`. "Somewhat" matters: do not add type parameters,
   traits, or options for uses nobody has; that makes today's call harder. This
   is about the shape of the interface, not about Rust generics.
9. **Pull complexity down.** When complexity is unavoidable and it belongs to
   the module's job, handle it inside the module. Do not make callers deal
   with it. A module has more users than developers, so the developers take
   the extra work. A simple interface matters more than a simple
   implementation.
10. **Avoid configuration parameters.** A cache size, a retry count, or a
    timeout that the caller must set moves the decision upward. Before
    exporting one, ask: will a user or a higher module pick a better value
    than this module can? If not, compute it here. A transport can measure
    successful response times and retry at a multiple of that, instead of
    taking a retry interval. When a parameter is justified, compute a default
    so callers set it only in an exceptional case. A required knob with no
    default means the module did not finish the problem.

## Designing methods

When designing methods, the most important goal is to provide clean and simple
abstractions. Each method should do one thing and do it completely. The method
should have a clean and simple interface, so that users do not need to have much
information in their heads in order to use it correctly. The method should be
deep: its interface should be much simpler than its implementation. If a method
has all of these properties, then it probably does not matter whether it is long
or not.

"Method" means a function or an operation on a type; the rules above apply at
that granularity as well as at crate or service scale.

## In a design

- For each module the design names, state its interface (what) apart from its
  implementation (how). The APIs section holds the interface only.
- For each non-trivial method in the APIs section, judge it by **Designing
  methods** above, not by line count.
- List the dependencies between the named modules. Each one should be needed.
- Judge alternatives by what each exposes to callers versus what it hides, and
  by how many modules a likely change would touch.
- Every new configuration parameter answers rule 10 in the design. Name who
  can pick a better value than the module, or compute the default inside.

## Red flags

| Flag | Signal |
|------|--------|
| Information leakage | The same knowledge is used in more than one module, such as two types that both understand one file format. Back-door leakage never appears in an interface, so it is easy to miss |
| Shallow module | The interface is complicated relative to the functionality it provides, so learning the interface costs as much as learning the internals. Small modules tend to be shallow |
| Leaky interface | A caller must know how a module works, not only what it does |
| Interface as large as the implementation | The module hides nothing, so it adds a dependency without removing complexity |
| Change ripples | A likely change to one module forces edits in several others |
| Complexity pushed upward | Callers must pass the same collaborators, hold session or queue state, or repeat an ordering that the module's job already implies |
| Configuration parameter | A knob (cache size, retry count, timeout) that callers must set, when this module could compute a default. Required knobs with no default are an unfinished module |

## Source

[`reference.md`](reference.md) — §4.1 "Modular design", one sentence of §4.2
"Deep modules", the opening of §4.3 "Abstractions", §4.4 "Shallow modules", the opening of Chapter 5 on information hiding, §5.2 "Information leakage", §6.1 "Make classes somewhat general-purpose", and the configuration-parameters example. The book says "class"; these rules apply to any module. The deep-module sentence is the definition those sections use.
