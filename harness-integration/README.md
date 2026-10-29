# Whale Girl · Harness desktop integration

Windows integration for [vlln/whale-girl](https://github.com/vlln/whale-girl). This fork keeps the upstream project unchanged and adds the integration in this directory. It is not an official DeepSeek release.

## Features

- Show or hide the desktop pet from the whale button at the bottom of the Harness sidebar, or from Settings → 虚拟宠物.
- Desktop pet UI matching the web pet: hover for the status card (level, tasks, latest memory), click for the 喂食 / 玩耍 / 更换 menu, reply bubble and hearts above the pet.
- Settings page laid out like the built-in Harness settings, using the official Switch, SegmentedControl and Button components (falls back to its own controls if they are unavailable).
- Four sizes, saved position and position reset; transparent areas never block clicks.
- Saved visibility; the companion exits when its Harness host process exits.

## Robustness

- Uses only official extension points (`settings.section`, `sidebar.footer.action`); no DOM injection into Harness menus.
- Only `webServer` is required; whale-girl being missing or renamed does not stop the integration from loading.
- `engines.dsh` is `>=0.2.1-rc.3 <1.0.0-0`, so a Harness minor update does not force-disable the plugin.
- Publishes its port to `%LOCALAPPDATA%/Programs/WhaleGirlDesktop/host.json` for external health checks; records rejected UI requests so an origin change in a Harness update is detectable.
- The desktop runtime uses its own Electron app name and data folder, so other Electron apps cannot take its single-instance lock.

## Install on Windows

Requires Node.js 22 or newer, npm, and DeepSeek Harness 0.2.1 or newer. Close any existing desktop companion before updating its runtime. In the repository root run:

```sh
node harness-integration/install-runtime.mjs
npm pack
npm pack ./harness-integration
```

In Harness's plugin manager, install the generated `whale-girl-*.tgz` and `dsh-whale-desktop-integration-*.tgz`, then enable both. Install from a `.tgz` rather than linking a source folder: uninstalling a linked plugin can delete the source folder's `node_modules`.

Runtime files are installed under `%LOCALAPPDATA%/Programs/WhaleGirlDesktop`. Preferences, position and logs stay there. No Harness profile, credentials, account details or conversations are copied by the installer.

## Validation

```sh
node --test harness-integration/controller.test.mjs harness-integration/index.test.mjs
```