use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharePointConfig {
    pub user_name: String,
    pub tenant_id: String,
    pub client_id: String,
    pub client_secret: String,
    pub site_id: String,
    pub site_hostname: String,
    pub site_path: String,
    pub events_list_id: String,
    pub events_list_name: String,
    pub events_field_kind: String,
    pub events_field_ts: String,
    pub events_field_actor: String,
    pub events_field_version: String,
    pub events_field_payload: String,
    pub events_field_snapshot_file: String,
    pub snapshots_library_id: String,
    pub snapshots_library_name: String,
    pub events_snapshot_threshold_kb: u32,
    pub failures_list_id: String,
    pub failures_list_name: String,
    pub failures_field_component: String,
    pub failures_field_date: String,
    pub failures_field_type: String,
    pub components_list_id: String,
    pub components_list_name: String,
    pub components_field_id: String,
    pub components_field_name: String,
    pub components_field_subtype: String,
    pub components_field_type: String,
    pub components_field_insid: String,
    pub graph_base: String,
    pub graph_scope: String,
    pub timeout_s: u32,
}

impl Default for SharePointConfig {
    fn default() -> Self {
        Self {
            user_name: String::new(),
            tenant_id: String::new(),
            client_id: String::new(),
            client_secret: String::new(),
            site_id: String::new(),
            site_hostname: "your-hostname-here.sharepoint.com".to_string(),
            site_path: "/sites/your-site-name".to_string(),
            events_list_id: String::new(),
            events_list_name: "eventsBLOCON".to_string(),
            events_field_kind: "kind".to_string(),
            events_field_ts: "timestamp".to_string(),
            events_field_actor: "actor".to_string(),
            events_field_version: "version".to_string(),
            events_field_payload: "payload".to_string(),
            events_field_snapshot_file: "snapshot_file".to_string(),
            snapshots_library_id: String::new(),
            snapshots_library_name: "snapshotsBLOCON".to_string(),
            events_snapshot_threshold_kb: 100,
            failures_list_id: String::new(),
            failures_list_name: "KKS_Failures".to_string(),
            failures_field_component: "Component_ID".to_string(),
            failures_field_date: "failure_date".to_string(),
            failures_field_type: "type_failure".to_string(),
            components_list_id: String::new(),
            components_list_name: "Unit".to_string(),
            components_field_id: "kks".to_string(),
            components_field_name: "kks_name".to_string(),
            components_field_subtype: "Subtype_Text".to_string(),
            components_field_type: "Type_text".to_string(),
            components_field_insid: "insID".to_string(),
            graph_base: "https://graph.microsoft.com/v1.0".to_string(),
            graph_scope: "https://graph.microsoft.com/.default".to_string(),
            timeout_s: 30,
        }
    }
}

impl SharePointConfig {
    pub fn to_env_format(&self) -> String {
        let mut lines = Vec::new();
        lines.push(format!("USER_NAME={}", self.user_name));
        lines.push(String::new());
        lines.push(format!("SP_TENANT_ID={}", self.tenant_id));
        lines.push(format!("SP_CLIENT_ID={}", self.client_id));
        lines.push(format!("SP_CLIENT_SECRET={}", self.client_secret));
        lines.push(String::new());
        lines.push(format!("SP_SITE_ID={}", self.site_id));
        lines.push(format!("SP_SITE_HOSTNAME={}", self.site_hostname));
        lines.push(format!("SP_SITE_PATH={}", self.site_path));
        lines.push(String::new());
        lines.push(format!("SP_GRAPH_BASE={}", self.graph_base));
        lines.push(format!("SP_GRAPH_SCOPE={}", self.graph_scope));
        lines.push(format!("SP_TIMEOUT_S={}", self.timeout_s));
        lines.push(String::new());
        lines.push(format!("SP_EVENTS_LIST_ID={}", self.events_list_id));
        lines.push(format!("SP_EVENTS_LIST_NAME={}", self.events_list_name));
        lines.push(format!(
            "SP_EVENTS_SNAPSHOT_THRESHOLD_KB={}",
            self.events_snapshot_threshold_kb
        ));
        lines.push(format!("SP_EVENTS_FIELD_KIND={}", self.events_field_kind));
        lines.push(format!("SP_EVENTS_FIELD_TS={}", self.events_field_ts));
        lines.push(format!("SP_EVENTS_FIELD_ACTOR={}", self.events_field_actor));
        lines.push(format!(
            "SP_EVENTS_FIELD_VERSION={}",
            self.events_field_version
        ));
        lines.push(format!(
            "SP_EVENTS_FIELD_PAYLOAD={}",
            self.events_field_payload
        ));
        lines.push(format!(
            "SP_EVENTS_FIELD_SNAPSHOT_FILE={}",
            self.events_field_snapshot_file
        ));
        lines.push(format!(
            "SP_SNAPSHOTS_LIBRARY_ID={}",
            self.snapshots_library_id
        ));
        lines.push(format!(
            "SP_SNAPSHOTS_LIBRARY_NAME={}",
            self.snapshots_library_name
        ));
        lines.push(String::new());
        lines.push(format!("SP_FAILURES_LIST_ID={}", self.failures_list_id));
        lines.push(format!("SP_FAILURES_LIST_NAME={}", self.failures_list_name));
        lines.push(format!(
            "SP_FAILURES_FIELD_COMPONENT={}",
            self.failures_field_component
        ));
        lines.push(format!(
            "SP_FAILURES_FIELD_DATE={}",
            self.failures_field_date
        ));
        lines.push(format!(
            "SP_FAILURES_FIELD_TYPE={}",
            self.failures_field_type
        ));
        lines.push(String::new());
        lines.push(format!(
            "SP_COMPONENTS_LIST_ID={}",
            self.components_list_id
        ));
        lines.push(format!(
            "SP_COMPONENTS_LIST_NAME={}",
            self.components_list_name
        ));
        lines.push(format!("SP_COMPONENTS_FIELD_ID={}", self.components_field_id));
        lines.push(format!(
            "SP_COMPONENTS_FIELD_NAME={}",
            self.components_field_name
        ));
        lines.push(format!(
            "SP_COMPONENTS_FIELD_SUBTYPE={}",
            self.components_field_subtype
        ));
        lines.push(format!(
            "SP_COMPONENTS_FIELD_TYPE={}",
            self.components_field_type
        ));
        lines.push(format!(
            "SP_COMPONENTS_FIELD_INSID={}",
            self.components_field_insid
        ));
        lines.push(String::new());
        lines.join("\n")
    }
}

pub struct ConfigManager {
    pub config_dir: PathBuf,
    pub config_file: PathBuf,
    pub env_file: PathBuf,
}

impl ConfigManager {
    pub fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let base_dir = app_handle
            .path_resolver()
            .app_local_data_dir()
            .or_else(tauri::api::path::local_data_dir)
            .ok_or("Unable to determine local app data directory")?;
        let config_dir = base_dir.join("Blocon");
        let config_file = config_dir.join("config.dat");
        let env_file = config_dir.join(".env");

        Ok(Self {
            config_dir,
            config_file,
            env_file,
        })
    }

    pub fn has_config(&self) -> bool {
        self.config_file.exists() || self.env_file.exists()
    }

    pub fn save_config(&self, config: &SharePointConfig) -> Result<(), String> {
        fs::create_dir_all(&self.config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        let payload = serde_json::to_vec(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        let encrypted = encrypt_bytes(&payload)?;
        fs::write(&self.config_file, encrypted)
            .map_err(|e| format!("Failed to write config.dat: {}", e))?;
        self.write_env(config)?;
        Ok(())
    }

    pub fn load_config(&self) -> Result<SharePointConfig, String> {
        if self.config_file.exists() {
            let encrypted =
                fs::read(&self.config_file).map_err(|e| format!("Failed to read config.dat: {}", e))?;
            match decrypt_bytes(&encrypted)
                .and_then(|data| serde_json::from_slice::<SharePointConfig>(&data)
                    .map_err(|e| format!("Invalid config.dat JSON: {}", e)))
            {
                Ok(config) => return Ok(config),
                Err(err) => {
                    eprintln!("Warning: {}", err);
                }
            }
        }

        let env_candidates = env_fallback_paths(&self.env_file);
        for path in env_candidates {
            if path.exists() {
                let contents =
                    fs::read_to_string(&path).map_err(|e| format!("Failed to read .env: {}", e))?;
                let parsed = parse_env(&contents);
                let config = config_from_env(&parsed);
                validate_required(&config)?;
                return Ok(config);
            }
        }

        Err("No configuration found".to_string())
    }

    pub fn get_env_path(&self) -> PathBuf {
        self.env_file.clone()
    }

    fn write_env(&self, config: &SharePointConfig) -> Result<(), String> {
        let env_contents = config.to_env_format();
        fs::write(&self.env_file, env_contents)
            .map_err(|e| format!("Failed to write .env: {}", e))
    }
}

fn validate_required(config: &SharePointConfig) -> Result<(), String> {
    if config.tenant_id.is_empty()
        || config.client_id.is_empty()
        || config.client_secret.is_empty()
    {
        return Err("Missing required SharePoint credentials".to_string());
    }
    Ok(())
}

fn env_fallback_paths(primary: &PathBuf) -> Vec<PathBuf> {
    let mut paths = vec![primary.clone()];
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join(".env"));
    }
    paths
}

fn parse_env(contents: &str) -> HashMap<String, String> {
    let mut values = HashMap::new();
    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.splitn(2, '=');
        let key = match parts.next() {
            Some(key) if !key.trim().is_empty() => key.trim(),
            _ => continue,
        };
        let value = parts.next().unwrap_or("").trim();
        let cleaned = value
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();
        values.insert(key.to_string(), cleaned);
    }
    values
}

fn config_from_env(values: &HashMap<String, String>) -> SharePointConfig {
    let mut config = SharePointConfig::default();

    set_value(&mut config.user_name, values, "USER_NAME");
    set_value(&mut config.tenant_id, values, "SP_TENANT_ID");
    set_value(&mut config.client_id, values, "SP_CLIENT_ID");
    set_value(&mut config.client_secret, values, "SP_CLIENT_SECRET");
    set_value(&mut config.site_id, values, "SP_SITE_ID");
    set_value(&mut config.site_hostname, values, "SP_SITE_HOSTNAME");
    set_value(&mut config.site_path, values, "SP_SITE_PATH");
    set_value(&mut config.graph_base, values, "SP_GRAPH_BASE");
    set_value(&mut config.graph_scope, values, "SP_GRAPH_SCOPE");
    set_value(&mut config.events_list_id, values, "SP_EVENTS_LIST_ID");
    set_value(&mut config.events_list_name, values, "SP_EVENTS_LIST_NAME");
    set_value(&mut config.events_field_kind, values, "SP_EVENTS_FIELD_KIND");
    set_value(&mut config.events_field_ts, values, "SP_EVENTS_FIELD_TS");
    set_value(&mut config.events_field_actor, values, "SP_EVENTS_FIELD_ACTOR");
    set_value(&mut config.events_field_version, values, "SP_EVENTS_FIELD_VERSION");
    set_value(&mut config.events_field_payload, values, "SP_EVENTS_FIELD_PAYLOAD");
    set_value(
        &mut config.events_field_snapshot_file,
        values,
        "SP_EVENTS_FIELD_SNAPSHOT_FILE",
    );
    set_value(
        &mut config.snapshots_library_id,
        values,
        "SP_SNAPSHOTS_LIBRARY_ID",
    );
    set_value(
        &mut config.snapshots_library_name,
        values,
        "SP_SNAPSHOTS_LIBRARY_NAME",
    );
    set_value(&mut config.failures_list_id, values, "SP_FAILURES_LIST_ID");
    set_value(
        &mut config.failures_list_name,
        values,
        "SP_FAILURES_LIST_NAME",
    );
    set_value(
        &mut config.failures_field_component,
        values,
        "SP_FAILURES_FIELD_COMPONENT",
    );
    set_value(
        &mut config.failures_field_date,
        values,
        "SP_FAILURES_FIELD_DATE",
    );
    set_value(
        &mut config.failures_field_type,
        values,
        "SP_FAILURES_FIELD_TYPE",
    );
    set_value(
        &mut config.components_list_id,
        values,
        "SP_COMPONENTS_LIST_ID",
    );
    set_value(
        &mut config.components_list_name,
        values,
        "SP_COMPONENTS_LIST_NAME",
    );
    set_value(
        &mut config.components_field_id,
        values,
        "SP_COMPONENTS_FIELD_ID",
    );
    set_value(
        &mut config.components_field_name,
        values,
        "SP_COMPONENTS_FIELD_NAME",
    );
    set_value(
        &mut config.components_field_subtype,
        values,
        "SP_COMPONENTS_FIELD_SUBTYPE",
    );
    set_value(
        &mut config.components_field_type,
        values,
        "SP_COMPONENTS_FIELD_TYPE",
    );
    set_value(
        &mut config.components_field_insid,
        values,
        "SP_COMPONENTS_FIELD_INSID",
    );

    if let Some(timeout) = values.get("SP_TIMEOUT_S") {
        if let Ok(parsed) = timeout.parse::<f32>() {
            if parsed.is_finite() {
                config.timeout_s = parsed.round().max(1.0) as u32;
            }
        }
    }

    if let Some(threshold) = values.get("SP_EVENTS_SNAPSHOT_THRESHOLD_KB") {
        if let Ok(parsed) = threshold.parse::<f32>() {
            if parsed.is_finite() {
                config.events_snapshot_threshold_kb = parsed.round().max(1.0) as u32;
            }
        }
    }

    config
}

fn set_value(target: &mut String, values: &HashMap<String, String>, key: &str) {
    if let Some(value) = values.get(key) {
        if !value.is_empty() {
            *target = value.clone();
        }
    }
}

#[cfg(windows)]
fn encrypt_bytes(input: &[u8]) -> Result<Vec<u8>, String> {
    if input.len() > u32::MAX as usize {
        return Err("Config payload too large".to_string());
    }

    use std::ptr::null_mut;
    use winapi::um::dpapi::CryptProtectData;
    use winapi::um::wincrypt::DATA_BLOB;

    let mut in_blob = DATA_BLOB {
        cbData: input.len() as u32,
        pbData: input.as_ptr() as *mut u8,
    };
    let mut out_blob = DATA_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let result = unsafe {
        CryptProtectData(
            &mut in_blob,
            std::ptr::null(),
            null_mut(),
            null_mut(),
            null_mut(),
            0,
            &mut out_blob,
        )
    };

    if result == 0 {
        return Err("DPAPI encryption failed".to_string());
    }

    let encrypted = unsafe {
        std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec()
    };
    unsafe {
        winapi::um::winbase::LocalFree(out_blob.pbData as *mut _);
    }
    Ok(encrypted)
}

#[cfg(windows)]
fn decrypt_bytes(input: &[u8]) -> Result<Vec<u8>, String> {
    if input.len() > u32::MAX as usize {
        return Err("Config payload too large".to_string());
    }

    use std::ptr::null_mut;
    use winapi::um::dpapi::CryptUnprotectData;
    use winapi::um::wincrypt::DATA_BLOB;

    let mut in_blob = DATA_BLOB {
        cbData: input.len() as u32,
        pbData: input.as_ptr() as *mut u8,
    };
    let mut out_blob = DATA_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    let result = unsafe {
        CryptUnprotectData(
            &mut in_blob,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            0,
            &mut out_blob,
        )
    };

    if result == 0 {
        return Err("DPAPI decryption failed".to_string());
    }

    let decrypted = unsafe {
        std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec()
    };
    unsafe {
        winapi::um::winbase::LocalFree(out_blob.pbData as *mut _);
    }
    Ok(decrypted)
}

#[cfg(not(windows))]
fn encrypt_bytes(input: &[u8]) -> Result<Vec<u8>, String> {
    eprintln!("Warning: DPAPI not available, storing config without encryption.");
    Ok(input.to_vec())
}

#[cfg(not(windows))]
fn decrypt_bytes(input: &[u8]) -> Result<Vec<u8>, String> {
    Ok(input.to_vec())
}

#[tauri::command]
pub fn has_config(app_handle: AppHandle) -> Result<bool, String> {
    let manager = ConfigManager::new(&app_handle)?;
    Ok(manager.has_config())
}

#[tauri::command]
pub fn save_config(config: SharePointConfig, app_handle: AppHandle) -> Result<(), String> {
    validate_required(&config)?;
    let manager = ConfigManager::new(&app_handle)?;
    manager.save_config(&config)
}

#[tauri::command]
pub fn load_config(app_handle: AppHandle) -> Result<SharePointConfig, String> {
    let manager = ConfigManager::new(&app_handle)?;
    manager.load_config()
}

#[tauri::command]
pub fn get_env_path(app_handle: AppHandle) -> Result<String, String> {
    let manager = ConfigManager::new(&app_handle)?;
    Ok(manager.get_env_path().to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_config(app_handle: AppHandle) -> Result<(), String> {
    let manager = ConfigManager::new(&app_handle)?;
    
    // Delete config.dat if it exists
    if manager.config_file.exists() {
        fs::remove_file(&manager.config_file)
            .map_err(|e| format!("Failed to delete config.dat: {}", e))?;
    }
    
    // Delete .env if it exists
    if manager.env_file.exists() {
        fs::remove_file(&manager.env_file)
            .map_err(|e| format!("Failed to delete .env: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_config_dir(app_handle: AppHandle) -> Result<String, String> {
    let manager = ConfigManager::new(&app_handle)?;
    Ok(manager.config_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_config_info(app_handle: AppHandle) -> Result<String, String> {
    let manager = ConfigManager::new(&app_handle)?;
    let mut info = String::new();
    
    info.push_str(&format!("Config directory: {}\n", manager.config_dir.display()));
    info.push_str(&format!("Config file: {}\n", manager.config_file.display()));
    info.push_str(&format!("Env file: {}\n\n", manager.env_file.display()));
    
    info.push_str(&format!("config.dat exists: {}\n", manager.config_file.exists()));
    info.push_str(&format!(".env exists: {}\n", manager.env_file.exists()));
    
    Ok(info)
}