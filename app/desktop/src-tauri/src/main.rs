#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;

use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use config::{delete_config, get_config_dir, get_config_info, get_env_path, has_config, load_config, save_config, ConfigManager};
use tauri::{
    api::process::{Command, CommandChild, CommandEvent},
    Manager,
};

const HEALTHCHECK_URL: &str = "127.0.0.1:8000";
const HEALTHCHECK_PATH: &str = "/health";
const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(30);
const HEALTHCHECK_INTERVAL: Duration = Duration::from_millis(250);

struct BackendState {
    child: Mutex<Option<CommandChild>>,
    we_own_backend: Mutex<bool>,
    output_log: Arc<Mutex<Vec<String>>>,
}

fn kill_backend(child: &mut Option<CommandChild>) {
    if let Some(child) = child.take() {
        match child.kill() {
            Ok(_) => println!("Backend killed successfully"),
            Err(e) => eprintln!("Failed to kill backend: {}", e),
        }
    }
}

fn check_health() -> bool {
    let addr: SocketAddr = match HEALTHCHECK_URL.parse() {
        Ok(addr) => addr,
        Err(e) => {
            eprintln!("[HEALTHCHECK] Failed to parse address: {}", e);
            return false;
        }
    };
    
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
        Ok(stream) => stream,
        Err(e) => {
            eprintln!("[HEALTHCHECK] Connection failed: {}", e);
            return false;
        }
    };
    
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
        HEALTHCHECK_PATH, HEALTHCHECK_URL
    );
    
    if let Err(e) = stream.write_all(request.as_bytes()) {
        eprintln!("[HEALTHCHECK] Write failed: {}", e);
        return false;
    }

    let mut buffer = [0u8; 1024];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(n) => n,
        Err(e) => {
            eprintln!("[HEALTHCHECK] Read failed: {}", e);
            return false;
        }
    };
    
    if bytes_read == 0 {
        eprintln!("[HEALTHCHECK] No data received");
        return false;
    }
    
    let response = String::from_utf8_lossy(&buffer[..bytes_read]);
    let is_ok = response.contains("HTTP/1.1 200") || response.contains("HTTP/1.0 200");
    
    if !is_ok {
        eprintln!("[HEALTHCHECK] Unexpected response: {}", response.lines().next().unwrap_or(""));
    } else {
        println!("[HEALTHCHECK] Success!");
    }
    
    is_ok
}

fn wait_for_backend(output_log: Arc<Mutex<Vec<String>>>) -> bool {
    let start = Instant::now();
    let mut last_log_print = Instant::now();
    
    while start.elapsed() < HEALTHCHECK_TIMEOUT {
        if check_health() {
            return true;
        }
        
        if last_log_print.elapsed() > Duration::from_secs(2) {
            let logs = output_log.lock().unwrap();
            if !logs.is_empty() {
                println!("Backend output (last {} lines):", logs.len().min(5));
                for line in logs.iter().rev().take(5).rev() {
                    println!("  {}", line);
                }
            } else {
                println!("No output from backend yet...");
            }
            last_log_print = Instant::now();
        }
        
        std::thread::sleep(HEALTHCHECK_INTERVAL);
    }
    
    let logs = output_log.lock().unwrap();
    if !logs.is_empty() {
        eprintln!("\n=== FULL BACKEND OUTPUT ===");
        for line in logs.iter() {
            eprintln!("{}", line);
        }
        eprintln!("=== END BACKEND OUTPUT ===\n");
    } else {
        eprintln!("Backend produced no output!");
    }
    
    false
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_window("main")
                .ok_or("main window not found")?;
            
                #[cfg(debug_assertions)]
                {
                    window.open_devtools();
                }
            window.hide()?;

            // Get the app handle from the app
            let app_handle = app.handle();
            
            if let Ok(manager) = ConfigManager::new(&app_handle) {
                if manager.has_config() {
                    match manager.load_config() {
                        Ok(config) => {
                            if let Err(err) = manager.save_config(&config) {
                                eprintln!("Warning: Failed to refresh .env: {}", err);
                            }
                        }
                        Err(err) => {
                            eprintln!("Warning: Failed to load config: {}", err);
                        }
                    }
                } else {
                    println!("No SharePoint config found; starting without .env");
                }
            } else {
                eprintln!("Warning: Unable to resolve app data directory for config");
            }

            let backend_already_running = check_health();
            
            let output_log = Arc::new(Mutex::new(Vec::new()));
            let output_log_clone = output_log.clone();
            
            let (child, we_own_it) = if !backend_already_running {
                println!("Backend not running, spawning sidecar...");
                match Command::new_sidecar("api_server") {
                    Ok(cmd) => match cmd.spawn() {
                        Ok((rx, child)) => {
                            println!("Sidecar spawned successfully (PID: {:?})", child.pid());
                            
                            tauri::async_runtime::spawn(async move {
                                let mut rx = rx;
                                while let Some(event) = rx.recv().await {
                                    match event {
                                        CommandEvent::Stdout(line) => {
                                            println!("[BACKEND STDOUT] {}", line);
                                            output_log_clone.lock().unwrap().push(format!("[STDOUT] {}", line));
                                        }
                                        CommandEvent::Stderr(line) => {
                                            eprintln!("[BACKEND STDERR] {}", line);
                                            output_log_clone.lock().unwrap().push(format!("[STDERR] {}", line));
                                        }
                                        CommandEvent::Error(err) => {
                                            eprintln!("[BACKEND ERROR] {}", err);
                                            output_log_clone.lock().unwrap().push(format!("[ERROR] {}", err));
                                        }
                                        CommandEvent::Terminated(payload) => {
                                            eprintln!("[BACKEND TERMINATED] code: {:?}, signal: {:?}", 
                                                payload.code, payload.signal);
                                            output_log_clone.lock().unwrap().push(
                                                format!("[TERMINATED] code: {:?}", payload.code)
                                            );
                                        }
                                        _ => {}
                                    }
                                }
                            });
                            
                            (Some(child), true)
                        }
                        Err(e) => {
                            eprintln!("Failed to spawn sidecar: {}", e);
                            return Err(format!("Failed to spawn backend: {}", e).into());
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to create sidecar command: {}", e);
                        return Err(format!("Failed to create backend command: {}", e).into());
                    }
                }
            } else {
                println!("Backend already running, using existing instance");
                (None, false)
            };

            println!("Waiting for backend healthcheck...");
            if !wait_for_backend(output_log.clone()) {
                if we_own_it {
                    let mut child = child;
                    kill_backend(&mut child);
                }
                return Err("backend healthcheck failed - check logs above".into());
            }
            println!("Backend is healthy!");

            app.manage(BackendState {
                child: Mutex::new(child),
                we_own_backend: Mutex::new(we_own_it),
                output_log,
            });

            window.show()?;
            window.set_focus()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            has_config,
            save_config,
            load_config,
            get_env_path,
            delete_config,
            get_config_dir,
            get_config_info,
        ])
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                let app_handle = event.window().app_handle();
                let state = app_handle.state::<BackendState>();

                let should_kill = *state.we_own_backend.lock().unwrap_or_else(|e| e.into_inner());

                if should_kill {
                    println!("Killing backend process...");
                    if let Ok(mut child_guard) = state.child.lock() {
                        kill_backend(&mut child_guard);
                    }
                } else {
                    println!("Not killing backend (we didn't spawn it)");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}