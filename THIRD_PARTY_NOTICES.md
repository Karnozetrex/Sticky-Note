# Third-Party Notices & Licenses

StickyPad includes or relies on the following third-party assets and open-source packages:

---

## 1. Typography & Fonts

### Caveat
- **Author**: Pablo Impallari
- **License**: SIL Open Font License, Version 1.1 (OFL-1.1)
- **Source**: [Google Fonts - Caveat](https://fonts.google.com/specimen/Caveat)
- **Usage**: Bundled locally in `assets/fonts/Caveat.ttf` for handwriting typography.

### Patrick Hand
- **Author**: Patrick Neveu
- **License**: SIL Open Font License, Version 1.1 (OFL-1.1)
- **Source**: [Google Fonts - Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand)
- **Usage**: Bundled locally in `assets/fonts/PatrickHand.ttf` for manga/sketch typography.

---

## 2. Dependencies

### Electron
- **Publisher**: OpenJS Foundation and Electron contributors
- **License**: MIT
- **Usage**: Desktop application runtime container.

### electron-builder
- **Publisher**: electron-builder contributors
- **License**: MIT
- **Usage**: Development build tooling and installer packager.

---

## 3. Audio & Graphics

### Procedural Web Audio Synthesis
- **License**: MIT
- **Implementation**: Written in-house (`src/renderer/soundEffects.js`) using the browser Web Audio API (`AudioContext`). No proprietary or external audio samples are distributed with this software.

### Application Icons & Visuals
- **License**: MIT
- **Implementation**: Rendered via custom inline SVGs and built using `scripts/generate-assets.js`.
