# Kiezpigeon

A Chrome extension for the Berlin flat hunt: it reads the listing you are
looking at, writes a short German application letter from your profile and
fills the listing's contact form.

**It never submits.** You review everything and press Send yourself.

**Your data stays on your device.** Profile, letters and tracker live in the
extension's local storage. The only network request is the letter
generation call to Claude, made when you ask for a letter.

Work in progress: see [PLAN.md](PLAN.md) for the tiered plan and
[PHASES.md](PHASES.md) for the build phases. Decisions are in
[docs/decisions.md](docs/decisions.md).

## Build and load unpacked

Needs Node 24 (`nvm use` reads `.nvmrc`) and Chrome.

1. `npm ci`
2. `npm run build`
3. Open `chrome://extensions`, switch on Developer mode, click "Load
   unpacked" and choose `.output/chrome-mv3/`.
4. Click the Kiezpigeon icon in the toolbar to open the side panel.

For development, `npm run dev` starts WXT with live reload. Before a pull
request: `npm run lint && npm test && npm run build`.

Kiezpigeon is not affiliated with ImmoScout24 or any listing site.
