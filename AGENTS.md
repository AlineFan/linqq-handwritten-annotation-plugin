# Project instructions

- Preserve the internal Obsidian plugin ID `visual-annotations`.
- Keep the user-visible name `linqq-handwritten annotation`.
- Edit `styles.source.css`, then run `npm run build`; never hand-edit generated `styles.css`.
- Keep the release self-contained. Obsidian installs only `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release.
- Preserve both font license files in `licenses/`. Plugin code is MIT; the bundled fonts remain under their original SIL Open Font License terms.
- Run `npm run build`, `npm test`, and `npm run verify` before tagging a release.
- Do not add private notes, conversation logs, vault content, local screenshots, or historical build artifacts to this public repository.
