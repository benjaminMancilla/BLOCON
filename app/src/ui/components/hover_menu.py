import tkinter as tk

class HoverMenu:
    """
    Menú flotante sobre nodos del canvas. Se apoya en callbacks del owner.
    """
    def __init__(self, owner, canvas: tk.Canvas, anchor_getter, delay_ms: int = 220):
        self.owner = owner
        self.canvas = canvas
        self.anchor_getter = anchor_getter
        self.delay_ms = delay_ms
        self._menu_for = None
        self._items = []
        self._hover_on_node = False
        self._hover_on_menu = False
        self._hide_after = None

    # ---- API pública ----
    def clear(self):
        for it in self._items:
            try: self.canvas.delete(it)
            except: pass
        self._items = []
        self._menu_for = None

    def cancel(self):
        if self._hide_after is not None:
            try: self.canvas.after_cancel(self._hide_after)
            except: pass
        self._hide_after = None

    def schedule_hide(self):
        self.cancel()
        def _hide():
            if not self._hover_on_node and not self._hover_on_menu:
                self.clear()
        self._hide_after = self.canvas.after(self.delay_ms, _hide)

    def on_node_enter(self, nid: str):
        self._hover_on_node = True
        self.cancel()
        anchor = self.anchor_getter(nid)
        self.show(nid, anchor)

    def on_node_leave(self, event=None):
        self._hover_on_node = False
        self.schedule_hide()

    def on_menu_enter(self, event=None):
        self._hover_on_menu = True
        self.cancel()

    def on_menu_leave(self, event=None):
        self._hover_on_menu = False
        self.schedule_hide()

    def show(self, nid: str, anchor):
        if self._menu_for == nid and self._items:
            return
        self.clear()
        x, y = anchor
        w, h = 160, 106
        x0, y0 = x + 60, y - h/2
        items = []
        # fondo
        items.append(self.canvas.create_rectangle(
            x0, y0, x0+w, y0+h, fill="#f0f6ff", outline="#0a5fb8", width=2,
            tags=("menu", f"menu:{nid}")
        ))

        def add_button(text, yoff, cb):
            tid = self.canvas.create_text(
                x0+w/2, y0+yoff, text=text, fill="#0a5fb8",
                font=("Segoe UI", 10, "bold"), tags=("menu", f"menu:{nid}")
            )
            hb = self.canvas.create_rectangle(
                x0+5, y0+yoff-12, x0+w-5, y0+yoff+12,
                outline="", fill="", tags=("menu", f"menu:{nid}")
            )
            self.canvas.tag_bind(hb, "<Button-1>", lambda e: cb())
            self.canvas.tag_bind(tid, "<Button-1>", lambda e: cb())
            items.extend([tid, hb])

        add_button("+ Add SERIES",   24, lambda: self.owner._open_add_dialog(target_id=nid, relation="series"))
        add_button("+ Add PARALLEL", 44, lambda: self.owner._open_add_dialog(target_id=nid, relation="parallel"))
        add_button("+ Add KOON",     64, lambda: self.owner._open_add_dialog(target_id=nid, relation="koon"))
        add_button("- Remove",       86, lambda: self.owner._remove_node(nid))

        for it in items:
            self.canvas.tag_bind(it, "<Enter>", self.on_menu_enter)
            self.canvas.tag_bind(it, "<Leave>", self.on_menu_leave)

        self._menu_for = nid
        self._items = items

    @staticmethod
    def default_anchor(canvas: tk.Canvas, nid: str, centers: dict=None):
        centers = centers or {}
        bbox = None
        try:
            bbox = canvas.bbox(f"node:{nid}")
            if bbox:
                x0, y0, x1, y1 = bbox
                return ((x0+x1)/2, (y0+y1)/2)
        except Exception:
            pass
        return centers.get(nid, (0.0, 0.0))
    
class NullHoverMenu:
    """
    Menú 'vacío' para modo read-only.
    Expone la misma API pública que HoverMenu pero todo es no-op.
    """
    def __init__(self, owner, canvas: tk.Canvas, anchor_getter=None, delay_ms: int = 220):
        self.owner = owner
        self.canvas = canvas
        self.anchor_getter = anchor_getter
        self.delay_ms = delay_ms
        self._hide_after = None

    # ---- API pública compatible ----
    def clear(self):
        pass

    def cancel(self):
        if self._hide_after is not None:
            try:
                self.canvas.after_cancel(self._hide_after)
            except Exception:
                pass
        self._hide_after = None

    def schedule_hide(self):
        # Mantenemos semántica, pero no hay nada que ocultar
        self.cancel()
        def _hide():
            # no-op
            pass
        self._hide_after = self.canvas.after(self.delay_ms, _hide)

    def on_node_enter(self, nid: str):
        # no dibuja nada
        self.cancel()

    def on_node_leave(self, event=None):
        self.schedule_hide()

    def on_menu_enter(self, event=None):
        self.cancel()

    def on_menu_leave(self, event=None):
        self.schedule_hide()

    def show(self, nid: str, anchor):
        # no dibuja nada
        return

    @staticmethod
    def default_anchor(canvas: tk.Canvas, nid: str, centers: dict=None):
        centers = centers or {}
        bbox = None
        try:
            bbox = canvas.bbox(f"node:{nid}")
            if bbox:
                x0, y0, x1, y1 = bbox
                return ((x0+x1)/2, (y0+y1)/2)
        except Exception:
            pass
        return centers.get(nid, (0.0, 0.0))