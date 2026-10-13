fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "desktop_request",
            "create_guest",
            "update_guest_bounds",
            "guest_action",
            "evaluate_guest",
            "close_guest",
        ]),
    ))
    .expect("failed to build Tauri application");
}
