# Pizza 42 design system

## Creative direction

**North star: the mouth of the oven.**

Pizza 42 sells wood-fired pizza in Dublin, mostly after dark, mostly to people
who are hungry now. The storefront is lit like the thing it sells: a warm
near-black room, one hot orange that always means "act", and a photograph of
live fire doing the work.

The previous system framed the brand as a kitchen pass rendered in service blue
and set in a display serif. It was competent and it was invisible, because it
described an operations dashboard rather than food. Two rules replace it:

1. **Photography carries the page.** A pizza site without pizza on it has
   failed. Colour, type and layout support the food; they do not substitute for
   it. Shipping a coloured panel where a photograph belongs is a bug.
2. **Heat is the brand.** Warmth comes from the palette and the imagery, not
   from a beige canvas. There is no cream, sand or parchment anywhere in this
   system.

The guest storefront is expressive: full-bleed hero, large type, motion. The
authenticated ordering view shares the exact palette but drops to a dense,
quiet, task-shaped layout, because at that point the order is the job. Identity
evidence lives in the Behind the counter panel, which the customer never opens.

## Design tokens

```yaml
colors:
  char: "oklch(17.2% 0.016 52)" # page ground, #160e09
  char-deep: "oklch(12.2% 0.013 52)" # header, wells, code, #0a0503
  char-raised: "oklch(22.8% 0.019 52)" # panels, basket, thumbs, #241a14
  char-lift: "oklch(29.2% 0.021 52)" # hover fills, disabled, #352922
  ember: "oklch(68.8% 0.19 44)" # primary action only, #f66a1c
  ember-hot: "oklch(62.2% 0.196 38)" # active press, #e34d12
  flame: "oklch(82.2% 0.15 72)" # highlight, hover, code, #ffb346
  cream: "oklch(96.8% 0.01 68)" # primary text, #f9f3ed
  mute: "oklch(78.8% 0.018 62)" # secondary text, #c3b8ae
  faint: "oklch(66% 0.018 62)" # labels, metadata, #9b9087
  live: "oklch(80% 0.15 152)" # success, open state, #69d98d
  warning: "oklch(84% 0.14 86)" # recoverable attention, #f3c351
  danger: "oklch(70% 0.17 28)" # errors, #f66e60
  focus: "oklch(86% 0.14 88)" # focus ring, #f7cb58
typography:
  display: "Bricolage Grotesque (variable, self-hosted)"
  interface: "system UI sans-serif"
  technical: "system monospace"
radius:
  control: "0.3rem"
  panel: "0.75rem"
  arch: "999px 999px 0.3rem 0.3rem"
layout:
  contentWidth: "min(100% - 2.5rem, 76rem)"
```

`--char` and `--ember` are also the Universal Login page background and primary
color. They are recorded in `auth0/tenant-config.md`; change both together.

Every text/background pair in this system was measured against WCAG 2.2 AA. The
tightest is `faint` on `char-raised` at 5.46:1; `mute` over the hero scrim at
its lightest stop, assuming a pure-white pixel underneath, is 7.47:1.

## Brand mark

The mark is the oven mouth: an arch, filled ember, with `42` knocked out of it
in the page ground colour. It is square, works at favicon size, and needs no
wordmark to be recognisable.

The in-app lockup pairs a small ember arch with **Pizza 42** and
**Wood-fired · Dublin**. Do not put the mark in a circle, rotate it, add a food
illustration to it, or render the numerals in anything but the heaviest weight
available.

## Typography

Bricolage Grotesque, self-hosted as a 30 KB variable `latin` subset, is used for
the hero, section headings, dish names, the brand lockup, prices and the basket
total. Everything else (labels, buttons, body copy, account state, form
controls) uses the native interface font, which is faster and more familiar in a
task surface. Monospace is reserved for identifiers and operational evidence.

- Hero display: `clamp(2.7rem, 6.6vw, 5.4rem)`, weight 780, tracking -0.032em,
  line height 0.98. The 5.4rem ceiling and the -0.04em tracking floor are hard
  limits; below the floor the letters touch.
- Section heading: `clamp(2.1rem, 4.4vw, 3rem)`.
- Dish name: 1.42rem showcase, 1.16rem in the ordering rows.
- Body: 0.84rem to 1.03rem, 1.55 to 1.62 line height, capped near 46ch.
- Technical text: 0.68rem to 0.77rem.

Headings use `text-wrap: balance`; prose uses `text-wrap: pretty`.

## Photography

Photography is a required part of this system, not decoration.

- Four images live in `web/public/img/`, each at two or three widths, served
  through `srcset`/`sizes`. Provenance and licence are in `img/CREDITS.md`.
- The hero is eager with `fetchpriority="high"` and preloaded from
  `index.html`; dish images below the fold are `loading="lazy"`.
- Every image carries `width`/`height` so nothing shifts on load.
- Replacements must keep the mood: ember-lit, dark ground, food filling the
  frame. The tiles are designed to read as one set, so a bright white-background
  stock shot will break the page even if the food looks fine alone.
- Alt text describes the dish as a customer would see it, not the file.

The dish-to-photograph mapping lives in `Pizza42App.jsx`, keyed by SKU, and
falls back to a typographic tile for any SKU that has never been shot. The menu
API deliberately knows nothing about art direction.

## Signature elements

### The hero

Full-bleed photograph, two crossed scrims (vertical for ground under the copy,
horizontal to protect the left column from whatever the crop does), and a
breathing radial glow pinned over the flame in the image. Copy sits bottom-left
inside the content measure. The header floats over it with no background.

### Service rail

A solid ember band directly under the hero carrying four concrete facts. Four
columns on desktop, two on phones. This is the only place uppercase is used at
any length.

### Dish tiles

Guest: a 4:3 photograph with a 12px radius, an ember price chip overlaid at the
bottom-left, and the name and description set underneath with no container. No
borders, no shadows, no card. The photograph is the object.

Ordering: the same dishes as 88px square thumbnails in dense rows with a hairline
between them, price inline, Add button on the right.

### Behind the counter

The presenter's surface, and the successor to the old Session details
disclosure. A side panel, opened from a quiet control in the app header or by
pressing `?`, carrying two tabs: the claims in each token side by side, and the
derived marketing profile beside the copy the Action signed at login.

Three rules keep it from turning the storefront into a dashboard:

1. **It is never open by default and never part of the ordering flow.** A hungry
   customer can use this site for a year without discovering it exists.
2. **Above 72rem the page steps aside rather than being covered**, because the
   panel's whole reason to exist is that an order and the evidence for that
   order can be looked at together. Below that it takes the screen.
3. **It shares the storefront palette exactly.** It should read as this product
   with a panel pulled out, not a debug console bolted to a pizza shop. Ember
   still marks actions only; evidence uses `flame` and the state colours,
   because a panel where everything glows tells you nothing.

Values in the panel are read, never asserted: it shows what a token says and
what the API publishes, and neither is a check anything depends on.

The panel states values and does not explain them. Its reader already knows
what an audience claim is, and a caption telling them would read as a lecture.
Where something genuinely needs saying — why two columns disagree — one line
says it. Row labels carry no commentary.

### Order summary

Ember top edge on a raised panel, sticky above 62rem and in flow below it.
Empty, active, submitting, success and error states are all inline.

## Interaction and accessibility

- Target WCAG 2.2 AA. Controls are at least 44 CSS pixels, including the
  quantity steppers.
- Focus is a 3px `--focus` gold ring at 3px offset, visible on every surface.
- Transitions run 150 to 250 ms on `--ease-out-quint` / `--ease-out-expo`. No
  bounce, no elastic.
- **Never build an entrance on opacity.** A transition or keyframe that starts
  at `opacity: 0` pins at that value whenever frames are not composited, which
  happens in a backgrounded tab at load, a headless screenshot and some embedded
  webviews, and the section then ships blank. `@starting-style` does not fix
  this; it hangs the same way. The hero deliberately has no fade-and-rise. The
  entrance is the image settle and the hearth glow, neither of which can hide
  content: their worst case is a 9% crop and a steady glow.
- `prefers-reduced-motion` removes all animation and smooth scrolling, and pins
  the hearth glow to a fixed opacity.
- The layout works at 320 CSS pixels with no horizontal scrolling.
- Meaning never depends on colour alone: verification state pairs an icon with
  text, order results pair an icon with a sentence.
- Do not set `overflow-x: hidden` on `body`. It silently breaks scrolling and
  `position: sticky` in some engines; fix the overflowing element instead.

## Content rules

- Customer copy is about pizza. Protocol names, identifiers and anything a
  hungry person would not say stay inside Session details or the docs.
- A test asserts that guest-facing copy contains none of `Auth0`, `password`,
  `token`, `identity`, `secured` or the substring `api`. That last one rules out
  otherwise-innocent words like "rapid" and "capital"; check new copy against it.
- The marketing profile is always labelled as a simulated Segment destination.
- The colophon states that this is a proof of concept and that no payment is
  taken and no order reaches a kitchen.
- Buttons name their result: Start your order, Create an account, Place order,
  I've confirmed it.
- Copy never scolds the customer for the state their account is in, and never
  grants them permission to use the site. An unconfirmed email is one step left
  in a process, not a failing: "One step before your first order", not "Confirm
  your email to order" over "Browse all you like".

## Avoid

- Any light, cream, sand, beige or parchment surface. This brand is dark.
- Display serifs. Fraunces in particular was the previous direction and is a
  training-data default; do not reintroduce it.
- Numbered section markers (`01 / 02 / 03`) and small tracked eyebrow labels
  above every section. Both were in the previous build and both are scaffolding.
- Card grids with borders plus wide soft shadows, and radii above 16px on
  panels.
- Gradient text, glass panels, repeated icon cards, generic SaaS sections.
- Bright red-and-yellow fast-food branding.
- Security-dashboard imagery, token visualisations, or raw tokens anywhere in
  the customer journey. Behind the counter is not the customer journey: it may
  show decoded claims and offer a token to the clipboard, and it is the only
  surface that may. A raw token is still never printed on screen.
- Ember as decoration. It marks the primary action, the price chip, the service
  rail and the basket edge. Nothing else.
