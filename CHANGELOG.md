# Changelog

## Unreleased

## 0.6.12 - 2026-07-28

- Add complete English and Chinese interface text for the annotation modal, commands, ribbon, context menus, rail actions, notices, and settings.
- Follow Obsidian's saved interface language automatically, with English as the fallback.
- Keep the Markdown annotation format and existing annotation data unchanged.
- Restore handwritten annotations and their edit/delete controls in Reading view.
- Hide annotation action buttons when clicking outside the annotation or pressing Escape.
- Shorten the visible action labels to `Edit`/`Delete` and `编辑`/`删除`.

## 0.6.11 - 2026-07-23

- Remove CSS features that the Obsidian review linter only partially supports.
- Replace `!important` overrides with plugin-scoped selectors that retain the annotation rail, arrow, and button layout.
- Add release checks that reject `box-decoration-break`, `text-decoration`, and `!important` before publishing.
- Preserve wrapped highlights and use a subtle scale transition for annotation hover feedback.

## 0.6.10 - 2026-07-22

- Keep `styles.css` below the Obsidian Sync Standard 5 MB file limit by embedding a common Simplified Chinese subset of LXGW WenKai Lite.
- Add a lockfile, lockfile-based CI installs, rerunnable releases, and signed GitHub artifact attestations for reproducible, verifiable releases.
- Expand the hover underline shorthand into explicit CSS properties for clearer compatibility checks.
- Include the revised product-only README.

## 0.6.9 - 2026-07-22

- Make the community release self-contained by embedding both handwriting fonts in `styles.css`.
- Add a public release workflow, release validation, version metadata, and an MIT license for the plugin code.
- Update the community directory description to follow Obsidian's submission requirements.
- Remove the unnecessary single-section settings heading to follow Obsidian's UI guidelines.

## 0.6.8 - 2026-07-22

- Reduce the arrow-tip gap beside annotated prose from about 23px to 16px.
- Group earlier automatic annotations above the prose and later ones below it, instead of alternating sides mechanically.
- Extend arrows through additional collision lanes and anchor bottom annotations to the target's last rendered line.
- Keep the original arrow path and non-overlapping document flow unchanged.

## 0.6.7 - 2026-07-22

- Shorten the plugin-list description to `add colorful handwritten-style annotations`.
- Clarify that mdtask.dev provided visual inspiration only; this is an independent, unaffiliated project with no integration or functional dependency.

## 0.6.6 - 2026-07-22

- Rename the user-visible plugin name to `linqq-handwritten annotation`.
- Preserve the internal plugin ID `visual-annotations` for backward compatibility.
- Migrate the project into the governed Desktop workspace with session records and artifacts.

## 0.6.5 - 2026-07-22

- Distribute automatic annotations above and below the annotated text.
- Pack non-overlapping annotations into a shared horizontal lane.
- Add collision lanes only when labels actually intersect.
- Recalculate positions when the rail width changes.

## 0.6.4 - 2026-07-22

- Replace the guessed arrow with the exact mdtask.dev SVG path.

## 0.6.3 - 2026-07-22

- Experimental curved arrow. Superseded because it introduced an unwanted S-shaped shaft.

## 0.6.2 - 2026-07-22

- Keep handwritten text and its arrow in one marker component so they move together.

## Earlier iterations

- Added editable and removable Markdown annotations.
- Added color selection, bundled Shantell Sans and LXGW WenKai Lite fonts, and non-overlapping document-flow rails.
