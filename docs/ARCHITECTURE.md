# Apaga Sub Architecture

## Components

- `manifest.json`: Chrome MV3 permissions and content script registration.
- `src/popup.html`: popup controls and user-facing workflow.
- `src/popup.js`: orchestration, storage, history, settings, and calls into Gmail.
- `src/content.js`: DOM automation inside `mail.google.com`.
- `src/popup.css`: popup layout and state styling.

## Message Flow

The popup calls `chrome.tabs.sendMessage` after ensuring `src/content.js` is injected with `chrome.scripting.executeScript`.

Main message types:

- `runSearchGmail`: fills Gmail search and triggers the search action.
- `getCurrentSenderGmail`: reads the currently visible sender.
- `scanVisibleGmail`: lists visible Gmail rows.
- `scanPageGmail`: opens visible rows and finds unsubscribe actions.
- `unsubscribeVisibleGmail`: performs unsubscribe actions.
- `cleanupVisibleGmail`: selects and deletes, simulates, or selects for quarantine.
- `diagnoseGmail`: reports selector health for search, rows, selection, trash, and pagination.

## Cleanup Safety

Destructive actions are guarded by:

- confirmation dialogs;
- blocked domains;
- protected keywords;
- optional recent dry-run requirement;
- audit plans saved before destructive actions;
- selection-active validation before clicking the trash button;
- configurable page limit;
- stop flag stored in `chrome.storage.local`.

Blocked or protected selected items are unchecked and skipped so allowed items can continue.

## Gmail DOM Risks

This extension automates Gmail's visual interface, not the Gmail API. Risk points:

- Gmail may change button labels, roles, classes, or toolbar layout.
- Pagination controls may be disabled or hidden depending on result count.
- Selection state can take time to appear after choosing `Todos`.
- Trash button detection depends on visible toolbar controls.

Use `Diagnóstico`, `Testar paginação`, and `Simular apagar` before increasing limits.

## Storage

Stored keys:

- `blockedDomains`
- `protectedKeywords`
- `requireDryRun`
- `uiPrefs`
- `cleanupHistory`
- `unsubscribeHistory`
- `runReports`
- `auditPlans`
- `dryRuns`
- `lastOperation`
- `cleanupStopRequested`
- `updateCheck`

## Manual Updates

The popup reads only the public `manifest.json` from GitHub to compare versions. It never downloads or executes remote code. The result is cached locally for six hours.

For installations loaded from the fixed Git clone at `/opt/extchrome/apagasub`, `scripts/update.sh` fetches `origin/main`, accepts only a fast-forward update, validates JavaScript and the manifest, and rebuilds the ZIP. Chrome still requires an extension reload or browser restart to apply changed unpacked files.

`updater/server.py` adds an optional one-click path on `127.0.0.1:17853`. It accepts only extension origins, exposes no arbitrary arguments, serializes update runs, and invokes the fixed update and site-deploy scripts. The popup calls `chrome.runtime.reload()` only after a successful response.

## Release Checklist

1. Run `node --check src/popup.js`.
2. Run `node --check src/content.js`.
3. Run `scripts/package.sh`.
4. Reload the Chrome extension.
5. Reload Gmail.
6. Test `Diagnóstico`, `Filtrar remetente`, `Simular apagar`, then `Apagar pág. atual`.
