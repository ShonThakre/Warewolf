# Phone UI implementation plan

Use this plan with the 12 portrait references in this folder. Run **Phase 0 once**, then paste **one screen prompt at a time** into Claude Code. Each prompt changes only one screen. The app already has portrait-aware shells and breakpoints; extend those instead of introducing a second mobile app or new routes.

## Working sequence

1. Run the Phase 0 prompt to centralize phone tokens and reusable presentation primitives.
2. In Claude Code, implement screens 01–12 in order, one prompt per task. Attach or reference the corresponding `*-phone.png` mockup in the prompt.
3. After each screen, compare a real app screenshot at 390 × 844 against the portrait reference, fix the differences, and stop before starting the next screen.
4. After all screens, verify the 360 × 800 and 430 × 932 portrait viewports and the existing 844 × 390 phone-landscape viewport.

The PNGs are visual references, never page backgrounds or UI images. Most portrait files are 852 × 1846 px; `01-home-phone.png` is 934 × 1684 px. Their aspect ratios are references, not device frames: implement at the CSS viewport and compare the component order, edges, spacing, crop and action positions without distorting the PNG.

## Current app structure to preserve

- Theme source of truth: `apps/web/src/theme/tokens.ts`. Current colors are `--bg #140b22`, `--surface #241538`, `--surface-raised #31204c`, `--primary #7c4dff`, `--accent #f5b942`, `--village #34d399`, `--wolf #ff5c78`, `--neutral #c4b5fd`, `--text #f7f3ff`, `--text-muted #c4b6dc`, and `--border rgb(255 255 255 / 0.12)`.
- Breakpoints/mode detection already live in `apps/web/src/game/layout/layoutMode.ts`, `useLayoutMode.ts`, and `viewports.ts`. At 390 × 844 the mode is `portrait`; keep the current mode logic as the single breakpoint source.
- `AppShell` already renders compact phone session chrome, seat avatar, and the existing navigation menu. Do not create a second phone header or add menu items.
- `GameLayout` already provides the phase/status region, scene, Players/Discussion switch in portrait where applicable, discussion rail, and action area. Preserve its semantics and state.
- `SetupLayout` and `HostShell` already have portrait navigation modes. Extend their current rail/pager styles instead of making new routes or parallel shells.
- Reuse current components: `PlayerAvatar`, `PlayerCard`, `PlayerGrid`, `VillageScene`, `GameStatusBar`, `DiscussionPanel`, `NightActionPanel`, `KillTargetPanel`, `PhaseCloseButton`, `RoleCard`/`RolePortrait`, `ConfigSummary`, `ResultsRecap`, and `VictoryBanner`.
- Keep React, MUI, existing CSS, Redux state, Socket.IO updates, router and server contracts. Do not add a component library or duplicate state.

## Shared phone design system

The portrait references are the visual source for proportions, component order, icon placement, density, and emphasis. The existing application is the source for behavior and data. Match the mockup closely while keeping the current route/state/permission contract. Use the same shared rules on every screen; do not let each screen invent a new palette, card shape, button style, or icon stroke.

### Tokens and configuration

Add phone-only sizing tokens to the existing `tokens` object in `apps/web/src/theme/tokens.ts`; do not repeat hex colors in screen styles. Suggested starting values (adjust only when screenshot comparison gives a concrete reason):

```ts
'--phone-page-gutter': '16px',
'--phone-section-gap': '12px',
'--phone-card-gap': '10px',
'--phone-card-padding': '14px',
'--phone-card-radius': '16px',
'--phone-control-radius': '12px',
'--phone-toolbar-min': '56px',
'--phone-control-height': '48px',
'--phone-hit': '44px',
'--phone-icon-size': '20px',
'--phone-icon-size-large': '24px',
'--phone-dock-gap': '8px',
'--phone-safe-bottom': 'max(12px, env(safe-area-inset-bottom))',
'--phone-content-max': '430px',
'--phone-title-size': '1.5rem',
'--phone-heading-size': '1.25rem',
'--phone-body-size': '0.9375rem',
'--phone-label-size': '0.8125rem',
'--phone-meta-size': '0.75rem',
```

Use the existing Nunito/system font token for UI copy and controls. Use the existing fantasy/display font only where the reference already has an outcome or large hero heading. Keep text readable, support wrapping, and never shrink control labels to force a fit.

### Shared elements

Create a small shared phone presentation layer only for genuinely repeated patterns. Suggested location: `apps/web/src/game/layout/phone/` with `phone-components.tsx` and `phone-components.css`; keep route-specific CSS in its existing file.

| Shared element | Reuse/role | Rules |
|---|---|---|
| `PhoneSurface` | Shared card surface for setup summary, result summary, and host facts | Uses existing surface/border/radius tokens; no game logic or invented data |
| `PhoneSectionSwitch` | Compact horizontal switch when a screen already has sections/tabs | Reuse MUI Tabs or existing Setup/Host rails; labels and selected state come from current components |
| `PhoneActionDock` | Visual wrapper for current primary/secondary actions at bottom | Safe-area aware, sticky only when the current shell has an action region; accept existing controls as children and never own phase state |
| `PhonePlayerIdentity` | Shared spacing/size rules around existing `PlayerAvatar` and labels | Avatar/name/life only on public surfaces; role data only in authorized private/host contexts |
| `PhoneStatusPill` | Compact phase or connection status treatment | Uses existing phase/presence copy; do not turn connection presence into readiness |

Do not replace `AppShell`, `GameLayout`, `SetupLayout`, `HostShell`, `PlayerGrid`, or `DiscussionPanel` with these wrappers. If the existing component already solves the pattern, style it directly rather than adding an abstraction. Add shared CSS classes for safe-area padding, sticky bottom bars, focus rings, spacing and responsive typography; keep phase logic in the existing state/hooks.

### Exact visual language, iconography, and phone UX

These are the shared screenshot targets at a 390 × 844 CSS viewport. Treat pixel values as starting targets; use the matching PNG to refine individual positions.

| Element | Shared target | Visual treatment |
|---|---:|---|
| App header | 56–64px high; 16px horizontal inset | `--surface`, 1px bottom border, existing 32px emblem, compact wordmark; use existing AppShell session menu/avatar, never desktop links squeezed onto a phone |
| Page gutter | 14–16px each side | Main panels align to one consistent vertical edge; content width about 358px |
| Phase/status strip | 44–64px high, wraps only when needed | Small phase icon + explicit phase text + round/timer/waiting copy when available; no icon-only phase |
| Section spacing | 10–12px | Use the same gaps between cards and avoid dense stacked borders |
| Card surface | 14px padding, 16px radius | `--surface` or `--surface-raised`; 1px `--border`; minimal `--shadow` |
| Body text | 15px / 22px line height | `--font-display`; avoid condensed/small copy |
| Section heading | 20px / 26px line height, weight 800 | `--text`; consistent sentence case |
| Page title | 24px / 30px line height; hero can be larger | Display face only where the image uses a hero/outcome heading |
| Metadata/helper | 12–13px / 17–18px line height | `--text-muted`; never use for primary instructions |
| Player avatar | 44–52px; up to 56px in reveal/result hero | Same circle/radius and border across all screens; use `PlayerAvatar` and real avatar IDs |
| Primary control | At least 48px height and 44px hit target | Violet for ordinary primary; gold for start/major confirm when existing theme/flow uses it; disabled state uses raised surface and muted text |
| Selected player | 2px violet border + visible check/selected label | Never communicate selection with color alone; disabled/dead state includes text and is not selectable |
| Sticky action dock | Full-width within page gutter; safe-area bottom included | Use current shell action region, opaque plum surface, top border; reserve body bottom space equal to dock height |
| Background scene | Crop focal point away from copy; dark plum wash | Use existing scene art; do not put generated mockup imagery in the app |

#### Icon system

The app already has `GameIcon` in `apps/web/src/game/components/GameIcon.tsx`, a crisp 24×24 inline SVG family with `currentColor`, 1.8px stroke and rounded caps. Reuse it for infect, kill, shield, heal, potion, magnifier, vote, settings, and timer. For other symbols, extend this single component with a small named SVG path registry only when needed. Do not install a new icon package, use emoji, mix filled emoji with line icons, or use role art as a generic icon.

| Meaning | Icon cue | Color/label rule |
|---|---|---|
| Night / Morning / Day | Crescent / sun / sun with horizon | Keep the phase word adjacent; use text color or gold accent |
| Players / seats | Two-person outline | Pair with count/Players label |
| Discussion / chat | Rounded speech bubble | Use “Discussion”; composer send uses a paper-plane/arrow outline |
| Private / hidden | Lock or eye-off outline | Always pair with “Private”/“Hidden” text |
| Selected / submitted | Check inside circle | Also expose selected/submitted text to assistive technology |
| Alive / connected | Small filled teal dot or simple person icon | Pair with “Alive” or Here; do not use teal alone |
| Eliminated / unavailable | Cross or muted avatar | Pair with “Eliminated”; reduce saturation, preserve text contrast |
| Copy / expand / navigation | Duplicate sheets / chevron / arrow | Buttons include visible or accessible text; 44px hit area |
| Round / infections / eliminations | Layered stack / existing infect / crosshair or elimination mark | Rows keep the fact label and value; no invented stat iconography |
| Main app mark | Existing `uiArtUrl('emblem')` | Use only for the brand; do not invent alternate logo colors |

Use 20px icons inline with body controls and 24px icons for section/state headers. SVG icons are decorative when adjacent text says the same thing (`aria-hidden="true"`); meaningful icon-only buttons require an accessible label and tooltip where applicable. Use the existing GameIcon stroke treatment consistently.

#### Icon placement by reference

| Screen | Icons visible in the reference | Implementation rule |
|---|---|---|
| Home | Emblem, menu, Infection Edition mark, create plus, join/players, game mode stack, role-card/library, book/help, resume arrow | Reuse the app emblem; use simple line SVG icons for action/navigation. Keep text labels on every action. |
| Lobby | Copy, mode/gamepad, role-pack layers, seats, player presence dots, Host/You chips, setup gear, start triangle | Here/Away dots pair with words; do not use check icons or “Ready” state for presence. |
| Setup | Numbered progress circles, team badges, minus/plus steppers, seat/team totals, validation check, back/save/start | Step numbers and all stepper actions remain text/number accessible. Use team tokens only for configured role teams. |
| Role reveal | Lock/private, faction mark, purpose/ability, moon/timing, teammate group, eye-off, confirmation check | The private lock and label appear before secret details; Hide role is explicit text plus eye-off. |
| Night | Moon, closed-discussion eye-off/bubble, alive dot, eliminated cross, selected check, role-action glyph, submit arrow | Public cards show state icons only; the action glyph is private to the acting player. |
| Host night resolution | Existing section glyphs, submitted check/status, target radio, No kill prohibition mark, back arrow, resolve action | Preserve HostShell icons and status text; target choice uses a radio/selected state, not a role badge. |
| Morning | Sun, outcome check/result mark, survivor avatars, closed Discussion bubble/chevron, current phase action | Icon reinforces the public outcome and never implies hidden cause. |
| Day discussion | Day/sun, Players/Discussion tab icons, chat bubbles, sender avatars, send arrow, phase action | Keep send action accessible; do not put team-colored icons beside public speakers. |
| Voting | Day/sun, Candidates/Discussion tabs, living dots, selected check, privacy lock, submit arrow | Privacy icon always accompanies “Your vote is private”; no tally icon or ballot totals. |
| Revote | Day/sun, candidate selection check/radio, privacy lock, submit arrow | Match Voting icon size and placement; only the tied candidate list varies. |
| Host Overview | Exact HostShell section icons, round layers, phase moon/sun, people, wolf mark, infection mark, phase action | Use the current host icon rail and fact labels; no decorative badges or unrelated chart icons. |
| Results | Outcome ribbon mark, round layers, infection mark, elimination/crosshair, replay arrow | Choose the outcome mark from actual results; stat rows retain labels and values. |

#### Per-screen composition and visual anchors

1. **Home:** existing compact header; scenic upper hero with emblem/title/edition pill; one-line product promise; full-width Create Game (gold), outlined Join Game; three compact secondary navigation tiles/links; optional resume card only for an existing seat.
2. **Lobby:** room title/code-copy surface first; one row for mode, role pack, seats; scene seating with avatars; Players/Log/Room info switch; rows with seat/name, Host/You, Here/Away; bottom blocker plus Game setup and Start game.
3. **Setup:** four numbered Mode/Roles/Settings/Review steps; page title/helper; scrollable role rows with art, role/team, short description, count stepper; collapsible configuration summary; bottom Back/Save/Start actions from current flow.
4. **Role reveal:** private notice; faction reveal scene; large role art and role title/team; purpose/ability/timing/allowed teammates; Hide role and I understand dock.
5. **Night:** phase/status; night scene wash; Discussion closed state; two-column public seat grid; private role/action panel, selected target and Submit; keep public roles hidden.
6. **Host night resolution:** Host dashboard title; scrollable exact section chips; host-only submitted action rows; wolf kill target selection; persistent Back to game / Resolve night actions; no timeline.
7. **Morning:** phase strip; dawn scene; public result card with sun/check treatment and survivors only if provided; DiscussionPanel closed state; host/guest-appropriate phase action.
8. **Day discussion:** status; scene; existing Players/Discussion switch; chat list with avatar/name/message; composer; phase action. On a phone, avoid showing tiny seats and chat side-by-side.
9. **Voting:** dusk scene header; Candidates/Discussion switch only when using the existing GameLayout panel; eligible public candidates; selected candidate; private-vote copy and submit dock.
10. **Revote:** same voting template and iconography; tied candidates only; phase label changes to Revote; same private submit dock.
11. **Host Overview:** exact Host section rail; one fact surface for round/phase/alive/wolf-aligned/infections; existing phase action dock.
12. **Results:** outcome-specific ribbon and scene; title/reason; compact Rounds/Infections/Eliminations facts; existing recap/privacy content; Play again.

#### Phone layout bands from the references

Approximate CSS y-bands for the 390 × 844 target. Use the PNG edges to refine the exact card positions and internal padding. Keep the order and visual hierarchy below, and avoid a second fixed overlay when the shell already reserves an action row.

| Screen | Vertical bands (CSS px from top) |
|---|---|
| 01 Home | Header 0–58; hero/brand/edition/promise 58–393; Create/Join 426–562; secondary links 590–693; optional resume 719–822 |
| 02 Lobby | Header 0–50; room/code/mode summary 65–195; scene seats 198–452; room tabs 451–494; player rows 506–703; blocker/actions 724–844 |
| 03 Setup | Header 0–54; step rail 54–83; page title/helper 100–149; role list 169–681; configuration summary 694–779; bottom actions 794–844 |
| 04 Reveal | Header 0–49; reveal scene/private notice 49–284; role card/details 303–741; Hide/Understand dock 768–844 |
| 05 Night | Table header/status 0–60; scene/discussion-closed 59–242; public player grid 257–624; private action panel 640–844 |
| 06 Host Night | Host title 0–60; section rail 75–106; submitted action card 190–381; kill target card 396–745; host action row 774–844 |
| 07 Morning | App/phase status 0–97; dawn scene/result 105–520; survivors 530–610; closed discussion 620–660; current phase action 770–844 |
| 08 Discussion | App/status/scene 0–149; Players/Discussion switch 149–192; messages 202–714; composer 714–769; phase action 785–833 |
| 09 Voting | Header/dusk/phase 0–166; Candidates/Discussion switch 168–208; instruction 228–264; candidate grid 283–595; ballot dock 645–844 |
| 10 Revote | Header/status 0–91; revote heading/instruction 106–159; switch 177–220; tied candidates 237–571; ballot dock 677–844 |
| 11 Host Overview | Header/title 0–55; Host section rail 69–100; overview facts 117–435; current phase dock 734–844 |
| 12 Results | Header 0–62; scene/ribbon 62–302; outcome title 310–350; recap stats 369–558; outcome/recap copy 592–681; Play again 769–824 |

The Home file is 934 × 1684 px while the other phone references are 852 × 1846 px; use its content sequence and hierarchy, not distorted raw-pixel comparisons. For all screens, compare the real page at 390 × 844 and use the image as the source for crop, relative spacing and visual weight.

### Global phone behavior

- Use the existing `data-layout="portrait"` mode and current shell regions; avoid independent `matchMedia` thresholds.
- Use a single-column scrollable content area. Keep action controls in the existing final grid row (`GameLayout`, `HostShell`, or `SetupLayout`); use `position: sticky` only if the current scrolling container requires it, and avoid a new fixed overlay. Include `--phone-safe-bottom` in that row and enough scroll padding so the final content is never hidden.
- Prefer full-width controls and list rows. Interactive targets are at least 44 × 44 CSS px. Keep visible keyboard focus and accessible names; respect reduced motion.
- Preserve image aspect ratios and reserve dimensions before loading. Resolve all art with `sceneArtUrl`, `roleArtUrl`, `avatarArtUrl`, and `uiArtUrl` from `apps/web/src/assets/art.ts`; no hard-coded file URLs.
- Public seat identity is avatar, seat/name and life status. Never place role/faction badges on public player cards. Host-only projections stay within Host routes. Private role details stay within the private reveal/action context.
- Use fixture names/counts only as visual samples. Bind labels, permissions, targets, chat, counts, phase transitions and errors to the existing projections and hooks.
- Keep app colors and component styling consistent across every prompt. Avoid per-screen gradients, borders, or colors that do not derive from the theme tokens.

## Phase 0 — shared phone foundation Claude Code prompt

Paste this once before the screen prompts:

```text
Implement the shared phone presentation foundation and icon language for the Werewolf app before changing individual screens. First inspect apps/web/src/theme/tokens.ts, apps/web/src/shell/AppShell.tsx, apps/web/src/game/layout/{layoutMode.ts,useLayoutMode.ts,GameLayout.tsx,game-layout.css}, apps/web/src/game/setup/SetupLayout.tsx, apps/web/src/game/host/HostShell.tsx, and the existing screen CSS/components.

The 390x844 viewport already maps to data-layout="portrait". Preserve existing breakpoints, AppShell session menu, GameLayout Players/Discussion switch, SetupLayout steps, HostShell sections, route state, Redux hooks, API and server contracts. Do not build alternate screens, duplicate navigation, add rules/features, or modify desktop presentation unless shared styles require a responsive-safe correction.

Centralize the phone design language using the current tokens as the only color source. Add the --phone-* spacing/radius/type/safe-area tokens from docs/werewolf/ux-mockups/PHONE-IMPLEMENTATION-PLAN.md to the existing apps/web/src/theme/tokens.ts. Create only small shared presentation primitives that are actually reused (PhoneSurface, PhoneActionDock, PhonePlayerIdentity, and/or a phone section switch) under apps/web/src/game/layout/phone/. If non-game icons are needed, extend GameIcon.tsx as the one 24x24 inline-SVG source with the same currentColor, 1.8px rounded stroke style; do not add a competing icon set or emojis. Keep them visual-only and pass existing content/actions as children or props; do not put game behavior in them. If an existing component already covers a pattern, extend its CSS instead of creating a duplicate component.

Follow the exact spacing, type scale, state treatments and icon rules in this plan. Use MUI, existing Nunito typography, plum #140b22, surfaces #241538/#31204c, violet #7c4dff, gold #f5b942, village #34d399, wolf #ff5c78, neutral #c4b5fd, text #f7f3ff and muted #c4b6dc through tokens only. Add safe-area aware sticky action styling, 44px minimum touch targets, focus-visible styles, readable wrapping, and bottom-content clearance. Keep CSS keyed to the existing portrait layout mode. Do not change screen content or gameplay behavior in this foundation task. Run the existing web typecheck and relevant layout checks only if this implementation task asks for verification. Stop after the shared foundation and report changed files.
```

## Screen prompts

For each prompt, include the shared phone design-system rules above. Attach the named PNG as the visual reference. Implement only that screen, compare at 390 × 844, and stop.

### 01 — Home

Reference: `01-home-phone.png` · Inspect `Home.tsx`, `SeatDialogs.tsx`, `AppShell.tsx`, `home-scene.css`.

```text
Implement only the existing Home route to match docs/werewolf/ux-mockups/01-home-phone.png at a 390x844 CSS viewport. Use the shared phone design system, icon rules, screen composition and layout bands in this plan, plus current AppShell compact navigation. Keep the composition vertical: compact header, home_night_village hero with restrained wash, Werewolf title and Infection Edition badge, short promise, full-width Create Game and Join Game buttons, compact existing Game Modes / Role Library / How to Play links, and the current-seat resume card only when useSeat() returns one. Use uiArtUrl('emblem') and sceneArtUrl('home_night_village'). Keep primary actions visible without making hero art push them below an unreasonable scroll. Preserve existing dialogs/API behavior. Screenshot compare and stop.
```

### 02 — Lobby

Reference: `02-lobby-phone.png` · Inspect `Lobby.tsx`, `PlayerCard.tsx`, `PlayerAvatar.tsx`, `VillageScene.tsx`, `PackSummary.tsx`.

```text
Implement only the Lobby phone layout to match 02-lobby-phone.png at 390x844. Reflow the actual room title/code/copy, mode/role-pack/seat summary, lobby_campfire scene, Players/Log/Room info tabs, player list, and bottom Game setup/Start game action into one scrollable column with a safe-area bottom dock. Keep room code copy feedback local to its control. Player rows show seat/name, Host/You when applicable, and Here/Away connection status only. Never show Ready, role or faction on a lobby seat. Start game and blocker copy reflect the existing server/start-ready projection and host permission. Preserve leave/kick/host-transfer dialogs. Screenshot compare and stop.
```

### 03 — Game setup

Reference: `03-setup-phone.png` · Inspect `Setup.tsx`, `SetupLayout.tsx`, `SetupMode.tsx`, `SetupRoles.tsx`, `SetupSettings.tsx`, `ConfigSummary.tsx`.

```text
Implement only Game Setup phone layout to match 03-setup-phone.png at 390x844. Keep existing Mode/Roles/Settings/Review steps in the current SetupLayout rail/pager. On Roles, make role rows full-width with roleArtUrl(role.id), current role/team/description and count controls. Keep the actual configuration summary available as a compact collapsible/stacked summary; do not let it cover the role list. Preserve validation, seat totals, warnings and existing save/start rules. Sticky bottom actions must use existing actions and permission/validity state. Use real role definitions only; no new powers. Screenshot compare and stop.
```

### 04 — Role reveal

Reference: `04-role-reveal-phone.png` · Inspect `Reveal.tsx`, role state/projection, `RolePortrait`, `reveal-screen.css`.

```text
Implement only the private Role Reveal phone state to match 04-role-reveal-phone.png at 390x844. Use the compact AppShell and one-column scroll layout. Choose the reveal scene from the actual private faction and render roleArtUrl(currentRole.id) with actual role name, team, purpose, ability, timing and permitted teammate details. Keep a clear private-role notice and sticky Hide role / I understand actions. Hide role must conceal the secret content. Do not derive role data from mockup text or expose it on public routes. Screenshot compare and stop.
```

### 05 — Night action

Reference: `05-night-phone.png` · Inspect `Table.tsx`, `PlayerGrid.tsx`, `NightActionPanel.tsx`, `GameLayout.tsx`, action state/copy.

```text
Implement only the existing Table NIGHT_SUBMIT portrait state to match 05-night-phone.png at 390x844. Reuse GameLayout and its existing portrait Players/Discussion switch. Use square_night, a two-column public player grid, and the current private NightActionPanel/action. Public seats contain avatar, seat/name and life status only; never add public role/faction labels. Selected legal targets, selection limit, ability copy, submit status and errors come from the existing action hooks. Discussion stays closed at night with current copy. Keep the action reachable and reserve space for the safe-area dock. Screenshot compare and stop.
```

### 06 — Host Night resolution

Reference: `06-night-resolution-phone.png` · Inspect `Host.tsx`, `HostShell.tsx`, `HostCanvas.tsx`, `KillChoices`, `PhaseCloseButton`.

```text
Implement only the existing Host dashboard Night actions phone state to match 06-night-resolution-phone.png at 390x844. Use HostShell's existing portrait section rail with the exact HOST_SECTIONS/SECTION_LABEL names; it may scroll horizontally. Stack HostCanvas submitted actions and the existing kill target picker in one vertical canvas. Show host-only projected action details and only eligible living targets; show No kill only if current state permits. Keep the existing Back to game and Resolve night actions in the sticky HostShell bottom action region. No timeline/feed, new powers, metrics, or public leakage. Preserve duplicate-submit prevention, pending, stale, success and error states. Screenshot compare and stop.
```

### 07 — Morning results

Reference: `07-morning-results-phone.png` · Inspect Table `DAY_ANNOUNCE`, public result projection, `DiscussionPanel`, phase action.

```text
Implement only the existing Table DAY_ANNOUNCE phone state to match 07-morning-results-phone.png at 390x844. Use square_day, a clear Morning status and a compact high-contrast public result card. The sample no-elimination message and survivor list are illustrative; bind actual public events/player names, and do not reveal hidden attackers or roles. Reuse DiscussionPanel's current closed-morning state; do not create an event feed. The bottom action must be the existing phase action for the current host/guest, never grant guests host controls. Screenshot compare and stop.
```

### 08 — Day discussion

Reference: `08-day-discussion-phone.png` · Inspect `Table.tsx`, `DiscussionPanel.tsx`, `PlayerGrid.tsx`, chat state, `GameLayout.tsx`.

```text
Implement only the existing Table DAY_DISCUSSION phone state to match 08-day-discussion-phone.png at 390x844. Reuse GameLayout. Keep the phase/status visible, and use its existing Players/Discussion switch for portrait rather than inventing new navigation. Discussion is the default panel if that fits existing state; render only real public messages and the existing composer. The Players panel shows public avatar/name/seat/life status only. Respect send eligibility, message limits, loading/errors and moderation hooks. The bottom phase action remains server/permission-driven. Screenshot compare and stop.
```

### 09 — Voting

Reference: `09-voting-phone.png` · Inspect Table voting state, `PlayerGrid.tsx`, vote state/copy, `DiscussionPanel`.

```text
Implement only the existing VOTING phone state to match 09-voting-phone.png at 390x844. Reuse the same GameLayout and PlayerGrid; use square_dusk. Keep public candidate cards compact and selectable, with avatar, seat/name and life status only. No roles, factions, live tally or voter identities. The selected-candidate dock shows the current private ballot and existing submit state. Abstain is present only if current rules allow. Use existing Players/Discussion switch; do not create new tabs. Preserve vote change/lock behavior from server state. Screenshot compare and stop.
```

### 10 — Revote

Reference: `10-revote-phone.png` · Inspect Table REVOTE state, tie projection, vote hooks and `PlayerGrid.tsx`.

```text
Implement only the existing REVOTE phone state to match 10-revote-phone.png at 390x844. Reuse the Voting components and style; change only phase instruction and candidate set to the current tied eligible players. The number of candidates can vary. Do not show prior/live totals or voter identities. The private selected nominee and submit-revote dock stays clear and reachable. Preserve actual tie outcome rules and server lock/change state; no invented final-tie promise. Screenshot compare and stop.
```

### 11 — Host Overview

Reference: `11-host-dashboard-phone.png` · Inspect `Host.tsx`, `HostShell.tsx`, `HostCanvas.tsx`, `dashboardCopy.ts`, phase action.

```text
Implement only the existing Host Overview phone state to match 11-host-dashboard-phone.png at 390x844. Use HostShell and exact existing Host section labels in its current portrait rail; never substitute generic Roles/Tools/Phases labels. Keep one compact facts surface showing only round, phase, alive, wolf-aligned alive, and infection successes/max/sealed/off from HostDashboard.overview. Use current tokens/icons. The bottom action is PhaseCloseButton's existing phase copy and behavior; do not make a placeholder full-width button. No timeline, invented status or extra controls. Screenshot compare and stop.
```

### 12 — Game results

Reference: `12-game-results-phone.png` · Inspect `Results.tsx`, `VictoryBanner.tsx`, `ResultsRecap.tsx`, result projection/copy.

```text
Implement only Game Results phone layout to match 12-game-results-phone.png at 390x844. Reuse GameLayout, VictoryBanner and ResultsRecap. Use the actual outcome scene and ribbon; stack outcome heading, scene, available Rounds/Infections/Eliminations stats and existing recap content into a readable single column. Preserve canceled-game role privacy and finished-game disclosure rules. Keep Play again wired to existing behavior and outcome. Never invent score, duration, achievements or player data. Screenshot compare and stop.
```

## Completion checklist

- [ ] Shared phone token values come from `theme/tokens.ts`; no duplicate palette.
- [ ] Existing responsive mode, AppShell, GameLayout, SetupLayout and HostShell are reused.
- [ ] All 12 screens match their portrait reference at 390 × 844, with no horizontal overflow or content hidden under bottom actions.
- [ ] Public/host/private information boundaries and server permissions remain intact.
- [ ] Existing scene, role, avatar and UI art IDs are used through `assets/art.ts`.
- [ ] Keyboard/focus behavior, 44px controls, safe-area insets, reduced motion and readable zoom are preserved.
- [ ] Validate each changed screen with the existing web typecheck and relevant Playwright coverage; report exactly what was run.
