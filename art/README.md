# Art

The game's illustrations. Each PNG here is committed, and the web build turns it into a small WebP file for players, so you never resize or convert anything by hand.

| Folder | What | Count |
|---|---|---:|
| `roles/` | Role portraits, named by role id, for example `alpha_wolf.png` | 37 |
| `avatars/` | Player portraits, `avatar_01.png` to `avatar_36.png` | 36 |
| `scenes/` | Backgrounds, for example `square_night.png` | 14 |
| `ui/` | Emblem, app icon, card back, parchment, empty-seat silhouette, optional ribbons | 10 |

Prompts and exact file names are in [`docs/ART-PROMPTS.md`](../docs/ART-PROMPTS.md). The full list is [`manifest.json`](./manifest.json).

Rules:

- PNG, saved with the exact file name: lowercase, with underscores.
- The shape must match the manifest's `aspect` (square 1:1, landscape 3:2, or portrait 2:3), with the short side at least 900 px. ChatGPT's 1254×1254 squares are fine.
- Assets marked `transparent` need a real transparent background, not a painted checkerboard.
- Original art only. Nothing copied from other games.

After adding images, run this from the repository root:

```sh
pnpm art:check
```

It lists what is still missing and reports any file that is misnamed, the wrong shape, too small, or not really transparent. Missing files are fine while generation is in progress; the game shows initials and plain panels until they arrive.

How the code finds an image: `apps/web/src/assets/art.ts` picks up every file in these folders by name. `roleArtUrl('alpha_wolf')` returns a URL once `roles/alpha_wolf.png` exists, and `null` before that.
