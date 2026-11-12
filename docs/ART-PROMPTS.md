# Art Prompts

Prompts for every illustration the game needs, to generate in ChatGPT. Save each image with its exact file name in the folder named in its section, under `art/`. Each image appears in the game as soon as it is saved: the code uses initials and plain panels for any image that hasn't arrived yet, so you can add art in batches.

All art must be original. The mockups in `docs/werewolf/` set the mood only. Never copy Wolfy or any other product.

The machine-readable list of these files is [`art/manifest.json`](../art/manifest.json). After adding images, run `pnpm art:check` from the repository root. It reports which files are still missing and any that are misnamed, the wrong shape, too small, or not really transparent.

## How to generate

1. **One chat per category:** roles, avatars, scenes, and UI. Paste that category's **setup message** first, then send the image prompts one at a time. ChatGPT keeps the style consistent within a chat.
2. **Image shapes:** each prompt names the shape it needs: square (1:1), landscape (3:2), or portrait (2:3). The exact pixel size does not matter as long as the shape is right and the short side is at least 900 px. ChatGPT's square images are 1254×1254, which is fine.
3. **Transparent backgrounds:** portraits, avatars and UI pieces need a real transparent background. Download the PNG and open it in a viewer. If the grey-and-white checkerboard is painted into the image rather than being real transparency, ask again: "Regenerate with a truly transparent background (alpha channel)."
4. **If the style drifts:** say "Match the exact art style of the first image in this chat," or paste the setup message again.
5. **Save each file with the exact name given**, as PNG, in the folder shown. Don't screenshot, and don't crop or resize; the web build makes the small versions players download.
6. **Scenes in three lighting versions:** generate the day square first. Then upload it in the same chat and ask for the dusk and night versions of the same scene, so all three match.

The shared art style is already included in every setup message below, so each setup message can be pasted as is.

---

## 1. Role portraits: 51 files in `art/roles/`

**Setup message** (paste once at the start of the roles chat):

> For every image I request in this chat, follow these rules. Polished 2D digital illustration for a mobile party game. Storybook cartoon style with soft painterly shading, clean confident outlines, gentle rim light, rich saturated color. Palette: deep purple, midnight blue and teal in shadows; warm orange and gold highlights from lanterns, candles and fire. Spooky but family-friendly: no blood, no gore. Absolutely no text, letters, numbers, logos, watermarks, signatures, borders, frames or UI elements in the image. Square 1:1, 1024×1024. Head-and-shoulders bust portrait of one character, centered, facing slightly toward the viewer. The head sits in the upper-middle with space above it, and the shoulders are cut off at the bottom edge. Light comes from the upper left. Fully transparent background (PNG with alpha): no backdrop, no glow, no floor shadow. Each character's costume includes their team accent color: crimson for wolves, emerald green for villagers, lavender purple for neutrals, silver-blue for independents. Human characters come from a diverse, global mix of ethnicities, ages and genders. Reply with only the image.

Then send each line below as its own message, as "Role: <description>". Save each result as `<file>.png`.

| File | Prompt |
|---|---|
| ✅ `alpha_wolf` | A huge, menacing werewolf leader with charcoal-black fur, a silver streak down the brow, glowing red eyes, a scar across one eye and bared fangs, wearing a torn crimson cloak with a bone clasp. Crimson accent. |
| ✅ `infected_wolf` | A villager halfway through turning into a wolf: torn village tunic, grey fur creeping up the neck and jaw, pointed wolf ears through messy hair, one human eye and one glowing amber eye, a faint sickly green glow at the neckline. Unsettled expression. Crimson accent. |
| ✅ `pack_wolf` | A lean grey werewolf hunter with a scruffy mane, yellow eyes and a confident snarl, wearing a crimson cloth band around one arm. Less imposing than an alpha. Crimson accent. |
| ✅ `seeker` | A sharp-eyed hooded scout holding a small glowing lantern up beside their face, a brass spyglass on a strap, an emerald hooded cloak. Calm, watchful expression. |
| ✅ `guard` | A sturdy village guard in a dented steel helmet and leather armor, holding a round wooden shield with an emerald rim. Steady, protective expression. |
| ✅ `doctor` | A kind village healer in a long white coat with emerald trim, a leather satchel of bandages and herbs, and a small glowing green cross charm on a cord. Gentle, determined look. |
| ✅ `witch` | A young witch in a tall, wide-brimmed purple hat and emerald scarf, holding up two small potion vials, one glowing green and one glowing violet. Clever smile. |
| ✅ `normal_villager` | A friendly farmer in a straw hat and simple linen shirt with an emerald neckerchief and a pitchfork over one shoulder. Honest, warm smile. |
| ✅ `jester` | A grinning jester in a lavender-and-gold three-pointed cap with tiny bells, a ruffled collar and playful, mischievous eyes. |
| ✅ `assassin` | A hooded figure in a lavender-black cowl with a shadowed face. Only the lower face and sharp eyes are visible. A thin dagger is held near the chin, with a small target-shaped mark stitched on the hood. |
| ✅ `cursed_villager` | An ordinary villager in a worn emerald shirt looking anxiously at a dark, swirling curse mark on the back of their raised hand. A faint wolf-shaped shadow looms behind their shoulder. |
| ✅ `lone_wolf` | A solitary werewolf with moon-silver fur, a torn ear, a cold blue gaze and a scarred muzzle, wearing a ragged silver-blue scarf. Proud and alone. Silver-blue accent. |
| ✅ `immortal` | An ageless warrior with a calm face, surrounded by a soft golden aura, wearing an emerald cloak pinned with a phoenix-feather brooch. Faint glowing runes on the skin. |
| ✅ `avenger` | A grim, determined villager with a long emerald scarf blowing sideways, a hand axe over one shoulder and a fierce stare. |
| ✅ `hermit` | A wild-haired, bearded recluse in a mossy, patched hooded cloak, holding a small candle lantern. Wary eyes peek out from under the hood. Lavender accent. |
| ✅ `detective` | A keen investigator in a short caped coat with an emerald lining, holding a brass magnifying glass up to one eye. A small notebook is tucked in the pocket. |
| ✅ `oracle` | A serene woman with a silk blindfold over her eyes, holding a glowing crystal orb that swirls with images, wearing an emerald and gold headpiece. |
| ✅ `tracker` | A rugged ranger in a fur-collared cloak, kneeling slightly and looking down at something, holding a torch. A bow over the shoulder and leaves in the hair. |
| ✅ `psychic` | A mystic with two fingers pressed to one temple, eyes glowing softly, as two thin threads of light trail from the fingers. Emerald and teal robes. |
| ✅ `medium` | A pale, quiet figure holding a single candle, with a translucent ghostly wisp curling around their shoulder. Emerald shawl, calm sad smile. |
| ✅ `prophet` | An old prophet with a long beard and a tall staff topped with a crescent moon, with tiny stars floating around the head. A rolled scroll is tucked in an emerald sash. |
| ✅ `seer` | A silver-haired seer with a softly glowing mark in the center of the forehead and pale glowing eyes, wearing an emerald and silver mantle. |
| ✅ `bodyguard` | A huge, broad-shouldered bodyguard with crossed arms, scars, a heavy square shield strapped to the back and an emerald armband. Stern and immovable. |
| ✅ `shieldbearer` | A young knight peeking over the top of a tall tower shield that bears an emerald leaf emblem (no letters), with a determined look. |
| ✅ `trapper` | A woodsy trapper in a fur hat with a coil of rope and a folded net over one shoulder and a cunning half-smile. Emerald patches on the vest. |
| ✅ `sniper` | A focused marksman in a hood, aiming a crossbow fitted with a brass scope just past the viewer, one eye closed. Emerald scarf over the lower face. |
| ✅ `poisoner` | A sly figure in dark gloves holding up a small bubbling green vial, with a thin smile, a lavender hood and a satchel of bottles. Lavender accent. |
| ✅ `disruptor` | A mischievous trickster holding a smoking, fizzing round bomb, with a broken chain dangling from one wrist and a lavender bandana. Lavender accent. |
| ✅ `shapeshifter` | A figure whose face is half one person and half another, the two halves blending in a swirl of violet mist, holding a cracked mask. Lavender accent. |
| ✅ `confuser` | A trickster with spiraling hypnotic eyes, holding a small hand mirror that reflects a different face, wearing lavender and silver patchwork. Lavender accent. |
| ✅ `spy` | A cloaked spy with a half mask covering the upper face, one finger raised to the lips, with a small brass ear-trumpet at the belt and emerald trim. |
| ✅ `blacksmith` | A muscular blacksmith in a leather apron, holding a glowing hammer, with sparks drifting up, soot on the cheeks and an emerald headband. |
| ✅ `priest` | A gentle robed cleric holding a lit candle, with a simple sun-shaped amulet (no real-world religious symbol) and emerald and white vestments. |
| ✅ `elder` | A very old village elder with a long white beard and a walking staff, kind, wise wrinkled eyes and an emerald shawl. |
| ✅ `mayor` | A proud town mayor wearing a gold chain of office over a fine coat with an emerald sash, holding a ledger book. Slightly pompous smile. |
| ✅ `bard` | A cheerful bard with a feathered cap, a lute held across the chest and an emerald vest, mid-song. |
| ✅ `healer_assistant` | A young apprentice healer carrying a wicker basket of herbs and rolled bandages, with an emerald apron, earnest and eager. |
| ✅ `shadow_wolf` | A wolf standing half in moonlight and half in solid shadow, crimson cloak, one visible amber eye, the other side of the face featureless dark. Crimson accent. |
| ✅ `vampire` | A pale, elegant figure in a high-collared black coat with a lavender lining, faint fangs, and a calm, hungry smile. Lavender accent. |
| ✅ `vampire_servant` | A villager with glassy eyes and a thin lavender ribbon at the throat, posture slightly turned toward someone off-frame, as if listening. Lavender accent. |
| ✅ `joker` | A grinning figure in a lavender coat and a tilted playing-card collar, one eye winked, holding a single blank card. Lavender accent. |
| ✅ `time_wizard` | An elderly village mage in an emerald robe, holding a small brass hourglass that glows warm gold, white hair lifted as if by a breeze. Emerald accent. |
| `guardian` | A broad-shouldered village protector in an emerald cloak and a round shield held across the chest, calm and immovable. Emerald accent. |
| `alchemist` | A village scholar in an emerald apron, three small potion bottles on a bandolier: one green, one violet, one silver. Focused expression. Emerald accent. |
| `fox` | A clever human figure with fox-orange hair and a silver-blue scarf, a small fox mask pushed up onto the forehead, knowing half-smile. Silver-blue accent. |
| `mimic` | A village performer in an emerald coat, one half of the costume echoing another role's silhouette, holding a blank mask at their side. Emerald accent. |
| `ghost` | A translucent village figure in an emerald shawl, soft edges, a finger raised as if about to whisper, no harsh skull. Emerald accent. |
| `mind_controller` | A composed figure in a silver-blue coat, one hand extended, a faint ring of light around the fingertips, expression intent and quiet. Silver-blue accent. |
| `necromancer` | A solitary figure in a lavender hood, one hand open above a small circle of dim candles, the other holding a closed book. Lavender accent. |
| `double_agent` | A villager in an emerald neckerchief worn over a hidden crimson lining, glance over one shoulder, expression unreadable. Split emerald and crimson accent. |
| `chaos_demon` | A playful, non-gory trickster in a silver-blue coat with mismatched buttons, tossing a blank six-sided die, mischievous grin. Silver-blue accent. |

---

## 2. Player avatars: 36 files in `art/avatars/`

**Setup message:**

> For every image I request in this chat, follow these rules. Polished 2D digital illustration for a mobile party game. Storybook cartoon style with soft painterly shading, clean confident outlines, gentle rim light, rich saturated color. Palette: deep purple, midnight blue and teal in shadows; warm orange and gold highlights from lanterns, candles and fire. Spooky but family-friendly: no blood, no gore. Absolutely no text, letters, numbers, logos, watermarks, signatures, borders, frames or UI elements in the image. Square 1:1, 1024×1024. Head-and-shoulders bust portrait of an ordinary villager, centered, facing slightly toward the viewer, friendly and expressive. The head sits in the upper-middle with space above it, and the shoulders are cut off at the bottom edge. Light comes from the upper left. Timeless fantasy-village clothing (cloth, wool, leather; no modern items). Fully transparent background (PNG with alpha): no backdrop, no glow. Every avatar must be easy to tell apart at small size, so give each a distinct hairstyle and a bold main clothing color. Reply with only the image.

Then send each as "Avatar: <description>" and save as `avatar_01.png` through `avatar_36.png`.

| File | Prompt |
|---|---|
| ✅ `avatar_01` | Young East Asian woman, short black bob, round glasses, mustard-yellow knit shawl, cheerful smile. |
| ✅ `avatar_02` | Older Black man, short grey beard, brown flat cap, chestnut waistcoat, warm grin. |
| ✅ `avatar_03` | Young South Asian man, wavy black hair, teal tunic, a satchel strap across the chest, curious look. |
| ✅ `avatar_04` | Northern European woman with red hair in a long braid, freckles, forest-green cloak. |
| ✅ `avatar_05` | Middle-aged Middle Eastern man, neat black beard, maroon vest, embroidered cap, calm eyes. |
| ✅ `avatar_06` | Latina woman with dark curly hair and a sunflower tucked behind the ear, bright orange shawl, laughing. |
| ✅ `avatar_07` | Elderly East Asian man with a long wispy white beard, deep blue robe, a woven hat hanging behind the shoulders. |
| ✅ `avatar_08` | Young Black woman with a tall coiled updo wrapped in a yellow headwrap, royal purple tunic, confident smile. |
| ✅ `avatar_09` | Indigenous man with long black hair tied back, a beaded leather necklace, earth-brown jacket, steady gaze. |
| ✅ `avatar_10` | Bald middle-aged white man with a bushy brown mustache, a baker's apron dusted with flour, jolly expression. |
| ✅ `avatar_11` | Southeast Asian woman with long straight black hair, a flower hairpin, a red and gold sash, gentle smile. |
| ✅ `avatar_12` | Elderly Mediterranean woman with grey curls in a bun, gold hoop earrings, a black shawl, kind eyes. |
| ✅ `avatar_13` | Young Black man with vitiligo patches and short twists, denim-blue tunic, friendly grin. |
| ✅ `avatar_14` | Sikh man in a navy turban with a full dark beard and a saffron-orange scarf, warm, steady smile. |
| ✅ `avatar_15` | Woman in a soft sage-green hijab with an olive tunic and a confident, knowing smile. |
| ✅ `avatar_16` | Pacific Islander man with curly black hair and a shell necklace, a coral-red patterned tunic, big smile. |
| ✅ `avatar_17` | Young woman (about 18) with messy blonde pigtails, freckles, patched light-blue overalls, playful grin. |
| ✅ `avatar_18` | Central Asian woman with high cheekbones, a fur-trimmed hat and a crimson coat, poised and serious. |
| ✅ `avatar_19` | Older South Asian woman with a silver braid, reading glasses on a chain and a magenta shawl, wise smile. |
| ✅ `avatar_20` | Black man with shoulder-length locs, a cream fisherman's knit sweater and a coil of rope on one shoulder, relaxed. |
| ✅ `avatar_21` | East Asian young man with spiky dyed-blue hair and a striped scarf, winking playfully. |
| ✅ `avatar_22` | Elderly Latino man with a white mustache, a wide-brimmed straw hat and a striped wool vest, kindly squint. |
| ✅ `avatar_23` | White woman with short pink hair, a small nose ring and a brown leather jacket with patches, smirking. |
| ✅ `avatar_24` | Young Middle Eastern woman with dark wavy hair, gold earrings and a teal scarf, sly smile. |
| ✅ `avatar_25` | Mixed-race man with a round afro and freckles, round spectacles and a mustard scarf, thoughtful look. |
| ✅ `avatar_26` | Elderly Black woman with a short white afro and a bold geometric-patterned shawl in orange and green, laughing. |
| ✅ `avatar_27` | Older Nordic man with a braided blond-grey beard, a fur collar and an eyepatch, gruff but friendly. |
| ✅ `avatar_28` | South Asian woman with jasmine flowers in her hair, a bright pink scarf draped over one shoulder, a small bindi, radiant smile. |
| ✅ `avatar_29` | Elderly East Asian woman with grey hair in a bun with a hairpin, jade earrings, a lilac jacket, gentle smile. |
| ✅ `avatar_30` | Young Latino man with curly black hair, a green bandana and rolled sleeves, toothy grin. |
| ✅ `avatar_31` | Black woman with a shaved head, gold ear cuffs and a deep blue cloak, cool, serious look. |
| ✅ `avatar_32` | Stocky man with a ginger beard and a red plaid scarf, rosy cheeks, cheerful. |
| ✅ `avatar_33` | Andean woman with two long black braids, a felt hat and a colorful woven poncho, warm smile. |
| ✅ `avatar_34` | Older Southeast Asian man with a thin mustache, small round spectacles and a white linen tunic, serene. |
| ✅ `avatar_35` | Androgynous young person with short asymmetric silver-dyed hair, a small star earring and a lavender coat, confident. |
| ✅ `avatar_36` | Middle-aged woman with long wavy grey-streaked hair, a crown of wildflowers and an amber dress, dreamy smile. |

---

## 3. Scenes: 14 files in `art/scenes/`

**Setup message:**

> For every image I request in this chat, follow these rules. Polished 2D digital illustration for a mobile party game. Storybook cartoon style with soft painterly shading, clean confident outlines, gentle rim light, rich saturated color. Palette: deep purple, midnight blue and teal in shadows; warm orange and gold highlights from lanterns, candles and fire. Spooky but family-friendly: no blood, no gore. Absolutely no text, letters, numbers, logos, watermarks, signatures, borders, frames or UI elements in the image. Landscape 3:2, 1536×1024. A wide environment background for a game screen. **No people, characters or creatures** unless the prompt asks for silhouettes. Keep the important details inside the central 60% of the width, so the image still works when cropped to a tall phone screen. Keep the lower third calm and uncluttered, because player cards and buttons will be laid over it. Reply with only the image.

| File | Prompt |
|---|---|
| ✅ `home_night_village` | A cozy fantasy village at night seen from a hill: thatched cottages with glowing orange windows, a winding path, dark pine forest at the edges, and a huge full moon in the upper right with soft clouds. Two cloaked figures stand as dark silhouettes at the far left and right edges. The center is open sky and hillside, left clear for a title. |
| ✅ `lobby_campfire` | A forest clearing at the edge of the village at night, with a crackling campfire at the bottom center and a ring of empty log benches and tree stumps around it. Cottages with lit windows and a starry sky behind. Warm firelight in front, cool blue shadows behind. No people. |
| ✅ `square_day` | A sunny village square at midday: a cobblestone plaza with a stone well in the center, timber-framed houses with flower boxes, blank cloth banners on poles (no symbols or text), and green hills and blue sky with fluffy clouds. Open plaza floor in the lower half. No people. |
| ✅ `square_dusk` | (Upload `square_day` first.) "Recreate this exact same village square, same layout and camera angle, at sunset: long shadows, an orange and pink sky, the first lanterns being lit." |
| ✅ `square_night` | (Upload `square_day` first.) "Recreate this exact same village square, same layout and camera angle, late at night: deep blue moonlight, a full moon, glowing windows, light mist over the cobblestones, eerie but cozy." |
| ✅ `reveal_wolf` | A dark forest under a huge blood-red full moon, crimson mist between black tree trunks, glowing red eyes faintly in the shadows. Moody and dramatic. The left half is darker and emptier, to leave room for a role card. |
| ✅ `reveal_village` | A warm lantern-lit village lane at night, with golden window light, hanging lanterns and a hopeful, safe feeling. Emerald and gold tones. The left half is darker and emptier, to leave room for a role card. |
| ✅ `reveal_neutral` | A mysterious twilight meadow with swirling violet fog, floating sparkles, a crooked signpost (no text) and a lavender sky full of stars. Playful and enigmatic. The left half is darker and emptier, to leave room for a role card. |
| ✅ `reveal_independent` | A lonely rocky hilltop under a cold silver moon, with wind-bent grass, distant village lights far below and a silver-blue palette. The left half is darker and emptier, to leave room for a role card. |
| ✅ `victory_village` | A joyful sunrise over the village: golden light spilling over cottages, morning mist lifting, birds in the sky, and a hopeful, triumphant mood. Open sky in the upper center for a banner. |
| ✅ `victory_wolves` | A blood-red moon over a dark, silent village, with three werewolf silhouettes howling on a ridge in the upper middle. Ominous crimson and black. Open sky around the moon for a banner. |
| ✅ `victory_lone_wolf` | A single werewolf silhouette howling on a jagged cliff in front of an enormous silver moon, with the empty village far below. Lonely and cold silver-blue. |
| ✅ `victory_neutral` | A whimsical twilight village festival with nobody there: lavender and gold bunting (no text), scattered confetti, glowing paper lanterns and a crooked jester-hat weather vane on a rooftop. Mischievous mood. |
| ✅ `result_draw` | A quiet grey dawn over the village square in thick fog, with an empty plaza and dim lanterns. Neither hopeful nor dark: an uneasy stalemate. |

---

## 4. UI pieces: 10 files in `art/ui/`

**Setup message:**

> For every image I request in this chat, follow these rules. Polished 2D digital illustration for a mobile party game. Storybook cartoon style with soft painterly shading, clean confident outlines, gentle rim light, rich saturated color. Palette: deep purple, midnight blue and teal in shadows; warm orange and gold highlights from lanterns, candles and fire. Spooky but family-friendly: no blood, no gore. Absolutely no text, letters, numbers, logos, watermarks, signatures, borders, frames or UI elements in the image. Follow the size and background instruction in each request exactly. Reply with only the image.

| File | Shape | Prompt |
|---|---|---|
| ✅ `emblem` | Square, transparent | A game emblem: the head of a wolf in profile howling at a crescent moon, inside a circular badge with a deep purple field and a gold rim. Bold and simple enough to read at 32 pixels. Transparent background outside the circle. |
| ✅ `app_icon` | Square, **opaque** | The same wolf-and-moon emblem centered on a solid deep-purple (#2a1248) to midnight-blue gradient that fills the whole square edge to edge. Keep the emblem inside the central 60%, which is the Android icon safe zone. No transparency. |
| ✅ `card_back` | Portrait 1024×1536, opaque | The back of a mysterious tarot-style role card: ornate symmetric gold filigree on deep purple, with a central medallion showing a wolf and a full moon, and small stars in the corners. Fills the whole frame. |
| ✅ `parchment` | Landscape, transparent | A blank, slightly curled aged-parchment scroll, unrolled horizontally, with wooden rollers at the left and right ends. Empty, with no writing at all. Transparent background around the scroll. |
| ✅ `mystery_avatar` | Square, transparent | A head-and-shoulders silhouette of a hooded, faceless figure in deep purple shadow, with only a faint rim of moonlight on the hood. Used for empty seats. Transparent background. |
| ✅ `ribbon_village` *(optional)* | Landscape, transparent | A wide blank ribbon banner with folded ends, in emerald green with gold trim, gently curved. No text on it. Transparent background. |
| ✅ `ribbon_wolves` *(optional)* | Landscape, transparent | The same ribbon banner in crimson with dark gold trim. No text. Transparent background. |
| ✅ `ribbon_lone_wolf` *(optional)* | Landscape, transparent | The same ribbon banner in silver-blue with white trim. No text. Transparent background. |
| ✅ `ribbon_neutral` *(optional)* | Landscape, transparent | The same ribbon banner in lavender purple with gold trim. No text. Transparent background. |
| ✅ `ribbon_draw` *(optional)* | Landscape, transparent | The same ribbon banner in slate grey with silver trim. No text. Transparent background. |

The ribbons are optional because CSS can draw a plain banner if you skip them.

---

## Not generated

- **Small UI icons**, such as infect, kill, shield, heal, potion, magnifier, vote, settings and timer. Generated icons come out inconsistent at small sizes. Cursor will use an icon set, either MUI icons or game-icons.net under CC BY 3.0 with attribution, through the design tokens.
- **Text and the title wordmark.** These are set in a web font, so they stay sharp and can be translated.
- **Dead and selected avatar states.** These are done with CSS (greyscale, a ring) on the same image.

**Total:** 51 roles, 36 avatars, 14 scenes, 5 required UI pieces and 5 optional ribbons, which is 106 required files and 111 in all. The 14 Ultimate 20 portraits above have no check mark because the files are not generated yet.
