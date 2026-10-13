# Tests

## Current Tauri Application

- `pnpm check`: Svelte and TypeScript diagnostics.
- `pnpm icons` followed by `pnpm test:rust`: native validation unit tests.
- `pnpm test`: browser UI regression and native-view adapter lifecycle tests.
- `pnpm test:native`: real Windows WebView2 integration with local fixtures.
  Start `pnpm dev:web`, generate icons and run `cargo build --manifest-path src-tauri/Cargo.toml`
  first. The test uses a hidden app and a separate `.cache/tauri-native-*` profile.
