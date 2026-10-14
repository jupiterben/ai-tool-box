use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct HostState {
    pub proxies: Mutex<HashMap<String, Value>>,
    pub update: tokio::sync::Mutex<Option<(Update, Vec<u8>)>>,
    pub updating: tokio::sync::Mutex<()>,
}
pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("AI_TOOLBOX_TEST_DATA_DIR") {
        let path = PathBuf::from(path);
        if !path.is_absolute() {
            return Err("Test data path must be absolute".into());
        }
        return Ok(path);
    }
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(if cfg!(debug_assertions) {
        path.join("dev-release")
    } else {
        path.join("release")
    })
}
pub fn migrate_legacy_settings(app: &AppHandle) -> Result<(), String> {
    #[cfg(debug_assertions)]
    if std::env::var_os("AI_TOOLBOX_TEST_DATA_DIR").is_some() {
        return Ok(());
    }
    let target = data_dir(app)?;
    let marker = target.join("electron-json-imported");
    if marker.exists() {
        return Ok(());
    }
    let legacy = app
        .path()
        .config_dir()
        .map_err(|e| e.to_string())?
        .join("ai-tool-box");
    let legacy = if cfg!(debug_assertions) {
        legacy.join("dev")
    } else {
        legacy
    };
    if !legacy.is_dir() {
        return Ok(());
    }
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    for name in [
        "preset-registry.json",
        "proxy-settings.json",
        "geolocation-settings.json",
        "tool-settings.json",
        "llm-settings.json",
        "image-gen-api-settings.json",
        "agent-cli-settings.json",
    ] {
        copy_json_if_missing(&legacy.join(name), &target.join(name))?;
    }
    let presets = legacy.join("presets");
    if presets.is_dir() {
        for entry in std::fs::read_dir(presets).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !crate::views::valid_id(&name)
                || !entry.file_type().map_err(|e| e.to_string())?.is_dir()
            {
                continue;
            }
            for file in [
                "proxy-settings.json",
                "geolocation-settings.json",
                "tool-settings.json",
            ] {
                copy_json_if_missing(
                    &entry.path().join(file),
                    &target.join("presets").join(&name).join(file),
                )?;
            }
        }
    }
    std::fs::write(
        marker,
        b"Only JSON settings imported; browser sessions and encrypted keys require re-entry.",
    )
    .map_err(|e| e.to_string())
}
fn copy_json_if_missing(source: &std::path::Path, target: &std::path::Path) -> Result<(), String> {
    if target.exists() || !source.is_file() {
        return Ok(());
    }
    let bytes = std::fs::read(source).map_err(|e| e.to_string())?;
    serde_json::from_slice::<Value>(&bytes)
        .map_err(|e| format!("Cannot import {}: {e}", source.display()))?;
    std::fs::create_dir_all(target.parent().ok_or("Missing settings directory")?)
        .map_err(|e| e.to_string())?;
    std::fs::write(target, bytes).map_err(|e| e.to_string())
}
fn text<'a>(value: &'a Value, key: &str) -> Result<&'a str, String> {
    value[key].as_str().ok_or_else(|| format!("Missing {key}"))
}
fn credential(app: &AppHandle) -> Result<keyring::Entry, String> {
    let scope = data_dir(app)?;
    keyring::Entry::new("com.ai-tool-box.tauri", &format!("{}:llm", scope.display()))
        .map_err(|e| e.to_string())
}
pub async fn dispatch(app: &AppHandle, method: &str, params: Value) -> Result<Value, String> {
    match method {
        "window:create" => {
            let preset = text(&params, "presetId")?;
            if !crate::views::valid_id(preset) {
                return Err("Invalid preset ID".into());
            }
            let label = format!("preset-{preset}");
            if app.get_window(&label).is_some() {
                return Ok(Value::Null);
            }
            let mut builder =
                WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
                    .title(text(&params, "title")?)
                    .inner_size(1200.0, 800.0)
                    .min_inner_size(800.0, 600.0)
                    .data_directory(data_dir(app)?.join("interface").join(preset))
                    .on_navigation(|url| {
                        matches!(url.scheme(), "tauri" | "http" | "https")
                            && matches!(
                                url.host_str(),
                                Some("tauri.localhost" | "localhost" | "127.0.0.1")
                            )
                    });
            #[cfg(debug_assertions)]
            if std::env::var("AI_TOOLBOX_NATIVE_TEST").as_deref() == Ok("1") {
                let url = app
                    .config()
                    .build
                    .dev_url
                    .as_ref()
                    .ok_or("Missing development URL")?
                    .join("tests/fixtures/native.html")
                    .map_err(|e| e.to_string())?;
                builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
                    .title(text(&params, "title")?)
                    .inner_size(1200.0, 800.0)
                    .visible(false)
                    .data_directory(data_dir(app)?.join("interface").join(preset));
                let name = if preset == "default" {
                    "AI_TOOLBOX_TEST_CDP_PORT"
                } else {
                    "AI_TOOLBOX_TEST_SECOND_CDP_PORT"
                };
                if let Ok(port) = std::env::var(name) {
                    let port: u16 = port.parse().map_err(|_| "Invalid test debugger port")?;
                    builder = builder.additional_browser_args(&format!("--remote-debugging-port={port} --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"));
                }
            }
            app.state::<crate::views::Views>()
                .presets
                .lock()
                .unwrap()
                .insert(preset.into());
            builder = builder
                .data_store_identifier(
                    uuid::Uuid::new_v5(
                        &uuid::Uuid::NAMESPACE_URL,
                        format!("ai-tool-box/ui/{preset}").as_bytes(),
                    )
                    .into_bytes(),
                )
                .on_page_load(|window, payload| {
                    if payload.event() == tauri::webview::PageLoadEvent::Started {
                        let app = window.app_handle().clone();
                        let preset = window
                            .label()
                            .strip_prefix("preset-")
                            .unwrap_or("")
                            .to_owned();
                        let labels: Vec<_> = app
                            .state::<crate::views::Views>()
                            .guests
                            .lock()
                            .unwrap()
                            .values()
                            .filter(|g| g.preset_id == preset)
                            .map(|g| g.label.clone())
                            .collect();
                        tauri::async_runtime::spawn(async move {
                            for label in labels {
                                let _ = crate::views::close(&app, &label);
                            }
                        });
                    }
                });
            let window = builder.build().map_err(|e| e.to_string())?;
            let app = app.clone();
            let preset = preset.to_owned();
            window.on_window_event(move |event| match event {
                tauri::WindowEvent::Focused(true) => {
                    crate::event(&app, "window-focused", json!({ "presetId": preset }))
                }
                tauri::WindowEvent::Destroyed => {
                    app.state::<crate::views::Views>()
                        .presets
                        .lock()
                        .unwrap()
                        .remove(&preset);
                    let labels: Vec<_> = app
                        .state::<crate::views::Views>()
                        .guests
                        .lock()
                        .unwrap()
                        .values()
                        .filter(|g| g.preset_id == preset)
                        .map(|g| g.label.clone())
                        .collect();
                    for label in labels {
                        let _ = crate::views::close(&app, &label);
                    }
                    crate::event(&app, "window-closed", json!({ "presetId": preset }));
                }
                _ => {}
            });
            Ok(Value::Null)
        }
        "window:focus" | "window:close" | "window:title" | "window:emit" => {
            let preset = text(&params, "presetId")?;
            let window = app
                .get_window(&format!("preset-{preset}"))
                .ok_or("Preset window is closed")?;
            match method {
                "window:focus" => {
                    window.unminimize().map_err(|e| e.to_string())?;
                    window.set_focus().map_err(|e| e.to_string())?;
                }
                "window:close" => {
                    window.close().map_err(|e| e.to_string())?;
                }
                "window:title" => {
                    window
                        .set_title(text(&params, "title")?)
                        .map_err(|e| e.to_string())?;
                }
                "window:emit" => {
                    app.emit_to(
                        format!("preset-{preset}"),
                        "backend-event",
                        json!({ "event": params["event"], "payload": params["payload"] }),
                    )
                    .map_err(|e| e.to_string())?;
                }
                _ => {}
            }
            Ok(Value::Null)
        }
        "session:proxy" => {
            let partition = text(&params, "partition")?.to_owned();
            if !matches!(
                params["mode"].as_str(),
                Some("system" | "direct" | "fixed_servers")
            ) {
                return Err("Invalid proxy mode".into());
            }
            if params["mode"] == "fixed_servers" {
                let url = crate::views::web_url(text(&params, "proxyRules")?)?;
                if url.scheme() != "http" {
                    return Err("Native relay must use HTTP".into());
                }
            }
            app.state::<HostState>()
                .proxies
                .lock()
                .unwrap()
                .insert(partition, params);
            Ok(Value::Null)
        }
        "session:clear" | "session:cookies" => {
            let partition = text(&params, "partition")?;
            let guests: Vec<_> = app
                .state::<crate::views::Views>()
                .guests
                .lock()
                .unwrap()
                .values()
                .filter(|g| g.partition == partition)
                .cloned()
                .collect();
            if method == "session:cookies" {
                if let Some(guest) = guests.first() {
                    let (_, view) = crate::views::by_id(app, guest.id)?;
                    let cookies = view
                        .cookies_for_url(crate::views::web_url(text(&params, "url")?)?)
                        .map_err(|e| e.to_string())?;
                    return Ok(json!(cookies
                        .iter()
                        .map(|c| json!({ "name": c.name(), "value": c.value() }))
                        .collect::<Vec<_>>()));
                }
                return Ok(json!([]));
            }
            if let Some(guest) = guests.first() {
                let (_, view) = crate::views::by_id(app, guest.id)?;
                crate::native::clear(&view).await?;
            } else if let Some(preset) = partition.strip_prefix("persist:preset-") {
                if !crate::views::valid_id(preset) {
                    return Err("Invalid partition".into());
                }
                let root = data_dir(app)?.join("webviews").join(preset);
                if root.exists() {
                    std::fs::remove_dir_all(root).map_err(|e| e.to_string())?;
                }
            }
            Ok(Value::Null)
        }
        "guest:eval" | "guest:cdp" | "guest:input" | "guest:navigate" | "guest:reload" => {
            let id = params["id"].as_u64().ok_or("Invalid guest ID")? as u32;
            let (_, view) = crate::views::by_id(app, id)?;
            match method {
                "guest:eval" => crate::views::evaluate(&view, text(&params, "script")?).await,
                "guest:cdp" => {
                    crate::native::cdp(&view, text(&params, "method")?, params["params"].clone())
                        .await
                }
                "guest:input" => crate::native::input(&view, params["event"].clone()).await,
                "guest:navigate" => {
                    view.navigate(crate::views::navigation_url(app, text(&params, "url")?)?)
                        .map_err(|e| e.to_string())?;
                    Ok(Value::Null)
                }
                _ => {
                    view.reload().map_err(|e| e.to_string())?;
                    Ok(Value::Null)
                }
            }
        }
        "credential:get" => match credential(app)?.get_password() {
            Ok(value) => Ok(json!(value)),
            Err(keyring::Error::NoEntry) => Ok(Value::Null),
            Err(error) => Err(error.to_string()),
        },
        "credential:set" => {
            let value = text(&params, "value")?;
            if value.is_empty() {
                match credential(app)?.delete_credential() {
                    Ok(()) | Err(keyring::Error::NoEntry) => {}
                    Err(error) => return Err(error.to_string()),
                }
            } else {
                credential(app)?
                    .set_password(value)
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        "update:check" => check_update(app, text(&params, "presetId")?).await,
        "update:install" => {
            let state = app.state::<HostState>();
            let update = state
                .update
                .lock()
                .await
                .take()
                .ok_or("No verified update is downloaded")?;
            update.0.install(update.1).map_err(|e| e.to_string())?;
            app.restart();
        }
        "app:quit" => {
            app.exit(0);
            Ok(Value::Null)
        }
        _ => Err(format!("Unknown native operation: {method}")),
    }
}
fn update_status(app: &AppHandle, preset: &str, payload: Value) {
    let _ = app.emit_to(
        format!("preset-{preset}"),
        "backend-event",
        json!({ "event": "update:status", "payload": payload }),
    );
}
async fn check_update(app: &AppHandle, preset: &str) -> Result<Value, String> {
    let state = app.state::<HostState>();
    let _guard = state.updating.lock().await;
    update_status(app, preset, json!({ "state": "checking" }));
    let result = async {
        let key = option_env!("TAURI_UPDATER_PUBLIC_KEY")
            .filter(|s| !s.is_empty())
            .ok_or("此构建未配置更新签名公钥，请通过发布页下载安装包")?;
        let endpoint = option_env!("TAURI_UPDATER_ENDPOINT")
            .filter(|s| !s.is_empty())
            .unwrap_or(
                "https://github.com/jupiterben/ai-tool-box/releases/latest/download/latest.json",
            );
        let updater = app
            .updater_builder()
            .pubkey(key)
            .endpoints(vec![endpoint
                .parse()
                .map_err(|_| "Invalid updater endpoint")?])
            .map_err(|e| e.to_string())?
            .build()
            .map_err(|e| e.to_string())?;
        if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
            update_status(
                app,
                preset,
                json!({ "state": "available", "version": update.version }),
            );
            let mut received = 0u64;
            let bytes = update
                .download(
                    |chunk, total| {
                        received += chunk as u64;
                        let percent = total
                            .filter(|v| *v > 0)
                            .map(|v| received * 100 / v)
                            .unwrap_or(0);
                        update_status(
                            app,
                            preset,
                            json!({ "state": "downloading", "percent": percent }),
                        );
                    },
                    || {},
                )
                .await
                .map_err(|e| e.to_string())?;
            update_status(
                app,
                preset,
                json!({ "state": "downloaded", "version": update.version }),
            );
            *state.update.lock().await = Some((update, bytes));
        } else {
            update_status(app, preset, json!({ "state": "not-available" }));
        }
        Ok(Value::Null)
    }
    .await;
    if let Err(error) = &result {
        update_status(app, preset, json!({ "state": "error", "message": error }));
    }
    result
}
