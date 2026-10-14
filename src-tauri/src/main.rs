#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod host;
mod native;
mod views;

use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, Webview};
use tokio::sync::oneshot;

#[derive(Default)]
pub struct Backend {
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Option<Child>>,
    pending: Mutex<HashMap<String, oneshot::Sender<Result<Value, String>>>>,
    stopped: AtomicBool,
}
impl Backend {
    pub fn send(&self, value: Value) -> Result<(), String> {
        let mut guard = self.stdin.lock().map_err(|e| e.to_string())?;
        let input = guard.as_mut().ok_or("Desktop service is not running")?;
        writeln!(input, "{value}").map_err(|e| e.to_string())?;
        input.flush().map_err(|e| e.to_string())
    }
    fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        self.stdin.lock().unwrap().take();
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        for (_, sender) in self.pending.lock().unwrap().drain() {
            let _ = sender.send(Err("Desktop service stopped".into()));
        }
    }
}
pub fn event(app: &AppHandle, event: &str, payload: Value) {
    let _ = app
        .state::<Backend>()
        .send(json!({ "type": "event", "event": event, "payload": payload }));
}

fn start_backend(app: &AppHandle) -> Result<(), String> {
    let data = host::data_dir(app)?;
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    host::migrate_legacy_settings(app)?;
    let directory = if cfg!(debug_assertions) {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sidecar")
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("sidecar")
    };
    let mut command = Command::new(directory.join(if cfg!(windows) { "node.exe" } else { "node" }));
    command
        .arg(directory.join("backend.mjs"))
        .env("AI_TOOLBOX_DATA_DIR", data)
        .env(
            "AI_TOOLBOX_PACKAGED",
            if cfg!(debug_assertions) { "0" } else { "1" },
        )
        .env_remove("NODE_OPTIONS")
        .env_remove("NODE_PATH")
        .env_remove("TAURI_SIGNING_PRIVATE_KEY")
        .env_remove("TAURI_SIGNING_PRIVATE_KEY_PASSWORD")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|e| format!("Cannot start desktop service: {e}"))?;
    let stdout = child.stdout.take().ok_or("Missing service output")?;
    *app.state::<Backend>().stdin.lock().unwrap() = child.stdin.take();
    *app.state::<Backend>().child.lock().unwrap() = Some(child);
    let handle = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            let Ok(message) = serde_json::from_str::<Value>(&line) else {
                eprintln!("Invalid desktop service message");
                continue;
            };
            match message["type"].as_str() {
                Some("result") => {
                    let id = message["id"].as_str().unwrap_or("");
                    if let Some(sender) =
                        handle.state::<Backend>().pending.lock().unwrap().remove(id)
                    {
                        let result = message["error"]
                            .as_str()
                            .map(|e| Err(e.to_owned()))
                            .unwrap_or_else(|| Ok(message["result"].clone()));
                        let _ = sender.send(result);
                    }
                }
                Some("native") => {
                    let app = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let result = host::dispatch(
                            &app,
                            message["method"].as_str().unwrap_or(""),
                            message["params"].clone(),
                        )
                        .await;
                        let response = match result {
                            Ok(result) => {
                                json!({ "type": "native-result", "id": message["id"], "result": result })
                            }
                            Err(error) => {
                                json!({ "type": "native-result", "id": message["id"], "error": error })
                            }
                        };
                        let _ = app.state::<Backend>().send(response);
                    });
                }
                Some("fatal") => {
                    eprintln!("Desktop service startup failed: {}", message["error"]);
                    let _ = handle.emit("backend-failure", message["error"].clone());
                }
                _ => {}
            }
        }
        let state = handle.state::<Backend>();
        for (_, sender) in state.pending.lock().unwrap().drain() {
            let _ = sender.send(Err("Desktop service disconnected".into()));
        }
        if !state.stopped.load(Ordering::SeqCst) {
            let _ = handle.emit("backend-failure", "Desktop service disconnected");
            handle.exit(1);
        }
    });
    Ok(())
}

#[tauri::command]
async fn backend_call(
    app: AppHandle,
    webview: Webview,
    channel: String,
    payload: Value,
) -> Result<Value, String> {
    let preset_id = views::caller_preset(&app, &webview)?;
    let id = uuid::Uuid::new_v4().to_string();
    let (sender, receiver) = oneshot::channel();
    app.state::<Backend>()
        .pending
        .lock()
        .unwrap()
        .insert(id.clone(), sender);
    if let Err(error) = app.state::<Backend>().send(json!({
        "type": "request", "id": id, "channel": channel, "presetId": preset_id, "payload": payload
    })) {
        app.state::<Backend>().pending.lock().unwrap().remove(&id);
        return Err(error);
    }
    let result = tokio::time::timeout(Duration::from_secs(1000), receiver)
        .await
        .map_err(|_| "Desktop request timed out".to_owned())
        .and_then(|r| r.map_err(|_| "Desktop service disconnected".into()))
        .and_then(|r| r);
    app.state::<Backend>().pending.lock().unwrap().remove(&id);
    result
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Backend::default())
        .manage(views::Views::default())
        .manage(host::HostState::default())
        .invoke_handler(tauri::generate_handler![
            backend_call,
            views::create_guest,
            views::guest_bounds,
            views::guest_call,
            views::close_guest,
        ])
        .setup(|app| {
            start_backend(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Failed to build desktop application");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            handle.state::<Backend>().stop();
        }
    });
}
