import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from tkinter import font as tkfont
from typing import Dict, Tuple, Optional, List, Set
from datetime import datetime, timezone
import json
import os
import time
import requests

from .components.topbar import TopBar
from .components.camera import CameraController
from .components.hover_menu import HoverMenu, NullHoverMenu
from .components.renderer import ComponentRenderer
from .components.gates import GateRenderer
from .components.version_control import VersionControlDialog

from ..model.graph.graph import ReliabilityGraph
from ..model.graph.dist import Dist
from ..model.eventsourcing.events import SnapshotEvent 
from ..model.eventsourcing.service import GraphES
from ..services.remote.cloud import CloudClient
from ..services.cache.event_store import EventStore

from ..model.eventsourcing.events import event_from_dict

from ..services.failure import FailuresService
from ..services.cache.repositories.failures import FailuresCacheRepo


# RBD-style constants
BLOCK_W = 190
BLOCK_H = 80
ICON_TOP_H = 68
ICON_BLOCK = 120         # square side for icon mode (sube acorde)
MIN_ICON_PX = 16         # un poco mayores para ver mejor al hacer zoom
MAX_ICON_PX = 96
ICON_SIZE_FRAC = 0.5     # icon occupies 50% of square side
SERIES_H_SPACING = 80      # más aire entre bloques en serie
PAR_V_SPACING = 60         # más aire entre ramas
PAR_BUS_MARGIN = 48        # margen lateral ramas↔rieles
PAR_MIN_WIDTH = BLOCK_W + 2 * PAR_BUS_MARGIN
GROUP_LABEL_H = 22         # etiqueta de gate algo más alta
MARGIN_L = 60
MARGIN_T = 40
KOON_TOP_MARGIN = 18
KOON_BADGE_RADIUS = 28

IGNORE_LOGIN = True


class ReliabilityGUI(tk.Tk):
    def __init__(self, es: GraphES, *, read_only: bool = False, title: str | None = None):
        super().__init__()
        self.es = es
        self.read_only = read_only
        self.title(title or ("GM Reliability Block Diagram Editor" if not read_only else "RBD Viewer"))
        self.geometry("1000x700")
        self.configure(bg="white")
        self._busy: bool = False

        repo = FailuresCacheRepo(data_dir=self._local_cache().cache_dir)
        self._failures = FailuresService.from_env(local_repo=repo, project_root=self._project_root())

        # Auth
        if not IGNORE_LOGIN:
            if not self._require_login():
                self.destroy()
                return
        
        if not self.read_only:
            try:
                if not self.es.store:
                    print("Not defined eventstore")
                    self.es.set_store(EventStore(self._local_cache()))
            except Exception:
                pass

        if not self.read_only:
            # Top bar
            self.topbar = TopBar(self, owner=self)
            self.topbar.pack(fill=tk.X, padx=8, pady=6)

        self.status = ttk.Frame(self, padding=(8, 4))
        self.status_label = ttk.Label(self.status, text="", font=("Segoe UI", 10, "bold"))
        self.status_label.pack(side=tk.LEFT)
        self.status.pack(side=tk.BOTTOM, fill=tk.X)


        # node centers to anchor menu
        self._node_centers: Dict[str, Tuple[float, float]] = {}
        

        # Collapsed gates state
        self._collapsed: Set[str] = set()

        # Unit types + icons
        self._unit_types: List[str] = []
        self._icon_images: Dict[str, tk.PhotoImage] = {}
        self._icon_scaled: Dict[tuple, tk.PhotoImage] = {}
        self._show_icons: bool = False
        self._load_unit_types()

        
        # Canvas
        self.canvas = tk.Canvas(self, bg="white", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Empty diagram
        self._empty_add_btn = None
        self._empty_add_win = None
           
        # Hover/menu state
        anchor_getter = lambda nid: HoverMenu.default_anchor(self.canvas, nid, self._node_centers)

        if self.read_only:
            self.menu = NullHoverMenu(self, self.canvas, anchor_getter)
        else:
            self.menu = HoverMenu(self, self.canvas, anchor_getter)

        # Gates
        self.gates = GateRenderer(
            owner=self,
            canvas=self.canvas,
            menu=self.menu,
            node_centers=self._node_centers
        )

        # Camera / navigation bindings
        self.camera = CameraController(
            owner=self,
            canvas=self.canvas,
            zoom_speed=1.12,   # velocidad de zoom (ajustable)
            min_zoom=0.55,     # zoom out mínimo
            max_zoom=3.0,      # zoom in máximo
            pan_step=60        # paso con flechas
        )

        # Unitary Components
        self.components = ComponentRenderer(
            owner=self,
            canvas=self.canvas,
            camera=self.camera,
            menu=self.menu,
            node_centers=self._node_centers
        )

        # Enlaces de navegación
        self.canvas.bind('<MouseWheel>', self.camera.on_zoom_event)  # Windows/mac
        self.canvas.bind('<Button-4>', self.camera.on_zoom_event)    # Linux up
        self.canvas.bind('<Button-5>', self.camera.on_zoom_event)    # Linux down
        self.canvas.bind('<ButtonPress-1>', self.camera.on_bg_press)
        self.canvas.bind('<B1-Motion>', self.camera.on_bg_drag)
        self.canvas.bind('<ButtonRelease-1>', self.camera.on_bg_release)

        self.bind('<Left>',  lambda e: self.camera.nudge(-self.camera.pan_step, 0))
        self.bind('<Right>', lambda e: self.camera.nudge( self.camera.pan_step, 0))
        self.bind('<Up>',    lambda e: self.camera.nudge(0, -self.camera.pan_step))
        self.bind('<Down>',  lambda e: self.camera.nudge(0,  self.camera.pan_step))

        if not self.read_only:
            self.bind_all("<Control-z>", self.on_undo)
            self.bind_all("<Control-y>", self.on_redo)

        self.canvas.focus_set()
        self._render()

        if not self.read_only:
            try:
                self._bootstrap_on_start()
            except Exception:
                pass


    # ---------- CRUD data Helpers ----------
    def _cloud(self) -> CloudClient:
        if not hasattr(self, "_cloud_client"):
            self._cloud_client = CloudClient(self._project_root())
        return self._cloud_client

    def _local_cache(self):
        # LocalWorkspaceStore (AppData)
        return self._cloud().local

    # ---------- Login / SharePoint auth ----------

    def _require_login(self) -> bool:
        """
        Muestra un diálogo de login y verifica en SharePoint si el usuario
        está autorizado (lista GMToolsUsers con App=BLOCON).
        Devuelve True si puede entrar a la app, False si no.
        """
        dlg = tk.Toplevel(self)
        dlg.title("GMTools – Login")
        dlg.transient(self)
        dlg.grab_set()
        dlg.resizable(False, False)

        frm = ttk.Frame(dlg, padding=12)
        frm.pack(fill=tk.BOTH, expand=True)

        email_var = tk.StringVar(value="")
        status_var = tk.StringVar(value="Ingrese su correo corporativo para continuar.")

        row = 0
        ttk.Label(frm, text="Correo (Microsoft 365):").grid(row=row, column=0, sticky="w")
        row += 1
        ent_email = ttk.Entry(frm, textvariable=email_var, width=36)
        ent_email.grid(row=row, column=0, sticky="we")
        row += 1

        lbl_status = ttk.Label(frm, textvariable=status_var, foreground="#555555")
        lbl_status.grid(row=row, column=0, sticky="w", pady=(6, 0))
        row += 1

        btns = ttk.Frame(frm)
        btns.grid(row=row, column=0, pady=(10, 0), sticky="e")

        result = {"ok": False}

        def do_login():
            email = email_var.get().strip()
            if not email:
                status_var.set("Debe ingresar un correo.")
                return
            try:
                ok, user_type = self._check_sharepoint_user(email)
            except Exception as e:
                messagebox.showerror(
                    "Error de login",
                    f"No se pudo validar el usuario en SharePoint:\n{e}"
                )
                return

            if not ok:
                messagebox.showerror(
                    "Acceso denegado",
                    "Tu usuario no está autorizado para usar BLOCON.\n"
                    "Pide que te agreguen a la lista GMToolsUsers con App=BLOCON."
                )
                return

            # OK → guardamos datos de usuario y cerramos diálogo
            self.user_email = email
            self.user_type = user_type
            try:
                # Usamos el correo como 'actor' en el event sourcing
                self.es.actor = email
            except Exception:
                pass

            result["ok"] = True
            dlg.destroy()

        def on_cancel():
            dlg.destroy()

        ttk.Button(btns, text="Entrar", command=do_login).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(btns, text="Cancelar", command=on_cancel).pack(side=tk.LEFT)

        ent_email.focus_set()
        dlg.bind("<Return>", lambda e: do_login())
        dlg.protocol("WM_DELETE_WINDOW", on_cancel)

        # Bloqueamos hasta que cierre el diálogo
        self.wait_window(dlg)
        return result["ok"]
    

    def _check_sharepoint_user(self, email: str) -> Tuple[bool, Optional[str]]:
        """
        Verifica en SharePoint si el usuario con 'email' está autorizado.

        Regla:
        - Lista: GMToolsUsers (en el site 'gemeherramientas')
        - Columna App (multi-selección) debe contener 'BLOCON'
        - Columna Type guarda el tipo de usuario (multi-selección o simple)

        Devuelve:
        (True, user_type) si está autorizado
        (False, None) si NO está autorizado o no aparece en la lista

        Autenticación:
        Usa client_credentials contra Azure AD. Debes configurar estos
        env vars en la máquina donde corre la app:

            AZURE_TENANT_ID   = "<tu-tenant-id>"
            AZURE_CLIENT_ID   = "<client-id de la app registrada>"
            AZURE_CLIENT_SECRET = "<secret de la app>"

        La app registrada debe tener permisos sobre SharePoint para leer la lista.
        """
        tenant_id = os.environ.get("AZURE_TENANT_ID")
        client_id = os.environ.get("AZURE_CLIENT_ID")
        client_secret = os.environ.get("AZURE_CLIENT_SECRET")

        if not tenant_id or not client_id or not client_secret:
            # Modo "mock" si no hay configuración → dejar entrar a todos,
            # pero avisar en consola. Puedes cambiar esto a False para bloquear.
            print("[WARN] AZURE_* no configurado, login en modo MOCK, se permite todo.")
            return True, "Mock"

        # 1) Obtener token de Azure AD para SharePoint (client_credentials)
        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "resource": "https://generadorametropolitana.sharepoint.com",
        }
        resp = requests.post(token_url, data=data)
        resp.raise_for_status()
        access_token = resp.json().get("access_token")
        if not access_token:
            raise RuntimeError("No se obtuvo access_token desde Azure AD.")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json;odata=nometadata",
        }

        # 2) Llamar al endpoint REST de SharePoint para la lista GMToolsUsers
        site_url = "https://generadorametropolitana.sharepoint.com/sites/gemeherramientas"
        list_title = "GMToolsUsers"

        # Aquí asumo que el correo está en la columna 'Title'. Si tu lista
        # tiene una columna específica 'Email', cambia el filtro:
        #   &$filter=Email eq '{email}'
        filter_email = email.replace("'", "''")
        url = (
            f"{site_url}/_api/web/lists/GetByTitle('{list_title}')/items"
            f"?$select=Title,App,Type"
            f"&$filter=Title eq '{filter_email}'"
        )

        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("value", [])

        if not items:
            # No hay registro para este correo
            return False, None

        item = items[0]

        # 3) Verificar que App contiene 'BLOCON'
        app_value = item.get("App")
        apps: list[str] = []
        if isinstance(app_value, list):
            apps = app_value
        elif isinstance(app_value, dict) and "results" in app_value:
            apps = app_value["results"]
        elif app_value:
            apps = [app_value]

        if "BLOCON" not in apps:
            return False, None

        # 4) Leer Type (puede ser multi-selección también)
        type_value = item.get("Type")
        user_type: Optional[str] = None
        if isinstance(type_value, list):
            user_type = type_value[0] if type_value else None
        elif isinstance(type_value, dict) and "results" in type_value:
            lst = type_value["results"]
            user_type = lst[0] if lst else None
        else:
            user_type = type_value

        return True, user_type


    def _project_root(self) -> str:
        here = os.path.abspath(os.path.dirname(__file__))  # .../rbd
        candidates = [
            os.path.dirname(here),                            # project root (expected)
            os.path.dirname(os.path.dirname(here)),          # backup
        ]
        for root in candidates:
            if os.path.isdir(os.path.join(root, 'assets')):
                return root
        return candidates[0]

    def _load_unit_types(self):
        try:
            base_dir = self._project_root()
            path = os.path.join(base_dir, 'assets', 'unit_types.json')
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self._unit_types = list(map(str, data.get('unit_types', [])))
        except Exception:
            self._unit_types = ['generic']


    # ---------- Toolbar handlers ----------
    def on_reset(self):
        if self.read_only: 
            return
        
        # Primera advertencia
        msg1 = (
            "Se borrará TODO el diagrama local (solo en esta sesión).\n\n"
            "Si luego haces Cloud Save, la nube quedará con un diagrama vacío.\n"
            "Puedes volver al estado anterior usando Version Control.\n\n"
            "¿Deseas continuar?"
        )
        if not messagebox.askyesno("Reset diagram", msg1):
            return
        
        # Doble confirmación
        msg2 = "Confirmación final: esto limpiará el diagrama actual. ¿Continuar?"
        if not messagebox.askyesno("Confirm reset", msg2):
            return
        
        # Efecto: limpiar grafo local y colapsados, y registrar snapshot local
        try:
            self.es.graph.clear()
            try:
                self._collapsed.clear()
            except Exception:
                pass

            # Registrar snapshot en el EventStore local para que quede en el historial
            if self.es.store:
                self.es.snapshot()
        finally:
            self._render()

    def on_add_root(self):
        if self.read_only: 
            return
        if self.es.graph and getattr(self.es.graph, "root", None):
            messagebox.showinfo("Add Root", "El diagrama ya tiene una raíz; no se puede agregar otra.")
            return
        self._open_add_dialog(target_id=None, relation=None)
        

    def on_eval(self):
        if self.read_only: 
            return
        try:
            g = self.es.graph
            comp_ids = sorted([nid for nid, n in g.nodes.items() if n.is_component()])
            info = self._failures.ensure_min_records(comp_ids, None)
            if info.get("needed"):
                pass
        except Exception as e:
            print("ensure_min_records failed:", e)
        try:
            g.project_root = self._project_root()
            g.failures_cache = self._failures.local_repo
            r = self.es.evaluate()
        except Exception as e:
            messagebox.showerror("Error", str(e))
            return
        messagebox.showinfo("Reliability", f"R({datetime.today().date()}) = {r:.6f}")
        self._render()

    # ---------- Settings ----------
    def on_settings(self):
        if self.read_only: 
            return
        dlg = tk.Toplevel(self)
        dlg.title("Settings"); dlg.transient(self); dlg.grab_set()
        frm = ttk.Frame(dlg, padding=10); frm.pack(fill=tk.BOTH, expand=True)
        show_var = tk.BooleanVar(value=self._show_icons)
        ttk.Checkbutton(frm, text="Mostrar iconos", variable=show_var).pack(anchor="w")
        btns = ttk.Frame(frm); btns.pack(pady=(8,0))
        def _apply():
            self._show_icons = bool(show_var.get())
            dlg.destroy()
            self._render()
        ttk.Button(btns, text="OK", command=_apply).pack(side=tk.LEFT, padx=6)
        ttk.Button(btns, text="Cancel", command=dlg.destroy).pack(side=tk.LEFT, padx=6)

    # ---------- Cloud load/save ----------
    def on_cloud_load(self):
        try:
            # limpia eventos locales
            try:
                if self.es.store:
                    self.es.store.clear()
            except Exception:
                pass

            cloud = CloudClient(self._project_root())
            local = getattr(cloud, "local", None)  # LocalWorkspaceStore (AppData)

            # 1) Manifest → asegurar caché coherente por etag
            manifest = cloud.load_manifest() or {}
            comp_entries = manifest.get("component_ids", [])
            want_ids = [e["id"] if isinstance(e, dict) else e for e in comp_entries]
            want_etags = {e["id"]: e.get("etag") for e in comp_entries if isinstance(e, dict) and e.get("id")}

            cache = local.load_components_cache() if local else {}
            need_fetch: list[str] = []
            for cid in want_ids:
                cid = str(cid or "").strip()
                if not cid:
                    continue
                etag = want_etags.get(cid)
                if cid not in cache or (etag and (cache.get(cid, {}) or {}).get("etag") != etag):
                    need_fetch.append(cid)

            if need_fetch:
                fetched = cloud.fetch_components(need_fetch) or {}
                items_to_cache = []
                for cid, meta in fetched.items():
                    m = dict(meta or {})
                    name = m.get("kks_name") or m.get("title") or cid
                    m.setdefault("title", name)
                    m.setdefault("id", cid)
                    items_to_cache.append(m)

                if local and items_to_cache:
                    local.upsert_components_cache(items_to_cache)

            # 2) Snapshot → reconstrucción del grafo
            snap = cloud.load_snapshot() or {}
            g = ReliabilityGraph.from_data(snap)
            g.failures_cache = self._failures.local_repo

            # Completar unit_type desde cache local (AppData)
            try:
                cache = local.load_components_cache() if local else {}
                for nid, n in g.nodes.items():
                    if n.is_component() and not getattr(n, "unit_type", None):
                        ut = (cache.get(nid, {}) or {}).get("type")
                        if ut:
                            n.unit_type = ut
            except Exception:
                pass

            self.es.graph = g
            self._cloud_baseline = g.to_data()

            # 3) versionado base para eventos locales (undo/redo)
            try:
                head = len(cloud.load_events())
                if self.es.store:
                    self.es.store.base_version = head
            except Exception:
                pass

            self._render()
            messagebox.showinfo("Cloud Load", "Loaded snapshot and manifest into graph.")

        except Exception as e:
            messagebox.showerror("Cloud Load", str(e))


    def on_cloud_save(self):
        try:
            cloud = CloudClient(self._project_root())
            g = self.es.graph

            # 1) Evaluar para asegurar que 'reliability' y 'conflict' estén actualizados en el snapshot
            try:
                g.project_root = self._project_root()
                g.failures_cache = self._failures.local_repo
                self.es.evaluate()
            except Exception:
                pass
            snapshot = g.to_data()
            cloud.save_snapshot(snapshot)

            # 2) Subir eventos locales activos resecuenciados con el head global
            appended = 0
            try:
                if self.es.store:
                    head = len(cloud.load_events())         # largo actual del log global
                    self.es.store.resequence_versions(head) # sellar version correcta
                    local_events = [ev.to_dict() for ev in self.es.store.active()]  # SOLO activos
                    appended = cloud.append_events(local_events)
            except Exception:
                appended = 0

            # 3) Guardar manifest (puntero de commit)
            cache = self._local_cache().load_components_cache()
            comp_ids = sorted([nid for nid, n in g.nodes.items() if n.is_component()])
            comp_entries = []
            for cid in comp_ids:
                etag = (cache.get(cid) or {}).get('etag')
                comp_entries.append({'id': cid, 'etag': etag} if etag else {'id': cid})

            manifest = {
                'diagram_id': 'default',
                'version': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'component_ids': comp_entries,
            }
            cloud.save_manifest(manifest)
            self._cloud_baseline = snapshot

            # Mensaje de éxito
            messagebox.showinfo('Cloud Save', f'Snapshot y manifest guardados.\nEventos subidos: {appended}')

            # 4) Borrar eventos locales
            try:
                if self.es.store:
                    self.es.store.clear()
            except Exception:
                pass

            # 5) Borrar borrador local (snapshot + events draft)
            try:
                self._local_cache().draft_delete()
            except Exception:
                pass

        except Exception as e:
            messagebox.showerror('Cloud Save', str(e))

    # ---------- Failures ----------
    def on_reload_failures(self):
        if self.read_only:
            return
        try:
            # 1) IDs de componentes del grafo actual (estado local + cambios locales)
            g = self.es.graph
            comp_ids = sorted([nid for nid, n in g.nodes.items() if n.is_component()])
            if not comp_ids:
                messagebox.showinfo("Reload Failures", "El diagrama está vacío; no hay componentes que actualizar.")
                return

            # 2) Descargar/paginar desde cloud y refrescar cache de fallas
            cache = self._failures.reload_failures(comp_ids)

            # 3) Re-evaluar para reflejar flags de 'conflict' y porcentajes en UI
            try:
                g.project_root = self._project_root()
                g.failures_cache = self._failures.local_repo
                self.es.evaluate()
            except Exception:
                pass
            self._render()

            # 4) Reportar resultado (formato nuevo con last_update por componente)
            total_items = 0
            for v in cache.get("items", {}).values():
                if isinstance(v, dict):
                    total_items += len(v.get("rows", []))
                else:
                    try:
                        total_items += len(v)
                    except Exception:
                        pass
            # last_update ahora es por componente; mostramos rango simple
            last_upd = "-"
            messagebox.showinfo(
                "Reload Failures",
                f"Fallas recargadas para {len(comp_ids)} componente(s).\n"
                f"Total filas en caché: {total_items}\n"
                #f"Última actualización: {last_upd}"
            )
        except Exception as e:
            messagebox.showerror("Reload Failures", str(e))

    # ---------- Draft load/save/delete ----------
    def on_draft_save(self):
        if self.read_only:
            return
        try:
            cloud = self._cloud()
            local = self._local_cache()

            # Head global (para base_version)
            base_v = len(cloud.load_events())

            # Asegurar store local (EventStore ya decide LOCALAPPDATA internamente)
            if not self.es.store:
                self.es.set_store(EventStore(self._local_cache()))

            # Sellar versiones locales contra head global
            try:
                self.es.store.resequence_versions(base_v)
            except Exception:
                pass

            # Snapshot + eventos activos (dicts)
            snapshot = self.es.graph.to_data()
            events = []
            try:
                events = [ev.to_dict() for ev in (self.es.store.active() if self.es.store else [])]
            except Exception:
                events = []

            # Persistencia draft (AppData) vía local store
            local.draft_save(snapshot=snapshot, events=events, base_version=base_v)

            messagebox.showinfo("Draft Save", "Draft saved (diagram + local events).")
        except Exception as e:
            messagebox.showerror("Draft Save", str(e))


    def on_draft_load(self):
        if self.read_only:
            return
        try:
            cloud = self._cloud()
            local = self._local_cache()

            cloud_head = len(cloud.load_events())
            chk = local.draft_check(cloud_head)

            st = chk.get("status")
            if st == "missing":
                messagebox.showwarning("Draft Load", "No draft found.")
                return

            if st in ("conflict", "incomplete"):
                messagebox.showwarning(
                    "Draft conflict",
                    "El borrador local está basado en una versión antigua (o está incompleto).\n"
                    "Se borrará para evitar corrupción de versiones."
                )
                try:
                    local.draft_delete()
                except Exception:
                    pass
                return

            # ok / unknown (unknown: intentamos cargar igual, pero base_version puede faltar)
            snap_dict, ev_dicts, meta = local.draft_load()

            # 1) grafo
            self.es.graph = ReliabilityGraph.from_data(snap_dict or {})

            # 2) store local (EventStore decide LOCALAPPDATA)
            if not self.es.store:
                self.es.set_store(EventStore(self._local_cache()))

            evs = []
            try:
                for d in (ev_dicts or []):
                    try:
                        evs.append(event_from_dict(d))
                    except Exception:
                        pass
            except Exception:
                evs = []

            # 3) reemplazar eventos y setear base_version desde meta
            try:
                self.es.store.replace(evs)
            except Exception:
                try:
                    self.es.store.clear()
                    for ev in evs:
                        self.es.store.append(ev)
                except Exception:
                    pass

            try:
                bv = meta.get("base_version", None) if isinstance(meta, dict) else None
                if bv is not None and self.es.store:
                    self.es.store.base_version = int(bv)
            except Exception:
                pass

            self._render()
            messagebox.showinfo("Draft Load", "Draft loaded into local graph and events.")
        except Exception as e:
            messagebox.showerror("Draft Load", str(e))

    def on_draft_delete(self):
        if self.read_only:
            return
        try:
            local = self._local_cache()
            had_any = False
            try:
                had_any = bool(local.draft_exists_any())
            except Exception:
                had_any = True  # si no existe wrapper, igual intentamos borrar

            local.draft_delete()

            messagebox.showinfo("Draft Delete", "Draft deleted." if had_any else "No draft found.")
        except Exception as e:
            messagebox.showerror("Draft Delete", str(e))

    # ---------- RBD layout & drawing ----------
    def _measure_subtree(self, nid: str) -> Tuple[float, float]:
        """Return (width, height) for subtree rooted at nid, in RBD style."""
        g = self.es.graph
        node = g.nodes[nid]
        chs = g.children[nid]
        # Collapsed gate acts like a single block
        if (not node.is_component()) and (nid in self._collapsed):
            return (BLOCK_W, BLOCK_H)
        if node.is_component() or not chs:
            if self._show_icons:
                return (BLOCK_W, BLOCK_H + ICON_TOP_H)
            else:
                return (BLOCK_W, BLOCK_H)
        # Gate
        if node.subtype == "AND":  # series
            widths, heights = zip(*(self._measure_subtree(c) for c in chs))
            total_w = sum(widths) + SERIES_H_SPACING * (len(chs) - 1)
            total_h = max(max(heights), BLOCK_H)
            # add small top label height for the gate
            return (total_w, total_h + GROUP_LABEL_H)
        elif node.subtype == "OR":  # parallel
            sizes = [self._measure_subtree(c) for c in chs]
            max_child_w = max([w for (w, h) in sizes] + [BLOCK_W])
            rail_span_w = max(PAR_MIN_WIDTH, max_child_w + 2 * PAR_BUS_MARGIN)
            total_h = sum(h for (w, h) in sizes) + PAR_V_SPACING * (len(chs) - 1)
            # add top label height for the gate
            return (rail_span_w, total_h + GROUP_LABEL_H)
        elif node.subtype == "KOON":
            sizes = [self._measure_subtree(c) for c in chs]
            max_child_w = max([w for (w,h) in sizes] + [BLOCK_W])
            rail_span_w = max(PAR_MIN_WIDTH, max_child_w + 2*PAR_BUS_MARGIN)
            total_h = sum(h for (w,h) in sizes) + PAR_V_SPACING*(len(chs)-1)
            return (rail_span_w, total_h + GROUP_LABEL_H + KOON_TOP_MARGIN)
        else:
            # Unknown gate; fallback to component size
            return (BLOCK_W, BLOCK_H)
            

    def _draw_subtree(self, nid: str, x: float, y: float, fnt: tkfont.Font) -> Tuple[float, float]:
        """Draw subtree at top-left (x,y). Returns (width, height)."""
        g = self.es.graph
        node = g.nodes[nid]
        chs = g.children[nid]
        unit_type = getattr(node, "unit_type", None) or "generic"

        # Collapsed gate is drawn as a single grey block
        if (not node.is_component()) and (nid in self._collapsed):
            cx = x + BLOCK_W/2
            cy = y + BLOCK_H/2
            self.gates.draw_collapsed_gate(nid, cx, cy, fnt)
            return (BLOCK_W, BLOCK_H)

        if node.is_component() or not chs:
            if self._show_icons:
                w = BLOCK_W
                h = BLOCK_H + ICON_TOP_H
                cx = x + w / 2
                cy = y + h / 2
                self.components.draw_component(nid, unit_type, cx, cy, fnt, self._show_icons)
                return (w, h)
            else:
                cx = x + BLOCK_W / 2
                cy = y + BLOCK_H / 2
                self.components.draw_component(nid, unit_type, cx, cy, fnt, self._show_icons)
                return (BLOCK_W, BLOCK_H)

        if node.subtype == "AND":
            sizes = [self._measure_subtree(c) for c in chs]
            total_w = sum(w for (w, h) in sizes) + SERIES_H_SPACING * (len(chs) - 1)
            row_h = max(max(h for (w, h) in sizes), BLOCK_H)
            group_h = row_h + GROUP_LABEL_H

            # label
            self.gates.draw_label(nid, x, y, total_w, "AND", fnt)

            # dibuja AND delegando hijos y conectores
            def _draw_child(cid: str, left: float, top: float):
                self._draw_subtree(cid, left, top, fnt)

            self.gates.draw_and(
                nid=nid,
                x=x,
                y=y,
                sizes=sizes,
                children_ids=chs,
                row_h=row_h,
                total_w=total_w,
                h_spacing=SERIES_H_SPACING,
                fnt=fnt,
                draw_child_cb=_draw_child
            )

            if not self.read_only:
                self.canvas.tag_bind(f"node:{nid}", "<Button-3>", lambda e, nid=nid: self._open_edit_gate_dialog(nid))
                self.canvas.tag_bind(f"node:{nid}", "<Double-Button-1>", lambda e, nid=nid: self._toggle_collapse(nid))
            return (total_w, group_h)

        elif node.subtype == "OR":
            sizes = [self._measure_subtree(c) for c in chs]
            max_child_w = max([w for (w, h) in sizes] + [BLOCK_W])
            rail_span_w = max(PAR_MIN_WIDTH, max_child_w + 2 * PAR_BUS_MARGIN)
            total_h = sum(h for (w, h) in sizes) + PAR_V_SPACING * (len(chs) - 1)
            group_h = total_h + GROUP_LABEL_H + KOON_TOP_MARGIN  # mantenemos tu altura original

            # label
            self.gates.draw_label(nid, x, y, rail_span_w, "OR", fnt)

            def _draw_child(cid: str, left: float, top: float):
                self._draw_subtree(cid, left, top, fnt)

            self.gates.draw_or(
                nid=nid,
                x=x,
                y=y,
                rail_span_w=rail_span_w,
                total_h=total_h,
                sizes=sizes,
                children_ids=chs,
                v_spacing=PAR_V_SPACING,
                fnt=fnt,
                draw_child_cb=_draw_child
            )

            if not self.read_only:
                self.canvas.tag_bind(f"node:{nid}", "<Button-3>", lambda e, nid=nid: self._open_edit_gate_dialog(nid))
                self.canvas.tag_bind(f"node:{nid}", "<Double-Button-1>", lambda e, nid=nid: self._toggle_collapse(nid))
            return (rail_span_w, group_h)

        elif node.subtype == "KOON":
            sizes = [self._measure_subtree(c) for c in chs]
            max_child_w = max([w for (w,h) in sizes] + [BLOCK_W])
            rail_span_w = max(PAR_MIN_WIDTH, max_child_w + 2*PAR_BUS_MARGIN)
            total_h = sum(h for (w,h) in sizes) + PAR_V_SPACING*(len(chs)-1)
            group_h = total_h + GROUP_LABEL_H

            kval = self.es.graph.nodes[nid].k or 1

            def _draw_child(cid: str, left: float, top: float):
                self._draw_subtree(cid, left, top, fnt)

            self.gates.draw_koon(
                nid=nid,
                x=x,
                y=y,
                rail_span_w=rail_span_w,
                total_h=total_h,
                sizes=sizes,
                children_ids=chs,
                kval=kval,
                v_spacing=PAR_V_SPACING,  # ⬅️ ahora lo pasamos explícito
                fnt=fnt,
                draw_child_cb=_draw_child
            )
            return (rail_span_w, group_h)
        
        else:
            # Unknown gate; draw as component-like
            cx = x + BLOCK_W/2
            cy = y + BLOCK_H/2
            self.components.draw_component(nid, unit_type, cx, cy, fnt, self._show_icons)
            return (BLOCK_W, BLOCK_H)

    # ---------- Render ----------
    def _render(self):
        self.menu.cancel()
        self.menu.clear()
        self.canvas.delete("all")
        g = self.es.graph
        fnt = tkfont.Font(family="Segoe UI", size=10, weight="bold")
        # Drop collapsed ids that no longer exist
        try:
            self._collapsed &= set(g.nodes.keys())
        except Exception:
            pass

        if g.root is None:
            # limpiar posibles restos
            try:
                if self._empty_add_win is not None:
                    self.canvas.delete(self._empty_add_win)
                    self._empty_add_win = None
            except Exception:
                self._empty_add_win = None

            self.update_idletasks()
            W = max(self.canvas.winfo_width(), 800)
            H = max(self.canvas.winfo_height(), 400)
            self.canvas.create_text(W//2, H//2 - 30,
                                    text="(empty) Start by adding a Root component",
                                    fill="#888888", font=("Segoe UI", 14))

            # boton centrado (solo en modo editor)
            if not self.read_only:
                if self._empty_add_btn is None:
                    self._empty_add_btn = ttk.Button(self.canvas, text="Add Root", command=self.on_add_root)
                # crear ventana del botón y guardar id
                self._empty_add_win = self.canvas.create_window(
                    W//2, H//2 + 10, window=self._empty_add_btn
                )

            # ajustar scrollregion min
            try:
                self.canvas.configure(scrollregion=(0, 0, W, H))
            except Exception:
                pass
            return
        
        if self._empty_add_btn is not None or self._empty_add_win is not None:
            try:
                if self._empty_add_win is not None:
                    self.canvas.delete(self._empty_add_win)
            except Exception:
                pass
            try:
                if self._empty_add_btn is not None:
                    self._empty_add_btn.destroy()
            except Exception:
                pass
            self._empty_add_btn = None
            self._empty_add_win = None

        self.update_idletasks()
        W = max(self.canvas.winfo_width(), 800)
        H = max(self.canvas.winfo_height(), 400)
        total_w, total_h = self._measure_subtree(g.root)
        start_x = MARGIN_L
        start_y = max(MARGIN_T, (H - total_h) / 2.0)

        self._draw_subtree(g.root, start_x, start_y, fnt)

        self.canvas.addtag_all('world')

        # Aplica cámara SOLO a "world"
        self.camera.apply()

        # Status bar fija: actualizar texto (no está en canvas)
        try:
            rt = getattr(self.es.graph, "reliability_total", None)
            txt = f"Confiabilidad total: {rt*100:.1f}%" if rt is not None else "Confiabilidad total: —"
            self.status_label.config(text=txt)
        except Exception:
            pass

        # Scroll solo del mundo
        try:
            bbox = self.canvas.bbox('world') or self.canvas.bbox('all')
            if bbox:
                self.canvas.configure(scrollregion=bbox)
        except Exception:
            pass


    def _remove_node(self, nid: str):
        if self.read_only: 
            return
        if self._busy:
            return
        self._busy = True
        self.menu.cancel()
        self.menu.clear()
        try:
            if not messagebox.askyesno("Confirm", f"Remove node '{nid}'?"):
                return
            self.es.remove_node(nid)
            self.menu.clear()
            self._render()
        except Exception as e:
            messagebox.showerror("Error", str(e))
        finally:
            self._busy = False

    def _open_edit_dialog(self, node_id: str):
        if self.read_only:
            return
        node = self.es.graph.nodes.get(node_id)
        if node is None or not node.is_component():
            return

        dlg = tk.Toplevel(self); dlg.title(f"Edit Component: {node_id}"); dlg.transient(self); dlg.grab_set()
        frm = ttk.Frame(dlg, padding=10); frm.pack(fill=tk.BOTH, expand=True)
        row = 0

        ttk.Label(frm, text=f"Editing: {node_id}").grid(row=row, column=0, columnspan=3, sticky="w"); row += 1

        # === Buscar/seleccionar ID desde la nube (igual a _open_add_dialog) ===
        used_ids = set(self.es.graph.nodes.keys()) - {node_id}  # permitir conservar el mismo ID
        ttk.Label(frm, text="Search:").grid(row=row, column=0, sticky="e")
        q_var = tk.StringVar(value=node_id)  # prellenar con el ID actual
        ent_q = ttk.Entry(frm, textvariable=q_var, width=24); ent_q.grid(row=row, column=1, sticky="w")
        row += 1

        ttk.Label(frm, text="Select Component:").grid(row=row, column=0, sticky="e")
        sel_var = tk.StringVar(value=node_id)
        cbo = ttk.Combobox(frm, textvariable=sel_var, values=[node_id], state="readonly", width=24)
        cbo.grid(row=row, column=1, sticky="w")

        def refresh_values(items):
            ids = [it['id'] for it in items if it.get('id') not in used_ids]
            # si el ID actual no viene de la nube, lo dejamos visible para no bloquear
            if node_id not in ids:
                ids = [node_id] + ids
            cbo['values'] = ids
            if not sel_var.get() or sel_var.get() not in ids:
                sel_var.set(ids[0] if ids else node_id)

        def do_search():
            cloud = self._cloud()
            query = q_var.get().strip()
            items, total = cloud.search_components(query, page=1, page_size=20)

            # merge a caché
            self._local_cache().upsert_components_cache(items)
            refresh_values(items)

        btns_search = ttk.Frame(frm); btns_search.grid(row=row-1, column=2, padx=(6,0), sticky="w")
        ttk.Button(btns_search, text="Find", command=do_search).pack(side=tk.LEFT)
        row += 1

        # === Distribución (prellenar con la actual) ===
        cur_kind = node.dist.kind if node.dist else "exponential"
        dist_kind = tk.StringVar(value=cur_kind)
        ttk.Radiobutton(frm, text="Exponential", variable=dist_kind, value="exponential").grid(row=row, column=0, sticky="w")
        ttk.Radiobutton(frm, text="Weibull",     variable=dist_kind, value="weibull").grid(row=row, column=1, sticky="w")
        row += 1

        def submit():
            new_id = (sel_var.get() or node_id).strip()
            kind = dist_kind.get()
            try:
                if kind == "exponential":
                    dist = Dist("exponential")
                else:
                    dist = Dist("weibull")

                # aplica cambio de ID + dist
                self.es.edit_component(node_id, new_id, dist)

                # actualiza unit_type desde la caché (si está disponible)
                ut = ((self._local_cache().load_components_cache().get(new_id, {}) or {}).get("type") or "generic")


                try:
                    self.es.graph.nodes[new_id].unit_type = ut
                except Exception:
                    pass

            except Exception as e:
                messagebox.showerror("Error", str(e)); return

            self.menu.cancel()
            self.menu.clear()
            dlg.destroy()
            self._render()

        btns = ttk.Frame(frm); btns.grid(row=row, column=0, columnspan=3, pady=(10,0))
        ttk.Button(btns, text="Save", command=submit).pack(side=tk.LEFT, padx=6)
        ttk.Button(btns, text="Cancel", command=dlg.destroy).pack(side=tk.LEFT, padx=6)

    def _open_edit_gate_dialog(self, node_id: str):
        if self.read_only:
            return
        g = self.es.graph
        node = g.nodes.get(node_id)
        if node is None or not node.is_gate():
            return
        dlg = tk.Toplevel(self); dlg.title(f"Edit Gate: {node_id} <{node.subtype}>"); dlg.transient(self); dlg.grab_set()
        frm = ttk.Frame(dlg, padding=10); frm.pack(fill=tk.BOTH, expand=True)
        row = 0
        ttk.Label(frm, text=f"Gate: {node_id} <{node.subtype}>").grid(row=row, column=0, columnspan=2, sticky="w"); row+=1

        entries = {}
        # KOON supports 'k' in [1..n]
        if node.subtype == "KOON":
            n = len(g.children.get(node_id, []))
            cur_k = node.k if node.k is not None else 1
            ttk.Label(frm, text=f"n children: {n}").grid(row=row, column=0, columnspan=2, sticky="w"); row+=1
            ttk.Label(frm, text="k (1..n)").grid(row=row, column=0, sticky="e")
            ent_k = ttk.Entry(frm, width=20); ent_k.insert(0, str(cur_k))
            ent_k.grid(row=row, column=1, sticky="w"); row+=1
            entries['k'] = ent_k
        else:
            ttk.Label(frm, text="This gate has no editable parameters.").grid(row=row, column=0, columnspan=2, sticky="w"); row+=1

        def submit():
            params = {}
            try:
                if node.subtype == "KOON":
                    kval = int(entries['k'].get().strip())
                    n = len(g.children.get(node_id, []))
                    if n > 0 and (kval < 1 or kval > n):
                        messagebox.showerror("Error", f"k must be between 1 and {n}"); return
                    if n == 0 and kval < 1:
                        messagebox.showerror("Error", "k must be >= 1"); return
                    params['k'] = kval
                # future gate subtypes: add parsing here
                self.es.edit_gate(node_id, params)
            except Exception as e:
                messagebox.showerror("Error", str(e)); return
            self.menu.cancel()
            self.menu.clear()
            dlg.destroy()
            self._render()

        btns = ttk.Frame(frm); btns.grid(row=row, column=0, columnspan=2, pady=(10,0))
        ttk.Button(btns, text="Save", command=submit).pack(side=tk.LEFT, padx=6)
        ttk.Button(btns, text="Cancel", command=dlg.destroy).pack(side=tk.LEFT, padx=6)

    def _open_add_dialog(self, target_id: Optional[str], relation: Optional[str]):
        dlg = tk.Toplevel(self); dlg.title("Add Node"); dlg.transient(self); dlg.grab_set()
        frm = ttk.Frame(dlg, padding=10); frm.pack(fill=tk.BOTH, expand=True)
        row = 0
        if target_id and relation:
            ttk.Label(frm, text=f"Target: {target_id}  ({relation})").grid(row=row, column=0, columnspan=2, sticky="w"); row+=1
        else:
            ttk.Label(frm, text=f"Create ROOT component").grid(row=row, column=0, columnspan=2, sticky="w"); row+=1
        # Search/select component ID from cloud (on-demand)
        used_ids = set(self.es.graph.nodes.keys())
        ttk.Label(frm, text="Search:").grid(row=row, column=0, sticky="e")
        q_var = tk.StringVar(value="")
        ent_q = ttk.Entry(frm, textvariable=q_var, width=22); ent_q.grid(row=row, column=1, sticky="w"); row+=1
        ttk.Label(frm, text="Select Component:").grid(row=row, column=0, sticky="e")
        sel_var = tk.StringVar(value="")
        cbo = ttk.Combobox(frm, textvariable=sel_var, values=[], state="readonly", width=22)
        cbo.grid(row=row, column=1, sticky="w"); row+=1

        def refresh_values(items: List[Dict[str, object]]):
            ids = [it['id'] for it in items if it.get('id') not in used_ids]
            print(f"DEBUG refresh_values: {len(ids)} IDs disponibles para el combobox")
            cbo['values'] = ids
            if ids and (not sel_var.get() or sel_var.get() not in ids):
                sel_var.set(ids[0])

        def do_search():
            cloud = self._cloud()
            query = q_var.get().strip()
            
            items, total = cloud.search_components(query, page=1, page_size=20)
            
            # Merge into cache
            self._local_cache().upsert_components_cache(items)
            refresh_values(items)

        btns_search = ttk.Frame(frm); btns_search.grid(row=row-2, column=2, rowspan=2, padx=(6,0), sticky="w")
        ttk.Button(btns_search, text="Find", command=do_search).pack(side=tk.LEFT)
        dist_kind = tk.StringVar(value="exponential")
        ttk.Radiobutton(frm, text="Exponential", variable=dist_kind, value="exponential").grid(row=row, column=0, sticky="w")
        ttk.Radiobutton(frm, text="Weibull",     variable=dist_kind, value="weibull").grid(row=row, column=1, sticky="w"); row+=1
        ttk.Label(frm, text="k (KOON)").grid(row=row, column=0, sticky="e")
        ent_k = ttk.Entry(frm, width=20); ent_k.insert(0, "1"); ent_k.grid(row=row, column=1, sticky="w"); row+=1

        def submit():
            nid = sel_var.get().strip()
            if not nid:
                messagebox.showerror("Error", "ID is required"); return
            if nid in self.es.graph.nodes:
                messagebox.showerror("Error", f"ID '{nid}' already exists"); return

            cache = self._local_cache().load_components_cache()
            ut = ((cache.get(nid, {}) or {}).get("type") or "generic")

            kind = dist_kind.get()
            try:
                dist = Dist("exponential") if kind == "exponential" else Dist("weibull")

                if target_id and relation:
                    if relation == "series":
                        self.es.add_series(target_id, nid, dist, unit_type=ut)
                    elif relation == "parallel":
                        self.es.add_parallel(target_id, nid, dist, unit_type=ut)
                    elif relation == "koon":
                        # (tu lógica actual crea root; no toco más acá)
                        self.es.add_root_component(nid, dist, unit_type=ut)
                    else:
                        messagebox.showerror("Error", "not valid relation"); return
                else:
                    self.es.add_root_component(nid, dist, unit_type=ut)

            except Exception as e:
                messagebox.showerror("Error", str(e)); return

            self.menu.cancel()
            self.menu.clear()
            dlg.destroy()
            self._render()

        btns = ttk.Frame(frm); btns.grid(row=row, column=0, columnspan=2, pady=(10,0))
        ttk.Button(btns, text="Add", command=submit).pack(side=tk.LEFT, padx=6)
        ttk.Button(btns, text="Cancel", command=dlg.destroy).pack(side=tk.LEFT, padx=6)


    def _toggle_collapse(self, nid: str):
        # Toggle collapsed state for a gate; then re-render
        node = self.es.graph.nodes.get(nid)
        if node is None or node.is_component():
            return
        if nid in self._collapsed:
            self._collapsed.remove(nid)
        else:
            self._collapsed.add(nid)
        self.menu.clear()
        self._render()


    def _bootstrap_on_start(self):
        """
        Arranque:
        1) on_cloud_load() para tener baseline y base_version en store.
        2) Si existe draft:
            - si conflict/incomplete => warning + borrar draft
            - si ok => cargar draft (snapshot+events) y setear base_version
        """
        try:
            self.on_cloud_load()
        except Exception:
            pass

        try:
            cloud = self._cloud()
            local = self._local_cache()

            cloud_head = len(cloud.load_events())
            chk = local.draft_check(cloud_head)
            st = chk.get("status")

            if st == "missing":
                return

            if st in ("conflict", "incomplete"):
                messagebox.showwarning(
                    "Draft conflict",
                    "El borrador local está basado en una versión antigua (o está incompleto).\n"
                    "Se borrará para evitar corrupción de versiones."
                )
                try:
                    local.draft_delete()
                except Exception:
                    pass
                return

            # ok / unknown -> cargar
            snap_dict, ev_dicts, meta = local.draft_load()

            self.es.graph = ReliabilityGraph.from_data(snap_dict or {})

            if not self.es.store:
                self.es.set_store(EventStore(self._local_cache()))

            evs = []
            for d in (ev_dicts or []):
                try:
                    evs.append(event_from_dict(d))
                except Exception:
                    pass

            try:
                self.es.store.replace(evs)
            except Exception:
                try:
                    self.es.store.clear()
                    for ev in evs:
                        self.es.store.append(ev)
                except Exception:
                    pass

            try:
                bv = meta.get("base_version", None) if isinstance(meta, dict) else None
                if bv is not None:
                    self.es.store.base_version = int(bv)
            except Exception:
                pass

            self._render()

        except Exception:
            pass

    def _replay_local(self):
        """Reconstruye el grafo = baseline cloud + eventos locales activos."""
        if not hasattr(self, "_cloud_baseline") or self._cloud_baseline is None:
            # Si no hay baseline, no hay nada que re-jugar
            self._render()
            return

        # Eventos activos locales
        evs = self.es.store.active() if self.es.store else []

        # SnapshotEvent necesita kind y un ts string
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        snap_ev = SnapshotEvent(kind="snapshot", actor="gui", ts=ts, data=self._cloud_baseline)

        replay = [snap_ev] + evs
        g2 = self.es.rebuild(replay)
        self.es.graph = g2
        self._render()


    def on_undo(self, *_):
        if self.es.store and self.es.store.undo():
            self._replay_local()

    def on_redo(self, *_):
        if self.es.store and self.es.store.redo():
            self._replay_local()

    def on_version_control(self):
        VersionControlDialog.open(self)

    @classmethod
    def from_graph_readonly(
        cls,
        graph,
        title: str = "RBD Viewer",
        initial_zoom: float | None = None,
    ):
        es = GraphES(graph=graph, store=None, actor="viewer")
        app = cls(es, read_only=True, title=title)

        # Si nos pasaron un zoom inicial, lo aplicamos a la cámara
        if initial_zoom is not None:
            try:
                app.camera.s = initial_zoom
                app.camera.apply()
            except Exception:
                pass

        return app


def run_gui(es: GraphES):
    app = ReliabilityGUI(es)
    app.mainloop()


