# Werewolf UX refresh — pixel-fit Cursor prompts

Run these **one screen at a time**. Each block is designed to be copied into Cursor separately. Finish the current screen, compare it to the referenced PNG, and stop before moving to the next block.

## Shared math, implementation, and image contract

Apply this section to every screen prompt.

### Reference coordinate system

- Every reference PNG is **1586 × 992 px**. Coordinate origin `(0,0)` is its top-left. In the screen sections, a box `(x,y,w,h)` means left, top, width, height in those reference pixels.
- At the matching browser viewport of **1586 × 992 CSS px**, reproduce the listed element boxes within **±4 px** for region/card edges, **±3 px** for buttons and controls, and **±3 px** for text baselines. Where a table gives a range or approximate box, inspect the PNG itself and refine the edge before implementation; do not treat the estimate as permission for loose spacing.
- Convert reference values to normalized proportions for responsive layout: `x% = x / 1586 × 100`, `y% = y / 992 × 100`, `w% = w / 1586 × 100`, `h% = h / 992 × 100`. Prefer CSS Grid/Flex with these proportions and stable gaps; use absolute positioning only for decorative overlays and artwork focal placement. Do not use a single scaled bitmap or place the screenshot behind the DOM.
- Make the page viewport itself the canvas at 1586×992. Do not add browser chrome, a device frame, outer page margin, or a second mockup border.
- For verification, take a screenshot at exactly 1586×992 and inspect side-by-side with the reference. If an image-diff tool already exists in the repo, use it for layout comparison; do not add a dependency only for visual diffing. Ignore expected differences in the actual player names and original art assets, but align their frames, crops, overlays, and text baselines.

### Existing product system

- Inspect `docs/werewolf/ui-ux-plan.md`, `docs/werewolf/ultimate-20-rules.md`, `art/manifest.json`, `apps/web/src/assets/art.ts`, and the relevant current screen implementation before editing. The live code and server projections are authoritative when older documentation conflicts.
- Preserve the current React/Vite, MUI, Tailwind, router, state hooks, API calls, `GameLayout`, and backend contracts. Make focused screen changes; do not rewrite gameplay or invent rules.
- Use the existing visual tokens as the base: `--bg: #140b22`, `--surface: #241538`, `--surface-raised: #31204c`, `--primary: #7c4dff`, `--accent: #f5b942`, `--village: #34d399`, `--wolf: #ff5c78`, `--neutral: #c4b5fd`, `--text: #f7f3ff`, `--text-muted: #c4b6dc`, and `--border: rgb(255 255 255 / 0.12)`. If sample pixels show a needed adjustment, change tokens centrally instead of adding arbitrary local colors.
- Use a readable display serif for large fantasy headings only when the reference calls for it; use the existing clean sans-serif for body copy, controls, and dense tables. Avoid decorative fonts at small sizes. Keep headings, labels, helper text, and controls on a consistent baseline/spacing scale.

### Achievable scope — follow the current app

- The generated screens are **visual refresh references for existing behavior**, not feature specifications. Build only controls and information that current routes, hooks, contracts, and server projections support. Do not add extra tabs, profile/settings/notification controls, new player notes, public event feeds, new stats, invented counts, role powers, or new phase actions just because a mockup could show them. If a visual element cannot be backed by existing data, omit it or use a non-interactive decoration.
- Keep the existing `AppShell` navigation (Werewolf, Play, How to Play, Roles) and `GameLayout` structure. In gameplay, phase states share the Table route and the same status/stage/rail/action regions. Morning is the existing `DAY_ANNOUNCE` state; Day Discussion is `DAY_DISCUSSION`; Voting and Revote are both current voting-stage states. Night resolution/reaction is handled through the existing Host dashboard and phase controls, not a new route.
- Preserve actual component-specific navigation: lobby tabs are Players, Log, Room info; host sections come from `HOST_SECTIONS`/`SECTION_LABEL`; setup steps are Mode, Roles, Settings, Review. Do not rename a tab/section or invent a new one.
- Match typography, grid, cropping, and spacing in the reference while retaining those current interaction boundaries. Use fixture/sample names only in the generated image; the implementation must bind live values.

### Existing libraries and production workflow

- **Use what this repo already has:** React 19, Vite, MUI, Tailwind, Redux Toolkit, Socket.IO, Vitest, React Testing Library, Playwright, and `vite-imagetools`. Do not replace these with another component, routing, state, E2E, or image framework. `apps/web/playwright.config.ts` already creates viewport projects from `PRIORITY_VIEWPORTS`; `apps/web/e2e/` already covers host, layout, results, and table flows.
- **Pixel QA:** use Playwright for a screenshot at 1586×992 and the existing priority viewport sizes. Keep fixture state deterministic, freeze timers, wait for `document.fonts.ready` and visible image decoding, disable motion only in screenshot mode, move the pointer away to avoid hover states, and mask only dynamic values that cannot be made deterministic. Compare DOM layout/spacing as well as the screenshot; a passing screenshot alone does not prove gameplay correctness. Playwright is already the project’s E2E tool.
- **Interaction QA:** use Vitest + React Testing Library for component states and Playwright for real routes. For multiplayer state, use two isolated browser contexts (host and guest) rather than two tabs sharing storage. Cover phase transitions, reconnects, host/guest permissions, hidden roles, target eligibility, vote changes/locks, and error recovery. `@testing-library/user-event` is not currently listed; add it only if a focused interaction test needs realistic keyboard/pointer input. Do not add Cypress.
- **Accessibility:** run keyboard/focus and screen-reader checks manually. For repeatable automated scans, `@axe-core/playwright` is the recommended small Playwright companion; add it as a dev dependency only if this implementation task includes accessibility automation. Fix violations rather than suppressing them. Keep 44px targets as the product goal, even though WCAG 2.2’s minimum target-size criterion has a smaller threshold.
- **Component exploration:** first reuse the existing screen fixtures and `apps/web/src/game/layout/LayoutPreview.tsx`. Storybook is optional if the team later needs a maintained component/state catalog; it is not a prerequisite for these screen changes.
- **Human validation:** after the screen implementation, have a few first-time players complete the task shown by that screen without coaching. Observe hesitation and errors; do not explain controls during the task. For gameplay, exercise a full host-plus-guest session across multiple phases.
- Keep existing validation commands available: `pnpm --filter @warewolf/web typecheck`, `pnpm --filter @warewolf/web e2e`, `pnpm --filter @warewolf/web test`, and `pnpm art:check`. Run only checks that match the implementation scope and report what was actually run.

### Existing image inventory to reuse (required)

These IDs are present in `art/manifest.json` and are the intended art sources for these screen mockups. Resolve them through `apps/web/src/assets/art.ts`; do not put these PNG paths directly in screen components and do not generate replacement art for these screens.

| Screen context | Existing assets to use | Image role |
|---|---|---|
| Home | `home_night_village`, `emblem` | Home environment and app mark |
| Lobby | `lobby_campfire`, `avatar_01`–`avatar_36`, `mystery_avatar` | Room environment, player identities, unknown/empty-seat fallback when appropriate |
| Setup / role picker | `roleArtUrl(role.id)`, `parchment` where appropriate | Role identity and subtle surface texture; portraits must match role IDs |
| Role reveal | `reveal_wolf`, `reveal_village`, `reveal_neutral`, `reveal_independent`; `roleArtUrl(currentRole.id)` | Choose reveal environment from the actual private faction; show the actual role portrait privately |
| Night action | `square_night`, `roleArtUrl(currentRole.id)`, `avatar_01`–`avatar_36` | Night environment, acting role, target/player identities |
| Night resolution | `square_night`, `avatar_01`–`avatar_36`, `emblem` | Host-only night context and player target identities |
| Morning results | `square_day`, `avatar_01`–`avatar_36` | Morning/public environment and publicly named player avatar |
| Day discussion | `square_day`, `avatar_01`–`avatar_36` | Day environment and public player identity |
| Voting / revote | `square_dusk`, `avatar_01`–`avatar_36` | Voting mood and eligible player identity |
| Host dashboard | `square_night`, `emblem` | Restrained header/scene treatment and product identity; use icons for metrics/actions |
| Game results | `victory_village`, `victory_wolves`, `victory_lone_wolf`, `victory_neutral`, `result_draw`; matching `ribbon_*` asset | Select scene/ribbon from the actual recorded result |

`avatarArtUrl` maps numbered IDs 1–36; `roleArtUrl` maps by exact role ID; scene and UI art must use the allowed IDs in `art-index.ts`. `square_dawn` is not in the manifest: use `square_day` for morning unless a new scene is explicitly generated and registered. Use original art assets for actual imagery; the mockup PNG is for visual comparison only and must never be rendered as the UI itself.

### Image use (required)

- Use real assets already in `art/` through `apps/web/src/assets/art.ts` (`sceneArtUrl`, `roleArtUrl`, `avatarArtUrl`, `uiArtUrl`). Do not copy a screen mockup into the UI and do not create fake portrait URLs.
- A role portrait belongs in a role/action/role-library context; a player avatar belongs in a player/seat context. Do not substitute one for the other. Never show a role portrait or faction as a public player identity when the game rules hide it.
- Use scene art as a low-contrast background layer behind a readability wash. Keep the focal scene visible in the crop shown by the reference; do not let faces, moon, or village lights sit behind text/buttons. Use `object-fit: cover` with an explicit focal position for each viewport.
- In cards, size portraits consistently, preserve the face focal point, use `object-fit: cover` for bust portraits and `contain` only for assets designed as complete cutouts. Add a subtle edge/surface so the portrait reads against the dark UI.
- Set decorative images `alt=""`; provide meaningful accessible text only when the image carries information not already in text. Lazy-load below-the-fold collections where appropriate; eager-load the screen’s hero and visible portraits. Avoid cumulative layout shift by reserving aspect ratio/box dimensions.
- Handle `onError`/missing assets with a designed fallback using existing game icon/initials or team-color illustration; never leave an empty rectangle. Verify every image URL comes from the expected exact file stem and that new files are included in Vite’s glob.

### Functional and responsive contract

Preserve server truth, role secrecy, permissions, target eligibility, timers, vote rules, action submission, phase progression, and event audience. Treat mockup names/counts as illustrative; bind live values. Include loading, error, waiting, disabled, selected, submitted, locked, and success states relevant to the screen. Retain keyboard focus, semantic controls, screen-reader labels, reduced motion, and 44px touch targets (existing 40px short-landscape player-grid exception only). At phone sizes, reflow the layout while preserving primary action and information; the desktop reference is still the pixel-fit target. Do not start the next screen in the same Cursor task.

---

## 1. Home — `01-home.png`

**Inspect:** `apps/web/src/routes/Home.tsx`, `apps/web/src/game/components/SeatDialogs.tsx`, `AppShell.tsx`, home/scene CSS.

```text
Implement only Home. Read the shared math, implementation, and image contract at the top of docs/werewolf/ux-mockups/SCREEN-PROMPTS.md. Match docs/werewolf/ux-mockups/01-home.png at exactly 1586×992 CSS px.

Geometry (x,y,w,h): navigation `(0,0,1586,75)`; image backdrop `(0,75,1586,917)`; translucent hero panel `(138,171,787,741)`; resume strip inside panel `(163,775,740,107)`. Panel content left edge is x≈177. Title visual box `(298,211,500,100)`. Edition badge `(375,338,326,54)`. Description baseline y≈427. Create button `(268,468,533,90)`; Join `(268,578,533,80)`; quiet links share one row at y≈704. Keep 20px-ish vertical gaps as shown; do not vertically center all content independently.

Use `sceneArtUrl('home_night_village')` and `uiArtUrl('emblem')`; both are existing manifest assets. Preserve the moon and bright village path in the right half. Add a deep left-to-right readability wash behind the content panel, but leave the scene legible. Do not overlay faces/lights behind labels. Match hierarchy: Werewolf title; Infection Edition badge; one-line game promise; gold Create Game; outlined Join Game; Game Modes / Role Library / How to Play links; bottom resume card only when `useSeat()` exists. Keep dialogs/API behavior unchanged. At responsive sizes move the panel and adjust background focal point, never cover either main action. Implement, screenshot at the reference viewport, compare bounds/text baselines/crop, correct, then stop.
```

## 2. Lobby — `02-lobby.png`

**Inspect:** `apps/web/src/routes/Lobby.tsx`, `PlayerCard.tsx`, `PlayerAvatar.tsx`, `VillageScene.tsx`, `PackSummary.tsx`, lobby/layout CSS.

```text
Implement only Lobby. Read the shared contract at the top of docs/werewolf/ux-mockups/SCREEN-PROMPTS.md. Match `02-lobby.png` at 1586×992.

Reference bounds: AppShell navigation `(0,0,1586,72)`; scenic seating region `(12,93,930,768)`; player rail `(958,93,592,768)`; lobby title begins `(40,110)`; room code/copy row y≈163; mode/pack/seat summary row y≈222; bottom action bar `(12,880,1537,106)`. Keep the scene and player rail side by side above the persistent bottom bar.

Use `sceneArtUrl('lobby_campfire')` softly behind the left seating area, not beneath text-heavy cards. Use `avatarArtUrl`/`PlayerAvatar` for player seats, never role portraits; reserve avatar aspect boxes before images load. Use `uiArtUrl('mystery_avatar')` only for an actually unknown player/avatar fallback, not as a substitute for an open-seat icon. Keep player names/seat labels aligned; Host and You badges do not shift names. Show connection status as Here or Away (never Ready, which is not a lobby state). The room code must be actual data and copy feedback must occupy the Copy button’s own area without moving the panel. Right rail uses current Players / Log / Room info tabs; show only lobby members, existing room log, and room info. Bottom left explains the exact blocker; Game setup is secondary and Start game reflects the existing start-ready projection. Guests see an explicit waiting state instead of a host start control. Preserve leave/kick/transfer confirmation and permissions. On narrow screens collapse/reflow rail and seat grid, but retain room code and bottom action. Screenshot-compare and finish only Lobby.
```

## 3. Game setup — `03-setup.png`

**Inspect:** `Setup.tsx`, `apps/web/src/game/setup/{SetupLayout,SetupMode,SetupRoles,SetupSettings,ConfigSummary}.tsx`, `setup-layout.css`.

```text
Implement only Game Setup. Read the shared contract at the top of docs/werewolf/ux-mockups/SCREEN-PROMPTS.md. Match `03-setup.png` at 1586×992.

Geometry: header/title art band y=0–94. Four-step rail spans x≈174–1412, centerline y≈128; each step circle is 48px. Main canvas `(20,177,1117,687)`. Persistent summary `(1156,177,412,687)`. Bottom pinned strip `(19,885,1549,93)`. In canvas: Role library title `(44,192)`; search box `(697,199,416,49)`; filter row y≈272 h≈41. Role grid three equal columns, x≈40/409/778, each card ≈356×167, row starts y≈335/520/687 with 17px gaps. Card portrait box about 116×140 on left; copy at portrait right; minus/count/plus aligned to bottom right. Summary has seat total card y≈194 h≈55; role mix y≈260 h≈212; remaining seats y≈500 h≈57; valid state y≈592 h≈66; warning y≈673 h≈72; acknowledgement below.

Use existing `roleArtUrl(role.id)` portraits, `object-fit:cover`, fixed portrait geometry, and a designed fallback. Do not use player avatars. Use `uiArtUrl('parchment')` only as a restrained surface texture on the review/summary panel, never behind dense small text. Verify all visible IDs are present in `art/manifest.json` and load through `art.ts`. Filters/search/add/remove must work with existing configuration. Bind summary and warning text to validation. Ultimate 20’s fixed roster remains fixed. Save and Start depend on current dirty/valid/warning states. Use existing tokens; no guessed sample counts in live app. At reference viewport preserve the visible three-column grid and full bottom bar; at small sizes stepper and summary reflow. Capture and compare the screen, then stop.
```

## 4. Role reveal — `04-role-reveal.png`

**Inspect:** `apps/web/src/routes/Reveal.tsx`, `RoleCard.tsx`, role state/projection hooks, reveal CSS.

```text
Implement only Role Reveal. Read the shared contract at the top of docs/werewolf/ux-mockups/SCREEN-PROMPTS.md. Match `04-role-reveal.png` at 1586×992.

Geometry: artwork column x=0–602 (38%); right content x=603–1585 (62%). Header row y≈18–80. Privacy pill `(1216,24,341,54)`. Main role card `(603,110,956,688)`. Portrait region occupies left artwork column with face centered around x≈288 and y≈418; crop focal point to keep face and glowing orb. Inside card: eyebrow at x≈634/y≈135; main role title row y≈201–285; purpose line y≈306; divider y≈368; ability rows y≈394–581; Tonight strip `(639,609,887,70)`; teammate strip `(639,701,887,64)` only if permitted. Bottom buttons y≈837–934: Hide role `(603,837,346,97)`; I understand `(974,837,583,97)`.

Use `roleArtUrl(currentRole.id)` for the private role portrait. Set the background from the actual faction: `reveal_wolf`, `reveal_village`, `reveal_neutral`, or `reveal_independent` via `sceneArtUrl`. If the role portrait fails, show a designed role-color fallback, not a blank panel. The portrait and role copy are private; Hide must conceal both. Use actual role/team/description/abilities/tonight/teammates from server projection, only show teammates when permitted. No discussion rail. Continue with existing navigation. Mobile stacks image/card and pins continue. Match image focal position and card padding; screenshot-compare and stop.
```

## 5. Night action — `05-night.png`

**Inspect:** `Table.tsx`, `PlayerGrid.tsx`, `NightActionPanel.tsx`, `GameLayout.tsx`, action state/copy, `table-screen.css`.

```text
Implement only the existing Table route during Night. Read the shared contract above and match `05-night.png` at 1586×992.

Reference bounds: AppShell navigation `(0,0,1586,72)`; GameLayout phase/status `(20,98,1117,79)`; stage/player grid `(20,190,1117,623)`; right Discussion rail `(1156,98,406,885)`; bottom NightActionPanel `(20,833,1117,150)`. Keep the 20px outer gutter and 19px column gap. Player cards form a five-column grid, each about 210×225, with consistent portrait/name/life-status alignment. Selected target uses a violet outline/check; own-seat badge is separate. Eliminated cards are desaturated and remain readable.

Use `square_night` as a low-contrast stage background, player avatars for all public seats, and `roleArtUrl(currentRole.id)` only in the current player's private bottom action panel. Do not reveal role/faction on public cards. Bind eligible targets, action copy, selected target, pending state, and submission to existing hooks. Discussion is closed at night if the current component says so; do not invent night chat. Keep AppShell links exactly Werewolf, Play, How to Play, Roles. Make the same layout reflow at mobile widths. Compare against the reference at 1586×992 and stop after Night.
```

## 6. Night resolution / host reaction — `06-night-resolution.png`

**Inspect:** `Host.tsx`, `HostShell.tsx`, `HostCanvas.tsx`, `KillChoices`, `PhaseCloseButton`, host styles/hooks.

```text
Implement only the existing Host dashboard Night actions section and host phase action; this is not a new route. Read the shared contract above and match `06-night-resolution.png` at 1586×992.

Reference bounds: Host title strip `(0,0,1586,61)`; section rail `(0,61,279,833)`; canvas begins x≈279. Canvas title `(307,95,400,55)`. Submitted-actions panel `(307,168,1252,258)`. Kill-target panel `(307,450,1252,218)`. Persistent bottom action bar `(11,896,1540,91)`. Keep the rail width and bottom bar fixed; the canvas uses the remaining width. At narrower viewports let the rail collapse/scroll and stack the action list and target picker.

Use `HostShell` and existing `HOST_SECTIONS` labels exactly; Night actions is selected. Render the host projection’s submitted actions and the existing wolf kill target decision / eligible targets / No kill choice only where the existing hook exposes them. Use player identity assets if the current selector does; do not expose this host-only data on the Table route. Bottom actions are the existing Back to game and Resolve night controls and must preserve loading, duplicate-submit protection, stale state, and errors. No timeline, activity feed, extra metrics, or new night actions. Use the app palette and existing components; compare at the reference viewport and stop.
```

## 7. Morning results — `07-morning-results.png`

**Inspect:** Table route `DAY_ANNOUNCE`, public event projection, `ResultsRecap.tsx`, phase labels/copy, relevant CSS.

```text
Implement only the existing Table route's Morning / `DAY_ANNOUNCE` state, not a new route. Read the shared contract above and match `07-morning-results.png` at 1586×992.

Reference bounds: AppShell navigation `(0,0,1586,70)`; phase/status row `(12,90,1142,73)`; central morning stage `(12,179,1142,684)`; existing Discussion rail `(1170,90,379,773)`; bottom action region `(12,880,1537,110)`. Main outcome card is centered in the stage at roughly `(230,320,708,412)`. Preserve the large scene crop and opaque plum readability card.

Use `square_day` (there is no `square_dawn`) and show only public result data. The sample “no one was eliminated” copy is illustrative; bind the actual public outcome. Never show hidden attacker, unrevealed role, silent infection, or host-only events. The rail uses the existing DiscussionPanel empty/closed state when appropriate, not a fabricated event timeline. Bottom action is whatever the current host/guest phase state supports; do not grant guests a host-only advance control. Use player avatars only for publicly named players. Compare at 1586×992 and stop.
```

## 8. Day discussion — `08-day-discussion.png`

**Inspect:** `Table.tsx`, `DiscussionPanel.tsx`, `PlayerGrid.tsx`, chat state, `GameLayout.tsx`, table CSS.

```text
Implement only the existing Table route `DAY_DISCUSSION` state. Read the shared contract above and match `08-day-discussion.png` at 1586×992.

Reference bounds: AppShell nav `(0,0,1586,65)`; main status row `(14,93,1055,65)`; stage/player area `(14,178,1055,638)`; bottom phase/action area `(14,836,1055,138)`; Discussion rail `(1088,93,459,881)` with composer pinned to its bottom. Retain the 20px-ish gutters and the 19px separation between the stage and rail.

Use `square_day` behind the stage and only player avatars/name/seat/life status on public player cards. Keep actual chat messages and composer inside the existing `DiscussionPanel`; bind send eligibility, limits, loading, and failures to current state. Never show role/team, private notes, fabricated player facts, or a new event feed. The bottom action reflects the current host/guest permission and phase state; do not add a second phase control. At phone widths stack or switch between stage and discussion while keeping phase, composer, and primary action reachable. Compare at the reference viewport and stop.
```

## 9. Voting — `09-voting.png`

**Inspect:** `Table.tsx`, `PlayerGrid.tsx`, `VoteTally.tsx`, vote state/copy helpers, table CSS.

```text
Implement only the existing Table route Voting state. Read the shared contract above and match `09-voting.png` at 1586×992.

Reference bounds: AppShell nav `(0,0,1586,66)`; voting panel `(14,90,1114,907)`; phase/title strip within it `(15,90,1112,87)`; candidate stage/grid `(15,178,1112,658)`; ballot/confirmation footer `(26,836,1092,150)`; Discussion rail `(1147,90,399,907)`. In the grid use four columns at the shown width, with even card gutters and a distinct selected outline. Keep candidate cards public: avatar, seat/name, and life status only.

Use `square_dusk` behind a contrast wash. Candidate eligibility, abstain availability, selection, vote lock/changeability, and errors all come from current server state. The ballot stays private: never render live vote totals or who voted for whom on the player route. Footer shows the selected candidate and existing submit action, plus privacy copy only if supported. Use existing `DiscussionPanel` content, not sample chat presented as real data. Keep AppShell navigation exact. Reflow on mobile while keeping submit reachable. Compare at 1586×992 and stop.
```

## 10. Revote — `10-revote.png`

**Inspect:** `Table.tsx`, vote state/copy, tie and revote projection, tally helpers.

```text
Implement only the current voting-stage `REVOTE` state, reusing normal voting controls; do not create a route. Read the shared contract above and match `10-revote.png` at 1586×992.

Reference bounds: AppShell nav `(0,0,1586,68)`; main revote card `(25,97,1096,879)`; heading/instruction block begins `(56,194)`; tied candidate cards occupy approximately x=55–1100 and y=330–511; selected nominee and submit footer begins y≈803. Discussion rail `(1141,97,404,879)`. Use generous empty space around the short tied-candidate set as shown.

Render only the actual tied eligible candidate list (the count can vary), with equal emphasis and public identity fields only. Use player avatars, not role portraits. Do not show vote totals, prior ballots, or voter identities. Bind explanation, selection, privacy, confirm, and lock behavior to current server state; never promise a particular final-tie outcome unless the server rules confirm it. Use `square_dusk` with a dark overlay and the same colors/typography as normal voting. Compare at the reference viewport and stop.
```

## 11. Host dashboard — `11-host-dashboard.png`

**Inspect:** `Host.tsx`, `HostShell.tsx`, `HostCanvas.tsx`, `dashboardCopy.ts`, host state/hooks, host CSS.

```text
Implement only the existing Host dashboard Overview at `11-host-dashboard.png`. Read the shared contract above and match it at 1586×992.

Reference bounds: Host section rail `(0,0,336,992)`; title/brand inside the rail header; overview canvas x≈336–1586. Main facts panel `(376,174,1150,398)`. Persistent phase action bar `(356,892,1190,93)`. Keep broad negative space below the facts and do not add a second information panel.

Use `HostShell` exactly, with Overview selected and existing section names/order. Show only the existing `HostDashboard.overview` facts: round, phase, alive, wolf-aligned alive, and infection successes/max/sealed/off state. Bind all values to the projection; no event timeline, activity panel, new counters, or fabricated audience field. The bottom phase control must use the existing `PhaseCloseButton` and current phase copy. Host-only role/faction information stays on host sections. Use the current app palette with icon accents, not character portraits. On mobile use the existing compact section rail and keep the phase action visible. Compare and stop after Overview.
```

## 12. Game results — `12-game-results.png`

**Inspect:** `Results.tsx`, `VictoryBanner.tsx`, `ResultsRecap.tsx`, result projection/copy, results CSS.

```text
Implement only the existing Game Results route and match `12-game-results.png` at 1586×992. Read the shared contract above.

Reference bounds: AppShell nav `(0,0,1586,82)`; results container `(35,143,1491,823)`; winner ribbon `(89,184,351,74)`; scene image `(69,278,950,398)`; recap panel `(1050,186,448,612)`; outcome sentence `(69,703,950,87)`; Play again action centered near `(780,890)` with a 368×72 button. Retain the single dominant scene, compact three-row recap, and generous panel padding. Do not add a player-result table or extra buttons that are absent from the reference.

Select existing outcome scene and ribbon from the actual recorded outcome. Bind the three available recap stats—Rounds, Infections, Eliminations—to result data; do not invent duration, individual scores, or achievements. Preserve result privacy and existing play-again behavior. Keep the plum surface and typography; use gold only as the outcome/ribbon accent and violet for the primary brand action. At mobile widths stack the scene and recap without clipping. Compare at the reference viewport and stop.
```
