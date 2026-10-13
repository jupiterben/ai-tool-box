use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    hash::{DefaultHasher, Hash, Hasher},
    sync::Mutex,
    time::Duration,
};
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewUrl,
};

#[derive(Clone)]
pub struct Guest {
    pub tool_id: String,
    pub partition: String,
    pub incognito: bool,
}

#[derive(Default)]
pub struct GuestState(pub Mutex<HashMap<String, Guest>>);

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

pub fn require_main(webview: &Webview) -> Result<(), String> {
    if webview.label() != "main" {
        return Err("Only the local application UI may call this command".into());
    }
    Ok(())
}

pub fn web_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Only HTTP(S) website URLs are allowed".into());
    }
    Ok(url)
}

fn safe_partition(value: &str) -> Result<String, String> {
    if value.is_empty()
        || value.len() > 160
        || !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_:".contains(&c))
    {
        return Err("Invalid session partition".into());
    }
    Ok(value.replace(':', "_"))
}

fn get_guest(app: &AppHandle, label: &str) -> Result<Webview, String> {
    if !app
        .state::<GuestState>()
        .0
        .lock()
        .unwrap()
        .contains_key(label)
    {
        return Err("Webview is unavailable".into());
    }
    app.get_webview(label)
        .ok_or_else(|| "Webview is unavailable".into())
}

pub fn proxy_config(settings: &Value, tool_id: &str) -> Result<Option<String>, String> {
    let config = settings
        .get("session")
        .filter(|v| v.is_object())
        .unwrap_or(&settings["tools"][tool_id]);
    match config["mode"].as_str().unwrap_or("system") {
        "system" => Ok(None),
        "direct" => {
            if cfg!(target_os = "windows") {
                Ok(Some("direct".into()))
            } else {
                Err("Direct proxy override is currently supported only on Windows".into())
            }
        }
        "profile" => {
            if cfg!(target_os = "macos") {
                return Err("Manual webview proxies are not enabled in this macOS build".into());
            }
            let id = config["profileId"]
                .as_str()
                .ok_or("Missing proxy profile")?;
            let profile = &settings["profiles"][id];
            if !profile["username"].as_str().unwrap_or("").is_empty()
                || !profile["password"].as_str().unwrap_or("").is_empty()
            {
                return Err(
                    "Authenticated proxies are not supported by this webview backend".into(),
                );
            }
            let protocol = profile["protocol"].as_str().unwrap_or("http");
            if !matches!(protocol, "http" | "socks5") {
                return Err("Tauri webview proxies require HTTP or SOCKS5".into());
            }
            let host = profile["host"].as_str().unwrap_or("").trim();
            let port: u16 = profile["port"]
                .as_str()
                .unwrap_or("")
                .parse()
                .map_err(|_| "Invalid proxy port")?;
            if host.is_empty() || port == 0 || host.contains(['/', '@', '?', '#']) {
                return Err("Invalid proxy host or port".into());
            }
            let mut url = Url::parse(&format!("{protocol}://localhost")).unwrap();
            url.set_host(Some(host)).map_err(|_| "Invalid proxy host")?;
            url.set_port(Some(port)).map_err(|_| "Invalid proxy port")?;
            Ok(Some(url.to_string()))
        }
        _ => Err("Unknown proxy mode".into()),
    }
}

pub fn geolocation_script(settings: &Value, tool_id: &str) -> String {
    let config = settings
        .get("session")
        .filter(|v| v.is_object())
        .unwrap_or(&settings["tools"][tool_id]);
    let position = if config["mode"] == "profile" {
        let profile = &settings["profiles"][config["profileId"].as_str().unwrap_or("")];
        json!({
            "latitude": profile["latitude"], "longitude": profile["longitude"],
            "accuracy": profile["accuracy"], "altitude": null, "altitudeAccuracy": null,
            "heading": null, "speed": null
        })
    } else {
        Value::Null
    };
    // Install once per document, retain native methods so switching back to system works.
    format!(
        r#"(() => {{
      const key = '__aiToolBoxGeo';
      const geo = navigator.geolocation;
      if (!geo) return;
      if (!window[key]) {{
        const nativeGet = geo.getCurrentPosition.bind(geo);
        const nativeWatch = geo.watchPosition.bind(geo);
        const nativeClear = geo.clearWatch.bind(geo);
        const state = window[key] = {{ coords: null, next: 1000000, timers: new Map() }};
        const position = () => ({{ coords: state.coords, timestamp: Date.now() }});
        geo.getCurrentPosition = (ok, fail, options) => state.coords
          ? setTimeout(() => ok(position()), 0) : nativeGet(ok, fail, options);
        geo.watchPosition = (ok, fail, options) => {{
          if (!state.coords) return nativeWatch(ok, fail, options);
          const id = state.next++;
          setTimeout(() => {{ if (state.timers.has(id) && state.coords) ok(position()); }}, 0);
          state.timers.set(id, setInterval(() => {{ if (state.coords) ok(position()); }}, 1000));
          return id;
        }};
        geo.clearWatch = id => {{
          if (state.timers.has(id)) {{ clearInterval(state.timers.get(id)); state.timers.delete(id); }}
          else nativeClear(id);
        }};
      }}
      window[key].coords = {position};
    }})()"#
    )
}

#[tauri::command]
pub async fn create_guest(
    app: AppHandle,
    webview: Webview,
    label: String,
    src: String,
    tool_id: String,
    partition: String,
    incognito: bool,
    bounds: Bounds,
) -> Result<(), String> {
    require_main(&webview)?;
    bounds.validate()?;
    if !label.starts_with("guest-") || uuid::Uuid::parse_str(&label[6..]).is_err() {
        return Err("Invalid guest label".into());
    }
    let url = web_url(&src)?;
    let directory = safe_partition(&partition)?;
    let proxy_settings = crate::desktop::load_settings(&app, "proxy")?;
    let proxy = proxy_config(&proxy_settings, &tool_id)?;
    let geo = crate::desktop::load_settings(&app, "geolocation")?;
    let mut hasher = DefaultHasher::new();
    proxy.hash(&mut hasher);
    // WebView2 environments sharing a data directory must use identical proxy arguments.
    let profile_dir = crate::desktop::data_dir(&app)?
        .join("webviews")
        .join(directory)
        .join(format!("{:016x}", hasher.finish()));
    let nav_app = app.clone();
    let nav_label = label.clone();
    let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
        .incognito(incognito)
        .data_directory(profile_dir)
        .disable_drag_drop_handler()
        .focused(false)
        .initialization_script(geolocation_script(&geo, &tool_id))
        .on_navigation(|url| matches!(url.scheme(), "http" | "https" | "about"))
        .on_new_window(move |url, _features| {
            // Keep navigation in the sandboxed guest; never open a privileged app URL.
            if matches!(url.scheme(), "http" | "https") {
                if let Some(view) = nav_app.get_webview(&nav_label) {
                    let _ = view.navigate(url);
                }
            }
            NewWindowResponse::Deny
        })
        .on_page_load(|view, payload| {
            let kind = match payload.event() {
                PageLoadEvent::Started => "loading",
                PageLoadEvent::Finished => "loaded",
            };
            let _ = view.app_handle().emit_to(
                "main",
                "guest-state",
                json!({
                    "label": view.label(), "kind": kind, "url": payload.url().as_str()
                }),
            );
        });
    if let Some(proxy) = proxy {
        if proxy == "direct" {
            builder = builder.additional_browser_args(
                "--no-proxy-server --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
            );
        } else {
            builder = builder.proxy_url(Url::parse(&proxy).map_err(|e| e.to_string())?);
        }
    }
    app.state::<GuestState>().0.lock().unwrap().insert(
        label.clone(),
        Guest {
            tool_id,
            partition,
            incognito,
        },
    );
    let window = app.get_window("main").ok_or("Main window is unavailable")?;
    match window.add_child(
        builder,
        LogicalPosition::new(bounds.x, bounds.y),
        LogicalSize::new(bounds.width, bounds.height),
    ) {
        Ok(view) => {
            if !bounds.visible {
                view.hide().map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        Err(error) => {
            app.state::<GuestState>().0.lock().unwrap().remove(&label);
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub async fn update_guest_bounds(
    app: AppHandle,
    webview: Webview,
    label: String,
    bounds: Bounds,
) -> Result<(), String> {
    require_main(&webview)?;
    bounds.validate()?;
    let guest = get_guest(&app, &label)?;
    if !bounds.visible {
        return guest.hide().map_err(|e| e.to_string());
    }
    guest
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    guest
        .set_size(LogicalSize::new(bounds.width, bounds.height))
        .map_err(|e| e.to_string())?;
    guest.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn guest_action(
    app: AppHandle,
    webview: Webview,
    label: String,
    action: String,
    url: Option<String>,
) -> Result<(), String> {
    require_main(&webview)?;
    let guest = get_guest(&app, &label)?;
    match action.as_str() {
        "navigate" => guest.navigate(web_url(url.as_deref().ok_or("Missing URL")?)?),
        "reload" => guest.reload(),
        "back" => guest.eval("history.back()"),
        "forward" => guest.eval("history.forward()"),
        _ => return Err("Unknown webview action".into()),
    }
    .map_err(|e| e.to_string())
}

async fn read_script_result(view: &Webview, script: String) -> Result<Value, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let sender = Mutex::new(Some(sender));
    view.eval_with_callback(script, move |result| {
        if let Some(sender) = sender.lock().unwrap().take() {
            let _ = sender.send(result);
        }
    })
    .map_err(|e| e.to_string())?;
    let value = tokio::time::timeout(Duration::from_secs(3), receiver)
        .await
        .map_err(|_| "Webview evaluation timed out")?
        .map_err(|_| "Webview closed during evaluation")?;
    serde_json::from_str(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn evaluate_guest(
    app: AppHandle,
    webview: Webview,
    label: String,
    script: String,
) -> Result<Value, String> {
    require_main(&webview)?;
    let guest = get_guest(&app, &label)?;
    let key = format!("__aitb_result_{}", uuid::Uuid::new_v4().simple());
    let expression = script.trim().trim_end_matches(';');
    // Resolve async scripts without exposing any Tauri command to remote pages.
    guest
        .eval(format!(
            r#"(() => {{
      const done = (value) => {{ window['{key}'] = value; }};
      try {{
        Promise.resolve(({expression})).then(
          value => done({{ ok: true, value: value === undefined ? null : value }}),
          error => done({{ ok: false, error: String(error) }})
        );
      }} catch (error) {{ done({{ ok: false, error: String(error) }}); }}
    }})()"#
        ))
        .map_err(|e| e.to_string())?;
    let result = tokio::time::timeout(Duration::from_secs(25), async {
        loop {
            let result = read_script_result(&guest, format!("window['{key}'] || null")).await?;
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
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .map_err(|_| "Site script timed out".to_owned())
    .and_then(|v| v);
    let _ = guest.eval(format!("delete window['{key}']"));
    result
}

#[tauri::command]
pub async fn close_guest(app: AppHandle, webview: Webview, label: String) -> Result<(), String> {
    require_main(&webview)?;
    let state = app.state::<GuestState>();
    let registered = state.0.lock().unwrap().remove(&label).is_some();
    if registered {
        if let Some(guest) = app.get_webview(&label) {
            guest.close().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
async fn clear_profile(view: &Webview) -> Result<(), String> {
    use std::sync::Arc;
    use webview2_com::{
        ClearBrowsingDataCompletedHandler,
        Microsoft::Web::WebView2::Win32::{ICoreWebView2Profile2, ICoreWebView2_13},
    };
    use windows::core::Interface;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let sender = Arc::new(Mutex::new(Some(sender)));
    view.with_webview(move |platform| {
        let completed = sender.clone();
        let result = (|| -> windows::core::Result<()> {
            unsafe {
                platform
                    .controller()
                    .CoreWebView2()?
                    .cast::<ICoreWebView2_13>()?
                    .Profile()?
                    .cast::<ICoreWebView2Profile2>()?
                    .ClearBrowsingDataAll(&ClearBrowsingDataCompletedHandler::create(Box::new(
                        move |status| {
                            if let Some(sender) = completed.lock().unwrap().take() {
                                let _ = sender.send(status.map_err(|e| e.to_string()));
                            }
                            Ok(())
                        },
                    )))
            }
        })();
        if let Err(error) = result {
            if let Some(sender) = sender.lock().unwrap().take() {
                let _ = sender.send(Err(error.to_string()));
            }
        }
    })
    .map_err(|e| e.to_string())?;
    tokio::time::timeout(Duration::from_secs(30), receiver)
        .await
        .map_err(|_| "Clearing browsing data timed out")?
        .map_err(|_| "Webview closed while clearing browsing data")?
}

#[cfg(not(target_os = "windows"))]
async fn clear_profile(view: &Webview) -> Result<(), String> {
    view.clear_all_browsing_data().map_err(|e| e.to_string())
}

pub async fn clear_data(
    app: &AppHandle,
    tool_id: Option<&str>,
    incognito_only: bool,
) -> Result<(), String> {
    let entries = app.state::<GuestState>().0.lock().unwrap().clone();
    let partitions: Vec<_> = entries
        .values()
        .filter(|g| tool_id.is_none_or(|id| id == g.tool_id))
        .filter(|g| !incognito_only || g.incognito)
        .map(|g| g.partition.clone())
        .collect();
    for (label, info) in &entries {
        if partitions.contains(&info.partition) && (!incognito_only || info.incognito) {
            if let Some(view) = app.get_webview(label) {
                clear_profile(&view).await?;
            }
        }
    }
    Ok(())
}

pub fn apply_geolocation(
    app: &AppHandle,
    settings: &Value,
    tool_id: Option<&str>,
) -> Result<(), String> {
    let entries = app.state::<GuestState>().0.lock().unwrap().clone();
    for (label, info) in entries {
        if tool_id.is_none_or(|id| id == info.tool_id) {
            if let Some(view) = app.get_webview(&label) {
                view.eval(geolocation_script(settings, &info.tool_id))
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_privileged_urls_and_partition_traversal() {
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "tauri://localhost",
            "data:text/html,x",
        ] {
            assert!(web_url(url).is_err());
        }
        assert!(web_url("https://example.com/chat").is_ok());
        assert!(safe_partition("../main").is_err());
        assert!(safe_partition("persist:preset-default").is_ok());
    }

    #[test]
    fn validates_bounds() {
        assert!(Bounds {
            x: 0.0,
            y: 0.0,
            width: f64::NAN,
            height: 1.0,
            visible: true
        }
        .validate()
        .is_err());
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn validates_proxy_before_applying_it() {
        let settings = json!({
            "profiles": { "p": { "protocol": "http", "host": "127.0.0.1", "port": "7890" }},
            "tools": { "test": { "mode": "profile", "profileId": "p" }}
        });
        assert_eq!(
            proxy_config(&settings, "test").unwrap(),
            Some("http://127.0.0.1:7890/".into())
        );
        assert_eq!(proxy_config(&settings, "other").unwrap(), None);
        let mut invalid = settings;
        invalid["profiles"]["p"]["port"] = json!("99999");
        assert!(proxy_config(&invalid, "test").is_err());
    }
}
