# Whale Girl · Harness desktop integration

Windows integration for [vlln/whale-girl](https://github.com/vlln/whale-girl). This fork preserves the upstream project and adds the integration in this directory. It is not an official DeepSeek release.

## Features

- Show or hide the desktop pet from the Harness account menu.
- A matching pet icon in the account menu and Settings → 虚拟宠物.
- Four sizes, saved position and position reset.
- Saved visibility; the companion exits when its Harness host process exits.
- Original upstream character, animation, feeding and play behavior.

## Install on Windows

Requires Node.js 22 or newer, npm, and DeepSeek Harness with local plugin installation. Tested against Harness 0.2.1. Close any existing desktop companion before updating its runtime.

Clone or download this fork. In the repository root run:

```sh
node harness-integration/install-runtime.mjs
npm pack
npm pack ./harness-integration
```

The first command downloads Electron from its normal npm distribution. In Harness's plugin manager, install the generated `whale-girl-*.tgz` and `dsh-whale-desktop-integration-*.tgz`, then enable both. A pre-existing compatible whale-girl installation can be reused. Reload Harness if the new settings section does not appear. No separate pet shortcut is needed.

Runtime files are installed under `%LOCALAPPDATA%/Programs/WhaleGirlDesktop`. Preferences, position and logs stay there. They are not part of this repository. No Harness profile, credentials, account details or conversations are copied by this installer.

## Usage and limitations

Use the lower-left account menu or Settings → 虚拟宠物. Sizes are 小 (110), 适中 (140), 大 (180), 特大 (220). Larger sizes may look softer because the upstream canvas renders at 110 pixels. Drag to move; click to interact.

Closing the window is not necessarily quitting Harness if it remains in the background. The pet follows the host process. There is no independent Windows login startup entry.

The settings section uses the official slot API. Account-menu placement and the settings navigation icon adapt the current UI DOM because the host does not expose those extension points; a Harness UI update may require changes here. Windows only; this is an experimental source release, not a signed installer.

## Validation

```sh
node --test harness-integration/controller.test.mjs
node --check harness-integration/client.js
node --check harness-integration/desktop-entry.mjs
```

Menu toggling, settings visibility, resizing and reset were exercised in a live Harness installation. Host-exit behavior was tested using a separate simulated host process with the real Electron companion. Full application restart behavior has not been independently exercised on a clean second machine.

## Remove

Hide the pet, uninstall the integration plugin in Harness, then remove the runtime directory if no longer needed. Keep or uninstall whale-girl separately as desired.

## Credits and license

Upstream: Sam Gao / vlln. Character credit: ZipZipPipe, as recorded in the upstream manifest. Existing credits and the root MIT license are retained. Integration additions are also MIT licensed. No personal screenshots or local runtime state are included.

Upstream local gates were also run on Windows: links, assets, configuration, routes, client seams, settings schema and prose checks passed. Existing decision/state-document checks fail with this checkout, and the generated-client checker fails invoking esbuild on Windows. These upstream checks are not claimed as passing.
