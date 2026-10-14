use serde_json::{json, Value};
use tauri::{AppHandle, Webview};

#[cfg(windows)]
mod platform {
    use super::*;
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };
    use webview2_com::{
        CallDevToolsProtocolMethodCompletedHandler, ClearBrowsingDataCompletedHandler,
        DevToolsProtocolEventReceivedEventHandler, HistoryChangedEventHandler,
        Microsoft::Web::WebView2::Win32::{ICoreWebView2Profile2, ICoreWebView2_13},
    };
    use windows::core::{Interface, BOOL, PCWSTR, PWSTR};

    pub async fn cdp(view: &Webview, method: &str, params: Value) -> Result<Value, String> {
        let method = method.to_owned();
        let (tx, rx) = tokio::sync::oneshot::channel();
        let tx = Arc::new(Mutex::new(Some(tx)));
        view.with_webview(move |platform| {
            let done = tx.clone();
            let method: Vec<u16> = method.encode_utf16().chain(Some(0)).collect();
            let params: Vec<u16> = params.to_string().encode_utf16().chain(Some(0)).collect();
            let result = (|| -> windows::core::Result<()> {
                unsafe {
                    platform
                        .controller()
                        .CoreWebView2()?
                        .CallDevToolsProtocolMethod(
                            PCWSTR(method.as_ptr()),
                            PCWSTR(params.as_ptr()),
                            &CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                                move |status, text| {
                                    let result = status.map_err(|e| e.to_string()).and_then(|_| {
                                        serde_json::from_str::<Value>(&text)
                                            .map_err(|e| e.to_string())
                                    });
                                    if let Some(tx) = done.lock().unwrap().take() {
                                        let _ = tx.send(result);
                                    }
                                    Ok(())
                                },
                            )),
                        )
                }
            })();
            if let Err(error) = result {
                if let Some(tx) = tx.lock().unwrap().take() {
                    let _ = tx.send(Err(error.to_string()));
                }
            }
        })
        .map_err(|e| e.to_string())?;
        tokio::time::timeout(Duration::from_secs(120), rx)
            .await
            .map_err(|_| "Native browser command timed out")?
            .map_err(|_| "Guest closed")?
    }
    pub async fn clear(view: &Webview) -> Result<(), String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let tx = Arc::new(Mutex::new(Some(tx)));
        view.with_webview(move |platform| {
            let done = tx.clone();
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
                                if let Some(tx) = done.lock().unwrap().take() {
                                    let _ = tx.send(status.map_err(|e| e.to_string()));
                                }
                                Ok(())
                            },
                        )))
                }
            })();
            if let Err(error) = result {
                if let Some(tx) = tx.lock().unwrap().take() {
                    let _ = tx.send(Err(error.to_string()));
                }
            }
        })
        .map_err(|e| e.to_string())?;
        tokio::time::timeout(Duration::from_secs(30), rx)
            .await
            .map_err(|_| "Cache clear timed out")?
            .map_err(|_| "Guest closed")?
    }
    pub fn subscribe(
        app: &AppHandle,
        view: &Webview,
        guest: &crate::views::Guest,
    ) -> Result<(), String> {
        let app = app.clone();
        let guest = guest.clone();
        view.with_webview(move |platform| {
            let result = (|| -> windows::core::Result<()> {
                unsafe {
                    let core = platform.controller().CoreWebView2()?;
                    for method in ["Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFinished", "Network.loadingFailed"] {
                        let name: Vec<u16> = method.encode_utf16().chain(Some(0)).collect();
                        let receiver = core.GetDevToolsProtocolEventReceiver(PCWSTR(name.as_ptr()))?;
                        let app = app.clone();
                        let id = guest.id;
                        let mut token = 0;
                        receiver.add_DevToolsProtocolEventReceived(
                            &DevToolsProtocolEventReceivedEventHandler::create(Box::new(move |_sender, args| {
                                if let Some(args) = args {
                                    let mut raw = PWSTR::null();
                                    args.ParameterObjectAsJson(&mut raw)?;
                                    let text = webview2_com::take_pwstr(raw);
                                    if let Ok(params) = serde_json::from_str::<Value>(&text) {
                                        crate::event(&app, "guest-cdp", json!({ "id": id, "method": method, "params": params }));
                                    }
                                }
                                Ok(())
                            })), &mut token,
                        )?;
                    }
                    let app = app.clone();
                    let guest = guest.clone();
                    let mut token = 0;
                    core.add_HistoryChanged(&HistoryChangedEventHandler::create(Box::new(move |sender, _args| {
                        if let Some(sender) = sender {
                            let mut back = BOOL(0); let mut forward = BOOL(0);
                            sender.CanGoBack(&mut back)?; sender.CanGoForward(&mut forward)?;
                            let mut raw = PWSTR::null();
                            sender.Source(&mut raw)?;
                            let url = webview2_com::take_pwstr(raw);
                            crate::views::state_event(&app, &guest, "navigation", json!({
                                "url": url, "canGoBack": back.as_bool(), "canGoForward": forward.as_bool()
                            }));
                        }
                        Ok(())
                    })), &mut token)?;
                    Ok(())
                }
            })();
            if let Err(error) = result { eprintln!("Native event subscription failed: {error}"); }
        }).map_err(|e| e.to_string())
    }
}
#[cfg(windows)]
pub use platform::{cdp, clear, subscribe};

#[cfg(not(windows))]
pub async fn cdp(_view: &Webview, _method: &str, _params: Value) -> Result<Value, String> {
    Err("This platform does not expose Chromium native input/network capture; use the DOM transport".into())
}
#[cfg(not(windows))]
pub async fn clear(view: &Webview) -> Result<(), String> {
    view.clear_all_browsing_data().map_err(|e| e.to_string())
}
#[cfg(not(windows))]
pub fn subscribe(
    _app: &AppHandle,
    _view: &Webview,
    _guest: &crate::views::Guest,
) -> Result<(), String> {
    Ok(())
}

pub async fn input(view: &Webview, event: Value) -> Result<Value, String> {
    let kind = event["type"].as_str().ok_or("Missing input type")?;
    if kind.starts_with("mouse") {
        let native_type = match kind {
            "mouseMove" => "mouseMoved",
            "mouseDown" => "mousePressed",
            "mouseUp" => "mouseReleased",
            _ => return Err("Invalid mouse input".into()),
        };
        return cdp(
            view,
            "Input.dispatchMouseEvent",
            json!({
                "type": native_type, "x": event["x"], "y": event["y"],
                "button": event["button"].as_str().unwrap_or("none"),
                "clickCount": event["clickCount"].as_u64().unwrap_or(0)
            }),
        )
        .await;
    }
    let key = event["keyCode"].as_str().ok_or("Missing key code")?;
    let code = match key {
        "Enter" => 13,
        "Backspace" => 8,
        "A" => 65,
        _ => return Err("Unsupported key".into()),
    };
    let ctrl = event["modifiers"]
        .as_array()
        .is_some_and(|m| m.iter().any(|s| s == "control"));
    cdp(view, "Input.dispatchKeyEvent", json!({
        "type": if kind == "keyUp" { "keyUp" } else { "keyDown" },
        "key": key, "windowsVirtualKeyCode": code,
        "nativeVirtualKeyCode": code, "modifiers": if ctrl { 2 } else { 0 },
        "text": if key == "Enter" && kind == "keyDown" { "\r" } else { "" },
        "commands": if ctrl && key == "A" && kind == "keyDown" { vec!["selectAll"] } else { vec![] }
    })).await
}
