import tkinter as tk
from tkinter import ttk, messagebox
from typing import List, Optional, Any

from ...services.remote.client import CloudClient
from ...model.eventsourcing.events import event_from_dict, SnapshotEvent, SetIgnoreRangeEvent

from .event_details import EventDetailsDialog

class VersionControlDialog(tk.Toplevel):
    """
    Popup modal con la tabla de eventos (version, kind, time, actor).
    Por ahora, las acciones de menú contextual están en stub (sin implementación).
    """
    def __init__(self, owner, events: Optional[List[Any]] = None):
        super().__init__(owner)
        self.owner = owner
        self.title("Version Control")
        self.transient(owner)
        self.grab_set()
        self.geometry("720x420")
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.bind("<Escape>", lambda e: self._on_close())

        wrapper = ttk.Frame(self, padding=10)
        wrapper.pack(fill=tk.BOTH, expand=True)

        # Tabla con scroll
        cols = ("version", "kind", "time", "actor")
        self.tree = ttk.Treeview(wrapper, columns=cols, show="headings", height=14)
        vsb = ttk.Scrollbar(wrapper, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)

        for col, text, anchor, width in [
            ("version", "Version", "center", 90),
            ("kind",    "Kind",    "w",      150),
            ("time",    "Time",    "w",      220),
            ("actor",   "Actor",   "w",      140),
        ]:
            self.tree.heading(col, text=text)
            self.tree.column(col, width=width, anchor=anchor)

        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        wrapper.rowconfigure(0, weight=1)
        wrapper.columnconfigure(0, weight=1)

        # Menú contextual (stubs por ahora)
        self.menu = tk.Menu(self.tree, tearoff=0)
        self.menu.add_command(label="Details", command=self._on_details)
        self.menu.add_separator()
        self.menu.add_command(label="Show (read-only viewer)", command=self._on_show)
        self.menu.add_command(label="Rebuild here", command=self._on_rebuild)

        self.tree.bind("<Button-3>", self._on_right_click)

        # Botonera inferior
        btns = ttk.Frame(wrapper)
        btns.grid(row=1, column=0, sticky="e", pady=(8, 0))
        ttk.Button(btns, text="Close", command=self._on_close).pack(side=tk.RIGHT)

        # Poblar
        self._populate(events)

    def _safe_ver(self, e, idx: int) -> int:
        v = getattr(e, "version", None)
        return v if isinstance(v, int) else (idx + 1)

    def _selected_version(self) -> Optional[int]:
        sel = self.tree.selection()
        if not sel:
            return None
        vals = self.tree.item(sel[0], "values")
        try:
            return int(vals[0])  # columna "version"
        except Exception:
            return None

    def _events_upto_version(self, all_events: list[Any], v: int) -> list[Any]:
        evs_upto = []
        for idx, e in enumerate(all_events):
            ver = self._safe_ver(e, idx)
            if ver <= v:
                evs_upto.append(e)
        return evs_upto

    def _populate(self, events: Optional[List[Any]]) -> None:
        try:
            cloud = CloudClient(self.owner._project_root())
            raw = cloud.load_events()
            self._events = [event_from_dict(d) for d in raw]
        except Exception as e:
            self._events = []
            messagebox.showerror("Version Control", str(e))

        for iid in self.tree.get_children():
            self.tree.delete(iid)

        for idx, ev in enumerate(self._events):
            ver = getattr(ev, "version", None)
            ver_show = ver if isinstance(ver, int) else (idx + 1)
            kind = getattr(ev, "kind", type(ev).__name__)
            ts   = getattr(ev, "ts", "")
            who  = getattr(ev, "actor", "")
            self.tree.insert("", "end", values=(ver_show, kind, ts, who))

    def _on_right_click(self, event) -> None:
        try:
            iid = self.tree.identify_row(event.y)
            if iid:
                self.tree.selection_set(iid)
                self.menu.tk_popup(event.x_root, event.y_root)
        finally:
            self.menu.grab_release()

    # ---- actions ----
    def _on_details(self):
        sel = self.tree.selection()
        if not sel:
            return
        iid = sel[0]
        idx = self.tree.index(iid)
        if 0 <= idx < len(getattr(self, "_events", [])):
            ev = self._events[idx]
            EventDetailsDialog.open(self, ev)

    def _on_show(self):
        v = self._selected_version()
        if v is None:
            return
        try:
            evs_upto = self._events_upto_version(self._events, v)
            g = self.owner.es.rebuild(evs_upto)

            from ..gui import ReliabilityGUI

            # Intentamos leer el zoom actual del editor principal
            initial_zoom = getattr(self.owner, "camera", None)
            initial_zoom = getattr(initial_zoom, "s", None)

            ReliabilityGUI.from_graph_readonly(
                g,
                title=f"RBD Viewer — v{v}",
                initial_zoom=initial_zoom,
            )
            ReliabilityGUI.from_graph_readonly(g, title=f"RBD Viewer — v{v}")
        except Exception as e:
            messagebox.showerror("Show", str(e))

    def _on_rebuild(self):
        v = self._selected_version()
        if v is None:
            return

        # Doble confirmaciOn
        msg = (
            "Vas a reconstruir la versión oficial del diagrama a una versión pasada.\n\n"
            f"Versión seleccionada: v{v}\n\n"
            "Se recomienda primero usar 'Show' para verificar.\n\n"
            "¿Deseas continuar?"
        )
        if not messagebox.askyesno("Rebuild — Confirmación", msg):
            return

        try:
            cloud = CloudClient(self.owner._project_root())
            raw = cloud.load_events()
            evs_all = [event_from_dict(d) for d in raw]

            evs_upto = self._events_upto_version(evs_all, v)
            g = self.owner.es.rebuild(evs_upto)

            snap_ev = SnapshotEvent.create(data=g.to_data(), actor="version-control")

            head_prev = len(evs_all)

            snap_d = snap_ev.to_dict()
            snap_d["version"] = head_prev + 1

            to_append = [snap_d]

            if v < head_prev:
                ignore_ev = SetIgnoreRangeEvent.create(start_v=v+1, end_v=head_prev, actor="version-control")
                ignore_d = ignore_ev.to_dict()
                ignore_d["version"] = head_prev + 2
                to_append.append(ignore_d)

            cloud.append_events(to_append)

            try:
                cloud.save_snapshot(g.to_data())
            except Exception:
                pass

            try:
                # borrar draft
                if hasattr(self.owner, "on_draft_delete"):
                    self.owner.on_draft_delete()
            except Exception:
                pass

            try:
                # limpiar eventos locales
                if getattr(self.owner.es, "store", None):
                    self.owner.es.store.clear()
            except Exception:
                pass

            # Recargar nube
            self.owner.on_cloud_load()

            self._populate(None)
            messagebox.showinfo("Rebuild", f"Se reconstruyó y publicó v{v} como nueva base (snapshot).\n"
                                        f"Ignorado el rango de versiones futuras {'(ninguno)' if v>=head_prev else f'{v+1}..{head_prev}'}.")

        except Exception as e:
            messagebox.showerror("Rebuild", str(e))

    # ----------------------------------------
    def _on_close(self) -> None:
        self.grab_release()
        self.destroy()

    @classmethod
    def open(cls, owner, events: Optional[List[Any]] = None):
        dlg = cls(owner, events)
        owner.wait_window(dlg)
        return dlg