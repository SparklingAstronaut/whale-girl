# Decision: Optional Harness desktop integration

Status: implemented

## Problem

The standalone desktop companion requires a separate launch step and does not provide a Harness-owned visibility setting.

## Decision

An optional package in `harness-integration` owns the desktop process, saves visibility and exposes controls through a settings section and account-menu adapter. A Windows runtime installer copies only upstream desktop code and installs a pinned Electron version. Runtime state remains outside the repository.

取代检查：无重叠。The upstream web companion remains unchanged; this optional package adds host lifecycle ownership without replacing the upstream architecture.

## Alternatives considered

A separate desktop shortcut was initially used, but it requires an extra user action and does not provide unified Harness controls.

## Consequences

Both plugins must be enabled. The settings section uses a supported slot, while menu and navigation-icon adaptation depend on the host DOM. Changes to that DOM may require updates. Validation covers controller origin checks, saved preferences and live UI operations; simulated host termination checks companion shutdown.
