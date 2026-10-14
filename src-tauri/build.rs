fn main() {
    println!("cargo:rerun-if-env-changed=TAURI_UPDATER_PUBLIC_KEY");
    println!("cargo:rerun-if-env-changed=TAURI_UPDATER_ENDPOINT");
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "backend_call",
            "create_guest",
            "guest_bounds",
            "guest_call",
            "close_guest",
        ]),
    ))
    .expect("Tauri build failed");
}
