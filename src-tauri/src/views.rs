use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    hash::{DefaultHasher, Hash, Hasher},
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewUrl,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Guest {
    pub id: u32,
    pub label: String,
    pub preset_id: String,
    pub partition: String,
    pub url: String,
}
#[derive(Default)]
pub struct Views {
    pub guests: Mutex<HashMap<String, Guest>>,
    pub presets: Mutex<HashSet<String>>,
    next_id: AtomicU32,
}
#[derive(Clone, Deserialize, Serialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
}
impl Bounds {
    fn validate(&self) -> Result<(), String> {
        if [self.x, self.y, self.width, self.height]
            .iter()
            .any(|v| !v.is_finite() || *v < 0.0 || *v > 100_000.0)
            || self.width < 1.0
            || self.height < 1.0
        {
            return Err("Invalid webview bounds".into());
        }
        Ok(())
    }
}
pub fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 120 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}
pub fn caller_preset(app: &AppHandle, webview: &Webview) -> Result<String, String> {
    let id = webview
        .label()
        .strip_prefix("preset-")
        .ok_or("Guest access denied")?;
    if !valid_id(id) || !app.state::<Views>().presets.lock().unwrap().contains(id) {
        return Err("Invalid preset caller".into());
    }
    Ok(id.into())
}
pub fn web_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Only HTTP(S) website URLs are allowed".into());
    }
    Ok(url)
}
pub fn navigation_url(app: &AppHandle, value: &str) -> Result<Url, String> {
    let url = web_url(value)?;
    #[cfg(debug_assertions)]
    if std::env::var("AI_TOOLBOX_NATIVE_TEST").as_deref() == Ok("1") {
        return app
            .config()
            .build
            .dev_url
            .as_ref()
            .ok_or("Missing test server")?
            .join("tests/fixtures/guest.html")
            .map_err(|e| e.to_string());
    }
    let _ = app;
    Ok(url)
}
pub fn by_id(app: &AppHandle, id: u32) -> Result<(Guest, Webview), String> {
    let info = app
        .state::<Views>()
        .guests
        .lock()
        .unwrap()
        .values()
        .find(|g| g.id == id)
        .cloned()
        .ok_or("Guest is unavailable")?;
    let view = app.get_webview(&info.label).ok_or("Guest is closed")?;
    Ok((info, view))
}
fn owned(app: &AppHandle, caller: &Webview, label: &str) -> Result<(Guest, Webview), String> {
    let preset = caller_preset(app, caller)?;
    let info = app
        .state::<Views>()
        .guests
        .lock()
        .unwrap()
        .get(label)
        .cloned()
        .ok_or("Guest is unavailable")?;
    if info.preset_id != preset {
        return Err("Guest belongs to another preset".into());
    }
    let view = app.get_webview(label).ok_or("Guest is closed")?;
    Ok((info, view))
}
pub fn state_event(app: &AppHandle, guest: &Guest, kind: &str, extra: Value) {
    let mut payload =
        json!({ "id": guest.id, "label": guest.label, "kind": kind, "url": guest.url });
    if let Some(extra) = extra.as_object() {
        payload.as_object_mut().unwrap().extend(extra.clone());
    }
    crate::event(app, "guest-state", payload.clone());
    let _ = app.emit_to(
        format!("preset-{}", guest.preset_id),
        "guest-state",
        payload,
    );
}

#[tauri::command]
pub async fn create_guest(
    app: AppHandle,
    webview: Webview,
    label: String,
    src: String,
    partition: Option<String>,
    tool_id: String,
    thread_id: Option<String>,
    bounds: Bounds,
) -> Result<u32, String> {
    let preset_id = caller_preset(&app, &webview)?;
    bounds.validate()?;
    if !label.starts_with("guest-") || uuid::Uuid::parse_str(&label[6..]).is_err() {
        return Err("Invalid guest label".into());
    }
    let expected_partition = format!("persist:preset-{preset_id}");
    if partition.as_ref().is_some_and(|p| p != &expected_partition) {
        return Err("Invalid preset partition".into());
    }
    let url = navigation_url(&app, &src)?;
    let id = app.state::<Views>().next_id.fetch_add(1, Ordering::SeqCst) + 1;
    let guest = Guest {
        id,
        label: label.clone(),
        preset_id: preset_id.clone(),
        partition: expected_partition.clone(),
        url: src,
    };
    let proxy = app
        .state::<crate::host::HostState>()
        .proxies
        .lock()
        .unwrap()
        .get(&expected_partition)
        .cloned();
    let mut hash = DefaultHasher::new();
    // Relay ports are ephemeral, but its native profile must survive app restarts.
    proxy
        .as_ref()
        .and_then(|value| value["mode"].as_str())
        .unwrap_or("system")
        .hash(&mut hash);
    let path = crate::host::data_dir(&app)?
        .join("webviews")
        .join(&preset_id)
        .join(format!("{:016x}", hash.finish()));
    let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
        .data_directory(path)
        .focused(false)
        .disable_drag_drop_handler()
        .data_store_identifier(
            uuid::Uuid::new_v5(
                &uuid::Uuid::NAMESPACE_URL,
                format!("ai-tool-box/guest/{preset_id}").as_bytes(),
            )
            .into_bytes(),
        )
        .on_navigation(|url| matches!(url.scheme(), "http" | "https" | "about"));
    if let Some(proxy) = proxy {
        if proxy["mode"] == "direct" {
            builder = builder.additional_browser_args(
                "--no-proxy-server --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
            );
        } else if let Some(url) = proxy["proxyRules"].as_str().filter(|s| !s.is_empty()) {
            builder = builder.proxy_url(Url::parse(url).map_err(|e| e.to_string())?);
        }
    }
    let popup_app = app.clone();
    let popup_label = label.clone();
    builder = builder.on_new_window(move |url, _features| {
        if matches!(url.scheme(), "http" | "https") {
            if let Some(view) = popup_app.get_webview(&popup_label) {
                let _ = view.navigate(url);
            }
        }
        NewWindowResponse::Deny
    });
    builder = builder.on_page_load(|view, payload| {
        let app = view.app_handle().clone();
        let guest = {
            let state = app.state::<Views>();
            let mut guests = state.guests.lock().unwrap();
            guests.get_mut(view.label()).map(|g| {
                g.url = payload.url().to_string();
                g.clone()
            })
        };
        if let Some(guest) = guest {
            let kind = if payload.event() == PageLoadEvent::Finished {
                "loaded"
            } else {
                "loading"
            };
            state_event(&app, &guest, kind, json!({}));
        }
    });
    app.state::<Views>()
        .guests
        .lock()
        .unwrap()
        .insert(label.clone(), guest.clone());
    // Registration reaches the service before page-load callbacks and worker responses.
    crate::event(&app, "guest-created", json!(guest));
    let window = app
        .get_window(&format!("preset-{preset_id}"))
        .ok_or("Preset window is closed")?;
    let result = window.add_child(
        builder,
        LogicalPosition::new(bounds.x, bounds.y),
        LogicalSize::new(bounds.width, bounds.height),
    );
    let view = match result {
        Ok(view) => view,
        Err(error) => {
            app.state::<Views>().guests.lock().unwrap().remove(&label);
            state_event(&app, &guest, "closed", json!({}));
            return Err(error.to_string());
        }
    };
    if !bounds.visible {
        view.hide().map_err(|e| e.to_string())?;
    }
    crate::native::subscribe(&app, &view, &guest)?;
    let _ = (tool_id, thread_id);
    Ok(id)
}
#[tauri::command]
pub async fn guest_bounds(
    app: AppHandle,
    webview: Webview,
    label: String,
    bounds: Bounds,
) -> Result<(), String> {
    bounds.validate()?;
    let (_, view) = owned(&app, &webview, &label)?;
    if !bounds.visible {
        return view.hide().map_err(|e| e.to_string());
    }
    view.set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    view.set_size(LogicalSize::new(bounds.width, bounds.height))
        .map_err(|e| e.to_string())?;
    view.show().map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn guest_call(
    app: AppHandle,
    webview: Webview,
    label: String,
    action: String,
    payload: Value,
) -> Result<Value, String> {
    let (_, guest) = owned(&app, &webview, &label)?;
    match action.as_str() {
        "eval" => evaluate(&guest, payload.as_str().ok_or("Missing script")?).await,
        "navigate" => {
            guest
                .navigate(web_url(payload.as_str().ok_or("Missing URL")?)?)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "reload" => {
            guest.reload().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "back" | "forward" => {
            guest
                .eval(format!("history.{}()", action))
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        _ => Err("Unknown guest action".into()),
    }
}
pub fn close(app: &AppHandle, label: &str) -> Result<(), String> {
    let guest = app.state::<Views>().guests.lock().unwrap().remove(label);
    if let Some(guest) = guest {
        if let Some(view) = app.get_webview(label) {
            view.close().map_err(|e| e.to_string())?;
        }
        state_event(app, &guest, "closed", json!({}));
    }
    Ok(())
}
#[tauri::command]
pub async fn close_guest(app: AppHandle, webview: Webview, label: String) -> Result<(), String> {
    caller_preset(&app, &webview)?;
    if !app
        .state::<Views>()
        .guests
        .lock()
        .unwrap()
        .contains_key(&label)
    {
        return Ok(());
    }
    owned(&app, &webview, &label)?;
    close(&app, &label)
}
pub async fn evaluate(view: &Webview, script: &str) -> Result<Value, String> {
    let key = format!("__aitb_{}", uuid::Uuid::new_v4().simple());
    let expression = script.trim().trim_end_matches(';');
    view.eval(format!(
        r#"(() => {{
        try {{ Promise.resolve(({expression})).then(
          value => window['{key}'] = {{ ok: true, value: value ?? null }},
          error => window['{key}'] = {{ ok: false, error: String(error) }}
        ); }} catch (error) {{ window['{key}'] = {{ ok: false, error: String(error) }}; }}
    }})()"#
    ))
    .map_err(|e| e.to_string())?;
    let result = tokio::time::timeout(Duration::from_secs(150), async {
        loop {
            let (tx, rx) = tokio::sync::oneshot::channel();
            let tx = Mutex::new(Some(tx));
            view.eval_with_callback(format!("window['{key}'] || null"), move |value| {
                if let Some(tx) = tx.lock().unwrap().take() {
                    let _ = tx.send(value);
                }
            })
            .map_err(|e| e.to_string())?;
            let text = tokio::time::timeout(Duration::from_secs(5), rx)
                .await
                .map_err(|_| "Guest did not answer")?
                .map_err(|_| "Guest closed")?;
            let result: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
            if !result.is_null() {
                return if result["ok"] == true {
                    Ok(result["value"].clone())
                } else {
                    Err(result["error"]
                        .as_str()
                        .unwrap_or("Script failed")
                        .to_owned())
                };
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .map_err(|_| "Site script timed out".to_owned())
    .and_then(|v| v);
    let _ = view.eval(format!("delete window['{key}']"));
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preset_paths_cannot_escape_the_profile_directory() {
        for id in ["../default", "default/other", "", "a:b", "a\\b"] {
            assert!(!valid_id(id));
        }
        assert!(valid_id("preset-a12b3c"));
    }
    #[test]
    fn navigation_rejects_privileged_schemes() {
        for url in [
            "file:///C:/Windows/win.ini",
            "javascript:alert(1)",
            "data:text/html,x",
            "tauri://localhost",
        ] {
            assert!(web_url(url).is_err());
        }
        assert!(web_url("https://example.com").is_ok());
    }
    #[test]
    fn native_bounds_must_be_finite_and_positive() {
        assert!(Bounds {
            x: 0.0,
            y: 0.0,
            width: f64::NAN,
            height: 100.0,
            visible: true
        }
        .validate()
        .is_err());
        assert!(Bounds {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 100.0,
            visible: true
        }
        .validate()
        .is_ok());
    }
}
