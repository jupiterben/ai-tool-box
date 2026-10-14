# UI Conventions

The application reuses its Svelte controls, Lucide icons, and CSS Modules.
Do not introduce a second visual system for individual pages.

## Theme

- `src/styles/tokens.css`: typography, 4px spacing scale, radii, control sizes.
- `src/styles/themes/{light,dark}.css`: semantic colors.
- `src/styles/shadcn.css`: maps shadcn variables to the same semantic colors.
- Neutral surfaces, teal for primary actions and selection, separate semantic
  success, warning, error, and information colors.
- Use semantic tokens in components. No decorative gradients or hover movement.

## Layout

- Sidebar: 224px expanded, 64px collapsed. Navigation stays available in both.
- Workspace: 64px heading bar, platform tabs, webview, platform selection, input.
- Platform selection is collapsible and scrolls independently when space is tight.
  It starts collapsed in short windows (560px or less).
- Settings use a shared heading, unframed sections, and a 1040px content limit.
  Website tables can use 1280px, with horizontal scrolling confined to the table.
- Use framed cards only for repeated entities such as proxy/location profiles.
- Below 760px the summary occupies the workspace instead of compressing both panes.

## Controls

- Reuse `components/ui` for buttons, inputs, selects, toggles, and segments.
- Standard heights: 32px compact, 36px default, 44px touch.
- Use 6px control radii and no more than 8px for framed content.
- Use icons with accessible names and tooltips for compact tool actions.
- Use native checkboxes for multiple selection and toggles for binary settings.
- Preserve keyboard focus rings and respect reduced motion.
- Form labels and input values must remain readable in both themes.

## Verification

Run `pnpm check`, `pnpm build:web`, and `pnpm test`. UI coverage includes both
themes at desktop, tablet, phone, and short landscape viewport sizes, plus
navigation, disclosure state, settings persistence, and narrow summary panels.
Browser tests do not contact real AI services; native webviews require Tauri.
