# Design

Two committed themes sharing one structure. Tokens live in `app/globals.css`.

## Harvest Noir (default, dark)
Forest-black stock (`oklch(0.158 0.013 158)`), off-white warm ink, a luminous **lime signal** (`oklch(0.905 0.19 124)`) for primary actions and verified states, **wheat gold** for certificates and seals, and **ember** (`--live`) reserved for live auctions and time pressure.

## Field Paper (light)
Cream paper (`oklch(0.972 0.011 95)`), deep forest ink for text and primary buttons, a darker signal green, and a terracotta-leaning gold. The same roles as Noir, so components never branch on theme.

## Type
- Display: **Instrument Serif** (roman + italic). Headlines pair a roman clause with an italic one ("Every harvest, *on the record.*").
- UI: **Geist**. Data, hashes and serials: **Geist Mono** with tabular numerals.
- No eyebrows or kickers above headings; the heading carries itself.

## Signature objects
- **Certificate of origin** (`components/certificate.tsx`): a guilloché rosette, a dashed inner border, a gold wax-style seal with a rotating text ring, and a provenance field grid with a keccak line. The one authored motion is a clip-path + blur reveal with the seal stamping in.
- **Generative field art** (`components/crop-art.tsx`): furrows in perspective, a ridge and a sun, hue-tinted by crop type and seeded by lot ID. Lots never show a stock placeholder.

## Surfaces
`.panel` (card + soft offset shadow), `.panel-flat`, `.glass` (only on the sticky header, filter bar and pills over imagery), `.rule` (dashed hairline), and `.live-dot` (compositor-only ripple). Pill-shaped buttons in `default | outline | ghost | gold | live` variants.

## Rules
- Ember means "live / time-sensitive"; signal means "go / verified"; gold means "certified / sold".
- Animate transform/opacity only for anything that repeats; respect `prefers-reduced-motion`.
- Browser surfaces are themed: selection, caret, scrollbars and focus rings.
