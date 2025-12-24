import tkinter as tk
from tkinter import ttk
from typing import Any, Dict
import json

class EventDetailsDialog(tk.Toplevel):
    """
    Muestra detalles de un evento:
    - Encabezado: version, kind, time, actor
    - Cuerpo: JSON bonito con los campos relevantes del evento
    """
    def __init__(self, owner, event: Any):
        super().__init__(owner)
        self.owner = owner
        self.event = event

        ver  = getattr(event, "version", None)
        kind = getattr(event, "kind", type(event).__name__)
        self.title(f"Event Details — #{ver if ver is not None else '?'} · {kind}")
        self.transient(owner)
        self.grab_set()
        self.geometry("720x520")
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.bind("<Escape>", lambda e: self._on_close())

        root = ttk.Frame(self, padding=12)
        root.pack(fill=tk.BOTH, expand=True)

        # Encabezado
        hdr = ttk.Frame(root)
        hdr.pack(fill=tk.X, pady=(0, 8))

        def add_row(r: int, k: str, v: str):
            ttk.Label(hdr, text=k + ":", width=10, anchor="e").grid(row=r, column=0, sticky="e", padx=(0,6))
            ttk.Label(hdr, text=v, anchor="w").grid(row=r, column=1, sticky="w")

        add_row(0, "Version", str(ver) if ver is not None else "—")
        add_row(1, "Kind",    str(kind))
        add_row(2, "Time",    str(getattr(event, "ts", "")))
        add_row(3, "Actor",   str(getattr(event, "actor", "")))

        # Área de detalles (JSON pretty)
        body = ttk.LabelFrame(root, text="Payload", padding=8)
        body.pack(fill=tk.BOTH, expand=True)

        txt = tk.Text(body, wrap="none", height=24)
        vsb = ttk.Scrollbar(body, orient="vertical", command=txt.yview)
        hsb = ttk.Scrollbar(body, orient="horizontal", command=txt.xview)
        txt.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        txt.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        body.rowconfigure(0, weight=1)
        body.columnconfigure(0, weight=1)

        payload = self._event_payload(event)
        pretty = json.dumps(payload, indent=2, ensure_ascii=False)
        txt.insert("1.0", pretty)
        txt.configure(state="disabled")  # solo lectura

        # Botonera
        btns = ttk.Frame(root)
        btns.pack(fill=tk.X, pady=(8,0))
        ttk.Button(btns, text="Close", command=self._on_close).pack(side=tk.RIGHT)

    def _event_payload(self, ev: Any) -> Dict[str, Any]:
        """
        Devuelve un dict con campos relevantes según el kind.
        Si algún campo no existe, simplemente no se incluye.
        """
        kind = getattr(ev, "kind", "")
        base = {
            "kind": kind,
            "version": getattr(ev, "version", None),
            "ts": getattr(ev, "ts", None),
            "actor": getattr(ev, "actor", None),
        }

        def maybe(k):  # helper para coger attrs si existen
            return getattr(ev, k, None)

        if kind == "snapshot":
            base["data"] = maybe("data")
        elif kind == "add_component_relative":
            base.update({
                "target_id": maybe("target_id"),
                "new_comp_id": maybe("new_comp_id"),
                "relation": maybe("relation"),
                "dist": maybe("dist"),
                "k": maybe("k"),
                "unit_type": maybe("unit_type"),
                "position_index": maybe("position_index"),
                "position_reference_id": maybe("position_reference_id"),
                "children_order": maybe("children_order"),
            })
        elif kind == "remove_node":
            base["node_id"] = maybe("node_id")
        elif kind == "add_root_component":
            base.update({
                "new_comp_id": maybe("new_comp_id"),
                "dist": maybe("dist"),
                "unit_type": maybe("unit_type"),
            })
        elif kind == "set_head":
            base["upto"] = maybe("upto")
        elif kind == "edit_component":
            base.update({
                "old_id": maybe("old_id"),
                "new_id": maybe("new_id"),
                "dist": maybe("dist"),
            })
        elif kind == "edit_gate":
            base.update({
                "node_id": maybe("node_id"),
                "params": maybe("params"),
            })
        else:
            # Fallback: volcar __dict__ completo
            try:
                base["raw"] = {k: v for k, v in vars(ev).items() if not k.startswith("_")}
            except Exception:
                pass
        return base

    def _on_close(self):
        self.grab_release()
        self.destroy()

    @classmethod
    def open(cls, owner, event: Any):
        dlg = cls(owner, event)
        owner.wait_window(dlg)
        return dlg