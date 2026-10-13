mod desktop;
mod guests;

pub fn run() {
    let context = tauri::generate_context!();
    #[cfg(debug_assertions)]
    let context = {
        let mut context = context;
        if let Some(directory) = std::env::var_os("AI_TOOL_BOX_TEST_DATA_DIR") {
            context.config_mut().app.windows[0].data_directory =
                Some(std::path::PathBuf::from(directory).join("main-webview"));
        }
        if std::env::var("AI_TOOL_BOX_NATIVE_TEST").as_deref() == Ok("1") {
            let url = context
                .config()
                .build
                .dev_url
                .as_ref()
                .unwrap()
                .join("tests/fixtures/tauri-main.html")
                .unwrap();
            context.config_mut().app.windows[0].url = tauri::WebviewUrl::External(url);
            context.config_mut().app.windows[0].visible = false;
        }
        context
    };
    tauri::Builder::default()
        .manage(guests::GuestState::default())
        .manage(desktop::SettingsLock::default())
        .invoke_handler(tauri::generate_handler![
            desktop::desktop_request,
            guests::create_guest,
            guests::update_guest_bounds,
            guests::guest_action,
            guests::evaluate_guest,
            guests::close_guest,
        ])
        .run(context)
        .expect("failed to run AI Tool Box");
}
