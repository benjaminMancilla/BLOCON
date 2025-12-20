#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    sync::Mutex,
    time::{Duration, Instant},
};

use tauri::{api::process::Command, Manager};
use tauri::api::process::CommandChild;

const HEALTHCHECK_URL: &str = "127.0.0.1:8000";
const HEALTHCHECK_PATH: &str = "/health";
const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(15);
const HEALTHCHECK_INTERVAL: Duration = Duration::from_millis(250);

struct BackendState {
    child: Mutex<Option<CommandChild>>,
}

fn check_health() -> bool {
    let addr: SocketAddr = match HEALTHCHECK_URL.parse() {
        Ok(addr) => addr,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(300)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(300)));

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        HEALTHCHECK_PATH, HEALTHCHECK_URL
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

fn wait_for_backend() -> bool {
    let start = Instant::now();
    while start.elapsed() < HEALTHCHECK_TIMEOUT {
        if check_health() {
            return true;
        }
        std::thread::sleep(HEALTHCHECK_INTERVAL);
    }
    false
}

fn main() {
    tauri::Builder::default()
    .setup(|app| {
            let window = app
                .get_window("main")
                .ok_or("main window not found")?;
            window.hide()?;

            let (_rx, child) = Command::new_sidecar("api_server")?.spawn()?;
            app.manage(BackendState {
                child: Mutex::new(Some(child)),
            });

            if !wait_for_backend() {
                return Err("backend healthcheck failed".into());
            }

            window.show()?;
            window.set_focus()?;

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                let app_handle = event.window().app_handle();
                let state = app_handle.state::<BackendState>();

                let mut child_guard = match state.child.lock() {
                Ok(g) => g,
                Err(poisoned) => poisoned.into_inner(), // por si el mutex quedó “poisoned”
                };
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}