import tkinter as tk

class CameraController:
    """
    Controla transformaciones de cámara (s, tx, ty) y eventos de zoom/paneo.
    Se integra con el owner (GUI) para re-render cuando el zoom cambia
    y aplica la transformación luego de dibujar.
    """
    def __init__(self, owner, canvas: tk.Canvas,
                 zoom_speed: float = 1.12,
                 min_zoom: float = 0.35,
                 max_zoom: float = 6.0,
                 pan_step: int = 60):
        self.owner = owner
        self.canvas = canvas
        self.s = 1.0
        self.tx = 0.0
        self.ty = 0.0
        self.zoom_speed = zoom_speed
        self.min_zoom = min_zoom
        self.max_zoom = max_zoom
        self.pan_step = pan_step
        # estado de arrastre
        self._dragging = False
        self._last = (0, 0)

    # ---- API principal ----
    def apply(self):
        """Aplica la transformada (s, tx, ty) a todo lo dibujado."""
        if abs(self.s - 1.0) > 1e-9:
            self.canvas.scale('world', 0, 0, self.s, self.s)
        if abs(self.tx) > 1e-9 or abs(self.ty) > 1e-9:
            self.canvas.move('world', self.tx, self.ty)

    def zoom_at(self, px: float, py: float, factor: float, re_render: bool = True):
        """Zoom en (px, py) respetando límites min/max."""
        new_s = max(self.min_zoom, min(self.max_zoom, self.s * factor))
        if new_s == self.s:
            return
        f = new_s / self.s
        self.s = new_s
        # mantener punto bajo el cursor
        self.tx = f * self.tx + (1 - f) * px
        self.ty = f * self.ty + (1 - f) * py
        if re_render:
            self.owner._render()

    def nudge(self, dx: float, dy: float):
        """Paneo instantáneo (teclas flechas o drag)."""
        self.canvas.move('world', dx, dy)
        self.tx += dx
        self.ty += dy

    # ---- Handlers de eventos (reemplazan a los del GUI) ----
    def on_zoom_event(self, event):
        # Windows/mac usa event.delta; Linux usa Button-4/5
        if hasattr(event, 'delta') and event.delta != 0:
            f = self.zoom_speed if event.delta > 0 else 1 / self.zoom_speed
        else:
            f = self.zoom_speed if getattr(event, 'num', 0) == 4 else 1 / self.zoom_speed
        self.zoom_at(event.x, event.y, f, re_render=True)

    def on_bg_press(self, event):
        # Respeta clicks sobre nodos/menús: no arrancar drag
        current = self.canvas.find_withtag('current')
        if current:
            tags = self.canvas.gettags(current[0])
            if any(t.startswith('node') or t.startswith('menu') for t in tags):
                self.canvas.focus_set()
                return
        if hasattr(self.owner, "_clear_menu"):
            self.owner._clear_menu()
        self._dragging = True
        self._last = (event.x, event.y)
        self.canvas.focus_set()

    def on_bg_drag(self, event):
        if not self._dragging:
            return
        lx, ly = self._last
        dx = event.x - lx
        dy = event.y - ly
        if dx or dy:
            self.nudge(dx, dy)
            self._last = (event.x, event.y)

    def on_bg_release(self, event):
        self._dragging = False