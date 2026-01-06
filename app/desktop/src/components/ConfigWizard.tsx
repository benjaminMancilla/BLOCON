import { invoke } from "@tauri-apps/api/tauri";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Loader2,
  LockKeyhole,
  Settings,
  User,
} from "lucide-react";

type SharePointConfig = {
  user_name: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  site_id: string;
  site_hostname: string;
  site_path: string;
  events_list_id: string;
  events_list_name: string;
  events_field_kind: string;
  events_field_ts: string;
  events_field_actor: string;
  events_field_version: string;
  events_field_payload: string;
  events_field_snapshot_file: string;
  snapshots_library_id: string;
  snapshots_library_name: string;
  events_snapshot_threshold_kb: number;
  failures_list_id: string;
  failures_list_name: string;
  failures_field_component: string;
  failures_field_date: string;
  failures_field_type: string;
  components_list_id: string;
  components_list_name: string;
  components_field_id: string;
  components_field_name: string;
  components_field_subtype: string;
  components_field_type: string;
  components_field_insid: string;
  graph_base: string;
  graph_scope: string;
  timeout_s: number;
};

type ConfigWizardProps = {
  initialHasConfig?: boolean;
  initialError?: string | null;
};

const DEFAULT_CONFIG: SharePointConfig = {
  user_name: "",
  tenant_id: "",
  client_id: "",
  client_secret: "",
  site_id: "",
  site_hostname: "your-hostname-here.sharepoint.com",
  site_path: "/sites/your-site-name",
  events_list_id: "",
  events_list_name: "eventsBLOCON",
  events_field_kind: "kind",
  events_field_ts: "timestamp",
  events_field_actor: "actor",
  events_field_version: "version",
  events_field_payload: "payload",
  events_field_snapshot_file: "snapshot_file",
  snapshots_library_id: "",
  snapshots_library_name: "snapshotsBLOCON",
  events_snapshot_threshold_kb: 100,
  failures_list_id: "",
  failures_list_name: "KKS_Failures",
  failures_field_component: "Component_ID",
  failures_field_date: "failure_date",
  failures_field_type: "type_failure",
  components_list_id: "",
  components_list_name: "Unit",
  components_field_id: "kks",
  components_field_name: "kks_name",
  components_field_subtype: "Subtype_Text",
  components_field_type: "Type_text",
  components_field_insid: "insID",
  graph_base: "https://graph.microsoft.com/v1.0",
  graph_scope: "https://graph.microsoft.com/.default",
  timeout_s: 30,
};

export function ConfigWizard({
  initialHasConfig,
  initialError,
}: ConfigWizardProps) {
  const [status, setStatus] = useState<
    "checking" | "idle" | "saving" | "success" | "error" | "configured"
  >(initialHasConfig === undefined ? "checking" : initialHasConfig ? "configured" : "idle");
  const [config, setConfig] = useState<SharePointConfig>(DEFAULT_CONFIG);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(initialError ?? null);

  useEffect(() => {
    if (initialHasConfig !== undefined) return;
    let isMounted = true;
    invoke<boolean>("has_config")
      .then((result) => {
        if (!isMounted) return;
        if (result) {
          setStatus("configured");
        } else {
          setStatus("idle");
        }
      })
      .catch((error) => {
        console.error("Error checking config:", error);
        if (isMounted) {
          setStatus("idle");
          setMessage("No se pudo verificar la configuración. Puedes reintentar guardarla.");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [initialHasConfig]);

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    
    // Step 0: Welcome
    if (currentStep === 0 && !config.user_name.trim()) {
      nextErrors.user_name = "El nombre es requerido.";
    }
    
    // Step 1: Azure AD
    if (currentStep === 1) {
      if (!config.tenant_id.trim()) {
        nextErrors.tenant_id = "Tenant ID es requerido.";
      }
      if (!config.client_id.trim()) {
        nextErrors.client_id = "Client ID es requerido.";
      }
      if (!config.client_secret.trim()) {
        nextErrors.client_secret = "Client Secret es requerido.";
      }
    }
    
    return nextErrors;
  }, [currentStep, config.user_name, config.tenant_id, config.client_id, config.client_secret]);

  const loadExistingConfig = async () => {
    try {
      const loaded = await invoke<SharePointConfig>("load_config");
      setConfig({ ...DEFAULT_CONFIG, ...loaded });
      setStatus("idle");
      setMessage(null);
    } catch (error) {
      console.error("Error loading config:", error);
      setMessage("No se pudo cargar la configuración actual.");
    }
  };

  const handleNext = () => {
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setStatus("error");
      setMessage("Por favor completa los campos requeridos.");
      return;
    }
    
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
      setMessage(null);
      setStatus("idle");
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setMessage(null);
      setStatus("idle");
    }
  };

  const handleSave = async () => {
    setStatus("saving");
    setMessage(null);
    try {
      // Asegurar que todos los campos estén presentes
      const configToSave = {
        ...config,
        user_name: config.user_name || "",
      };
      
      console.log("Saving config:", configToSave);
      
      await invoke("save_config", { config: configToSave });
      setStatus("success");
      setMessage(`¡Perfecto${config.user_name ? ', ' + config.user_name : ''}! Configuración guardada. Reiniciando...`);
      window.setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error("Error saving config:", error);
      setStatus("error");
      setMessage(`No se pudo guardar la configuración: ${error}`);
    }
  };

  const handleChange =
    (key: keyof SharePointConfig) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  if (status === "checking") {
    return (
      <div className="config-wizard config-wizard__loading">
        <div className="config-wizard__spinner">
          <Loader2 className="config-wizard__spinner-icon" aria-hidden="true" />
          <span>Verificando configuración...</span>
        </div>
      </div>
    );
  }

  if (status === "configured") {
    return (
      <div className="config-wizard" data-step="0">
        <div className="config-wizard__card">
          <div className="config-wizard__status config-wizard__status--success">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <h2>Configuración lista</h2>
              <p>La conexión con SharePoint ya está configurada.</p>
            </div>
          </div>
          <button
            type="button"
            className="config-wizard__button"
            onClick={loadExistingConfig}
          >
            Ver / Editar configuración
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="config-wizard" data-step={currentStep}>
      <div className="config-wizard__card">
        <div className="config-wizard__progress">
          <div className="config-wizard__progress-bar">
            <div 
              className="config-wizard__progress-fill" 
              style={{ width: `${((currentStep + 1) / 3) * 100}%` }}
            />
          </div>
          <span className="config-wizard__progress-text">
            Paso {currentStep + 1} de 3
          </span>
        </div>

        {message && (
          <div
            className={`config-wizard__alert ${
              status === "success"
                ? "config-wizard__alert--success"
                : "config-wizard__alert--error"
            }`}
            role="alert"
          >
            {status === "success" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            <span>{message}</span>
          </div>
        )}

        <form
          className="config-wizard__form"
          onSubmit={(event) => {
            event.preventDefault();
            handleNext();
          }}
        >
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="config-wizard__step">
              <header className="config-wizard__header">
                <div className="config-wizard__icon config-wizard__icon--welcome">
                  <User aria-hidden="true" />
                </div>
                <div>
                  <p className="config-wizard__eyebrow">Blocon Setup</p>
                  <h1>¡Bienvenido!</h1>
                  <p className="config-wizard__subtitle">
                    Comencemos por conocernos. ¿Cómo te llamas?
                  </p>
                </div>
              </header>

              <section className="config-wizard__section">
                <div className="config-wizard__field">
                  <label htmlFor="user_name">Tu nombre *</label>
                  <input
                    id="user_name"
                    type="text"
                    value={config.user_name}
                    onChange={handleChange("user_name")}
                    placeholder="Ej: Juan Pérez"
                    aria-invalid={Boolean(errors.user_name)}
                    aria-describedby={errors.user_name ? "user_name-error" : undefined}
                    autoFocus
                  />
                  {errors.user_name && (
                    <span id="user_name-error" className="config-wizard__error">
                      {errors.user_name}
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Step 1: Azure AD */}
          {currentStep === 1 && (
            <div className="config-wizard__step">
              <header className="config-wizard__header">
                <div className="config-wizard__icon config-wizard__icon--azure">
                  <Cloud aria-hidden="true" />
                </div>
                <div>
                  <p className="config-wizard__eyebrow">Paso 2 de 3</p>
                  <h1>Credenciales Azure AD</h1>
                  <p className="config-wizard__subtitle">
                    Configura la autenticación con Microsoft Azure Active Directory.
                  </p>
                </div>
              </header>

              <section className="config-wizard__section">
                <div className="config-wizard__field">
                  <label htmlFor="tenant_id">Tenant ID *</label>
                  <input
                    id="tenant_id"
                    type="text"
                    value={config.tenant_id}
                    onChange={handleChange("tenant_id")}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    aria-invalid={Boolean(errors.tenant_id)}
                    aria-describedby={errors.tenant_id ? "tenant_id-error" : undefined}
                  />
                  {errors.tenant_id && (
                    <span id="tenant_id-error" className="config-wizard__error">
                      {errors.tenant_id}
                    </span>
                  )}
                </div>
                <div className="config-wizard__field">
                  <label htmlFor="client_id">Client ID *</label>
                  <input
                    id="client_id"
                    type="text"
                    value={config.client_id}
                    onChange={handleChange("client_id")}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    aria-invalid={Boolean(errors.client_id)}
                    aria-describedby={errors.client_id ? "client_id-error" : undefined}
                  />
                  {errors.client_id && (
                    <span id="client_id-error" className="config-wizard__error">
                      {errors.client_id}
                    </span>
                  )}
                </div>
                <div className="config-wizard__field">
                  <label htmlFor="client_secret">Client Secret *</label>
                  <div className="config-wizard__input-with-icon">
                    <LockKeyhole aria-hidden="true" />
                    <input
                      id="client_secret"
                      type="password"
                      value={config.client_secret}
                      onChange={handleChange("client_secret")}
                      placeholder="••••••••••••••••"
                      aria-invalid={Boolean(errors.client_secret)}
                      aria-describedby={errors.client_secret ? "client_secret-error" : undefined}
                    />
                  </div>
                  {errors.client_secret && (
                    <span id="client_secret-error" className="config-wizard__error">
                      {errors.client_secret}
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Step 2: SharePoint */}
          {currentStep === 2 && (
            <div className="config-wizard__step">
              <header className="config-wizard__header">
                <div className="config-wizard__icon config-wizard__icon--sharepoint">
                  <Database aria-hidden="true" />
                </div>
                <div>
                  <p className="config-wizard__eyebrow">Paso 3 de 3</p>
                  <h1>Configuración SharePoint</h1>
                  <p className="config-wizard__subtitle">
                    Configura los recursos y listas de SharePoint (opcional).
                  </p>
                </div>
              </header>

              <section className="config-wizard__section">
                <div className="config-wizard__field">
                  <label htmlFor="site_id">Site ID</label>
                  <div className="config-wizard__input-with-icon">
                    <KeyRound aria-hidden="true" />
                    <input
                      id="site_id"
                      type="text"
                      value={config.site_id}
                      onChange={handleChange("site_id")}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div className="config-wizard__field">
                  <label htmlFor="events_list_id">Events List ID</label>
                  <input
                    id="events_list_id"
                    type="text"
                    value={config.events_list_id}
                    onChange={handleChange("events_list_id")}
                    placeholder="Opcional"
                  />
                </div>
                <div className="config-wizard__field">
                  <label htmlFor="components_list_id">Components List ID</label>
                  <input
                    id="components_list_id"
                    type="text"
                    value={config.components_list_id}
                    onChange={handleChange("components_list_id")}
                    placeholder="Opcional"
                  />
                </div>
                <div className="config-wizard__field">
                  <label htmlFor="failures_list_id">Failures List ID</label>
                  <input
                    id="failures_list_id"
                    type="text"
                    value={config.failures_list_id}
                    onChange={handleChange("failures_list_id")}
                    placeholder="Opcional"
                  />
                </div>
              </section>
            </div>
          )}

          <div className="config-wizard__actions">
            {currentStep > 0 && (
              <button
                type="button"
                className="config-wizard__button config-wizard__button--secondary"
                onClick={handleBack}
                disabled={status === "saving"}
              >
                <ArrowLeft aria-hidden="true" />
                Atrás
              </button>
            )}
            <button
              type="submit"
              className="config-wizard__button"
              disabled={status === "saving"}
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="config-wizard__spinner-icon" aria-hidden="true" />
                  Guardando...
                </>
              ) : currentStep < 2 ? (
                <>
                  Continuar
                  <ArrowRight aria-hidden="true" />
                </>
              ) : (
                <>
                  <Settings aria-hidden="true" />
                  Guardar configuración
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}