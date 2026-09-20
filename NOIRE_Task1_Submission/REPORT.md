# Task 1 Report: NOIRE Landing Page (HTML + CSS)

## What I built
A single-page, static landing page for NOIRE, a premium fashion label, based on the high-fidelity design I made in Figma. It uses only HTML and CSS, with no JavaScript and no frameworks. The page has a header with dropdown navigation, a full-screen hero, four editorial sections, a "Just in" product grid, a newsletter sign-up and a footer.

**Files**
- `index.html` — page structure
- `css/style.css` — all styling
- `images/` — photos used on the page
- `REPORT.md` — this report

## Design decisions
**Colour and type.** I kept the palette from the design: warm cream background (`#FDEFDF`), near-black brown (`#221714`) for buttons and footer, and one accent orange (`#C9481F`) used only for links. Limiting the accent to links makes them easy to spot. The font is Ubuntu Sans, with system fonts as a fallback so the page still looks fine offline.

**Editorial feel.** The design relies on whitespace and large photography instead of boxes and borders. I kept text short, used generous spacing, and let the images carry each section.

**Design tokens.** Colours, header height, page gutter and column gap are CSS variables in `:root`. Changing the theme means editing a few lines, and spacing stays consistent everywhere.

## Semantic HTML
- `header` with a `nav` (main links plus a separate tools list), `main` with one `section` per content block, and `footer` with labelled `nav` groups.
- One `h1` (the hero headline), `h2` per section, `h3` for menu and footer group titles, so the heading outline is clean.
- Every section is linked to its heading with `aria-labelledby`.
- Photos are in `figure` elements; product cards use `figcaption` for name and price. All images have descriptive `alt` text and `width`/`height` attributes, which stops the page jumping while images load.
- The product grid and lists use real `ul`/`ol` elements. The Evening Edit is an ordered list because the design numbers it.
- The newsletter form has a proper `label` (visually hidden), `type="email"` and `required`, so the browser validates it without JavaScript.
- A "Skip to content" link is the first focusable element.

## CSS organisation
`style.css` is split into numbered sections (tokens, base, utilities, header, buttons, hero, panels, product grid, newsletter, footer, responsive). Class names follow a simple block/element pattern (`panel__text`, `hero__content`). Media queries live together at the end, so the base styles read as the desktop design and the queries only list what changes.

## Layout strategies
- **Header:** `position: sticky` with a translucent cream background, so it stays visible while scrolling.
- **Content panels:** CSS Grid with two columns (`.85fr 1.15fr`). A `--reverse` modifier flips the ratio for image-left sections. Panels use `min-height: 100vh` minus the header, matching the full-screen feel of the design.
- **Product grid:** Grid with 4 columns, then 2 on tablets. Images use `aspect-ratio: 4/5` and `object-fit: cover`, so photos with different crops line up.
- **Hero:** the image is absolutely positioned behind the text with `object-fit: cover`, so it fills any screen size.
- **Spacing:** `clamp()` for font sizes, gutters and gaps, so things scale smoothly between breakpoints instead of jumping.

## Responsiveness
| Width | What changes |
|---|---|
| Above 1100px | Full desktop layout: 4-column grid, 5-column footer, hover dropdowns |
| 1100px and below | Product grid goes to 2 columns, footer to 3 |
| 900px and below | Navigation collapses into a hamburger menu, panels stack (image first), newsletter stacks |
| 600px and below | Hero stacks (text above photo), newsletter form goes vertical |

I tested at 1440, 1024, 768 and 390px in Chromium and checked that there is no horizontal scrolling at any of those widths. I have not yet tested in Safari or Firefox.

## Challenges and how I solved them
1. **The hero headline was part of the photo.** My only source for the photos was a screen recording of my Figma prototype, so the headline was part of the image. Baked-in text is bad for accessibility, SEO and responsiveness. I rebuilt a text-free hero image by sampling the wall colour next to the text and extending it across the left side with a soft gradient and a little grain to match the photo. The headline is now real, selectable text.
2. **Text unreadable on phones.** On a narrow screen the model's dark coat sat directly behind the headline. Below 600px I stacked the hero, with the text first on the wall colour and the photo underneath.
3. **A dropdown and a mobile menu with no JavaScript.** The desktop dropdowns open with `:hover` and `:focus-within`, so keyboard users can open them too. The mobile menu uses the checkbox technique: a hidden checkbox plus `:checked` shows the menu, and the label is styled as a hamburger. The trade-off is that `aria-expanded` cannot update without JavaScript, so this would be the first thing I improve with a small script.
4. **Sticky header and full-height sections.** Sections sized with plain `100vh` were hidden partly behind the header, and mobile browser toolbars changed the height. I stored the header height in a variable, subtracted it from the section height, used `100svh` where supported, and added `scroll-padding-top` so anchor links land below the header.
5. **Photos in different shapes.** The source images have different sizes and crops. Fixed aspect ratios with `object-fit: cover` keep the grid tidy without distorting anyone.
6. **Fixing errors from the design.** I corrected typos from the mockup ("Autum", "WORL") and used a single currency symbol throughout.

## Limitations and next steps
- Links are anchors within the page, since this task is a single static page.
- The image files were cropped from that screen recording, so they are fairly low resolution; I would use the original photography in a real build.
- Next step would be a little JavaScript for the menu state and the newsletter form, then extra pages (shop, product).
