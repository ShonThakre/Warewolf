# AI Agent Collaboration Workflow

How Claude Code and Cursor Agent work on this repository together without duplicating or conflicting work. Both agents share one working tree in the same Cursor IDE.

Live task status is in [AI-TASK-BOARD.md](./AI-TASK-BOARD.md). The binding short form of these rules is `.cursor/rules/agent-collaboration.mdc` and `.cursor/rules/design-system.mdc`, which both agents load automatically.

---

## 1. Product and stack

A multiplayer Werewolf game. Infection Edition is the default 20-player game. Classic, Expanded, and Custom games run on the same engine through configuration. Design and rules are in [werewolf/implementation-plan.md](./werewolf/implementation-plan.md).

| Layer | Technology |
|---|---|
| Client | React, TypeScript, Vite, React Router, Material UI, Tailwind CSS utilities, Redux Toolkit |
| Game rules | `packages/domain`, pure TypeScript shared by server, client, and simulator |
| Shared schemas | `packages/contracts`, Zod |
| API | NestJS over PostgreSQL with Drizzle ORM |
| Realtime | Socket.IO in the API process |
| Android | Capacitor wrapping the same web client |

The original brief for this workflow listed ASP.NET Core, Entity Framework Core, and SignalR. On 9 November 2026 the product owner chose to keep the TypeScript stack (OD-60), because Phases 1 and 2 and the shared rules package are already built on it. Read "SignalR" in older notes as Socket.IO, and "EF Core" as Drizzle.

---

## 2. Responsibilities

### Claude Code: architecture and engineering lead

Repository architecture, React component architecture, reusable component design, application state (Redux Toolkit), API integration, realtime integration, game state and phase handling, complex gameplay interactions, component composition and data flow, multi-file refactoring, the domain package, the API, the database, contracts, technical documentation, and architecture, performance, and security review.

Claude makes architectural decisions before implementation when they affect several components, and records them in the docs.

### Cursor Agent: UI and visual implementation lead

UI implementation from mockups, responsive CSS, the desktop and landscape layouts, typography and spacing, the color system, MUI styling, Tailwind utilities, illustrations and assets, animation and transitions, player cards and role cards, chat and game panel visuals, visual refinement, browser inspection, viewport testing, and accessibility and interaction polish.

Cursor matches the visual reference while keeping the agreed component architecture.

---

## 3. Choosing the agent for a task

Do not follow an ownership table blindly. Before starting, weigh complexity, number of files, architectural impact, visual complexity, state requirements, existing dependencies, and testing needs.

| Task | Agent |
|---|---|
| Design the reusable `GameLayout` architecture | Claude |
| Implement responsive `GameLayout` styling | Cursor |
| Role-based action rendering architecture | Claude |
| Design and style role action cards | Cursor |
| Redux game state integration | Claude |
| Animated role reveal screen | Cursor |
| Realtime events | Claude |
| Chat UI | Cursor |
| Refactor complex component dependencies | Claude |
| Improve the landscape phone layout | Cursor |
| Game phase transitions | Claude |
| Refine visual hierarchy | Cursor |

A task with both architectural and visual work is split into smaller tasks, each with one owner.

### Who owns which files in `apps/web`

| Area | Owner |
|---|---|
| `src/app/` store setup, `src/api/`, `src/realtime/`, `src/session/`, `src/game/state/` | Claude |
| Hooks, selectors, layout-mode logic, component props and interfaces, fixture projections | Claude |
| `src/theme/`, stylesheets, `sx` and Tailwind classes, `src/assets/`, animation | Cursor |
| Visual markup inside presentational components | Cursor |
| Playwright viewport and visual tests | Cursor |
| A component file that both need, such as `GameLayout.tsx` | Whoever the board assigns for that task. Handed off in sequence, never edited by both at once |

---

## 4. Shared development rules

Both agents:

1. Inspect existing code before changing it, and never assume the other agent finished something without reading the files.
2. Follow the existing architecture unless an improvement is justified and recorded.
3. Read the relevant docs under `docs/werewolf/`.
4. Respect the shared design system.
5. Reuse existing components and avoid duplicate implementations.
6. Avoid unnecessary dependencies.
7. Preserve existing behavior and leave unrelated files alone.
8. Write typed, maintainable React components.
9. Test their changes and update docs when needed.

---

## 5. Task board protocol

The board is [AI-TASK-BOARD.md](./AI-TASK-BOARD.md). Each task has an id, description, agent, status, files expected to change, dependencies, acceptance criteria, and testing requirements.

Statuses: `BACKLOG`, `READY`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `COMPLETED`.

Before modifying files:

1. Read the board.
2. Check that no other `IN_PROGRESS` task lists the same files.
3. Check `git status` and recent changes.
4. Claim the task: set status `IN_PROGRESS` and your agent name.
5. Change only what the task covers.

Two agents never edit the same file at the same time. Overlapping work is a sequential handoff.

---

## 6. Handoff protocol

When Claude finishes engineering work that Cursor builds on, the handoff lists what was implemented, files changed, component interfaces and props, state dependencies, API contracts, styling requirements, and remaining work.

When Cursor finishes visual work, the handoff lists screens implemented, components changed, responsive behavior, screenshots or other visual evidence, known issues, and any architectural change needed.

Handoffs go in the task's entry on the board. The receiving agent reads the actual files before continuing.

---

## 7. UI architecture

One `GameLayout` serves the lobby, night, night results, day, voting, and results. Only the stage content and the enabled actions change. There is no separate desktop and mobile gameplay implementation. The full specification is [werewolf/ui-ux-plan.md](./werewolf/ui-ux-plan.md), sections 3, 4, and 6.

```text
GameLayout
├── TopNavigation (uses GameHeader)
├── GameStatusBar
├── MainGameArea
│   ├── VillageScene
│   ├── PlayerGrid
│   └── PlayerInteraction   (NightActionPanel, VotingPanel, or a result card)
└── DiscussionPanel         (GameEventFeed and the chat composer)
```

The names follow the UI plan. Where this workflow's original brief used other names, they map as follows. Do not create the brief's names as second components.

| Brief name | Component |
|---|---|
| `ChatPanel` | `DiscussionPanel` |
| `RoleActionPanel` | `NightActionPanel`, inside `PlayerInteraction` |
| `GameControls` | The `PlayerInteraction` action row for players, `HostControlPanel` for the host |

---

## 8. Responsive rules

Desktop and landscape phones share one gameplay composition, hierarchy, and interaction model. Use CSS Grid, Flexbox, `clamp()`, fluid type and spacing, aspect ratios, container queries where useful, and adaptive panel sizes.

Priority viewports, with the Playwright project names from the UI plan:

| Viewport | Project |
|---|---|
| 1920 × 1080 | `desktop-fhd` |
| 1440 × 900 | `desktop-wide` |
| 1024 × 768 | `tablet-land` |
| 915 × 412 | `phone-land-lg` |
| 844 × 390 | `phone-land` |
| 667 × 375 | `phone-land-sm` |
| 390 × 844 | `phone-portrait` |

Landscape phones keep the scene, avatars, chat, current phase, role actions, and voting controls on screen. Portrait stays usable without asking the player to rotate.

---

## 9. Design consistency

The visual direction is a dark purple and midnight-blue party-game look: cartoon village scenes for day and night, illustrated avatars, rounded cards, purple primary actions, orange and gold highlights, consistent type, and clear role and team indicators.

The reference mockups are inspired by existing social deduction apps such as Wolfy. They guide composition and mood only. The game uses its own name, art, characters, icons, and copy, and never copies another product's assets, branding, or screens.

One token system lives in `apps/web/src/theme/tokens.ts`. Neither agent adds colors, type sizes, spacing, shadows, or button styles outside it. Cursor owns changes to the tokens.

---

## 10. Quality gates

Every task has acceptance criteria. Before a task moves to `COMPLETED`:

- `pnpm typecheck` passes.
- ESLint passes, once it is configured.
- `pnpm test` passes, plus `pnpm test:integration` for database work.
- Affected screens are checked in the browser with a clean console.
- Responsive layouts are checked at the viewports above for UI work.
- Existing interactions still work, and accessibility is reviewed.

Claude reviews architecture and state management. Cursor reviews visual accuracy and responsive behavior. Neither marks a task complete without testing its acceptance criteria.

---

## 11. Git and file safety

- There are no separate branches per agent. Check `git status` before significant changes.
- Never overwrite, reset, or discard changes you did not make.
- Keep changes to the files your task owns.
- Do not commit at the same time as the other agent. Coordinate commits on shared features.
- Commit messages follow `.cursor/rules/git-commits.mdc`.

---

## 12. Goal

A polished, responsive, modular Werewolf game that works on desktop, landscape phones, and portrait phones, keeps one gameplay composition, reuses components, integrates with the API, preserves game state, supports configurable roles, and ships Infection Edition plus the expanded modes. Quality and maintainability come before the number of files or features.
