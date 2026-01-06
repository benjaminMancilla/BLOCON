import { invoke } from "@tauri-apps/api/tauri";
import { useState } from "react";
import { Trash2, FolderOpen, Info } from "lucide-react";

export function DebugConfig() {
  const [configInfo, setConfigInfo] = useState<string>("");
  const [showInfo, setShowInfo] = useState(false);

  const handleShowInfo = async () => {
    try {
      const info = await invoke<string>("get_config_info");
      setConfigInfo(info);
      setShowInfo(true);
    } catch (error) {
      console.error("Error getting config info:", error);
      alert("Error obteniendo información de configuración");
    }
  };

  const handleOpenFolder = async () => {
    try {
      const dir = await invoke<string>("get_config_dir");
      // En Windows, abre el explorador de archivos
      if (window.__TAURI__) {
        const { shell } = await import("@tauri-apps/api");
        await shell.open(dir);
      } else {
        alert(`Directorio de configuración:\n${dir}`);
      }
    } catch (error) {
      console.error("Error opening folder:", error);
      alert("Error abriendo carpeta");
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar toda la configuración?")) {
      return;
    }

    try {
      await invoke("delete_config");
      alert("Configuración eliminada correctamente");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting config:", error);
      alert("No se pudo eliminar la configuración");
    }
  };

  return (
    <div style={{ 
      position: "fixed", 
      bottom: "20px", 
      right: "20px", 
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    }}>
      <button
        onClick={handleShowInfo}
        style={{
          padding: "12px",
          background: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "14px",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
        }}
      >
        <Info size={18} />
        Ver Info Config
      </button>

      <button
        onClick={handleOpenFolder}
        style={{
          padding: "12px",
          background: "#8b5cf6",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "14px",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)"
        }}
      >
        <FolderOpen size={18} />
        Abrir Carpeta
      </button>

      <button
        onClick={handleDeleteConfig}
        style={{
          padding: "12px",
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "14px",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
        }}
      >
        <Trash2 size={18} />
        Eliminar Config
      </button>

      {showInfo && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            maxWidth: "600px",
            zIndex: 10000
          }}
        >
          <h3 style={{ marginTop: 0 }}>Información de Configuración</h3>
          <pre style={{ 
            background: "#f1f5f9", 
            padding: "12px", 
            borderRadius: "8px",
            overflow: "auto",
            fontSize: "12px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all"
          }}>
            {configInfo}
          </pre>
          <button
            onClick={() => setShowInfo(false)}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999
          }}
        />
      )}
    </div>
  );
}