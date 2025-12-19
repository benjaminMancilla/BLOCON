import os
import unicodedata
import tkinter as tk
from tkinter import ttk
from tkinter import font as tkfont

from ...model.graph.dist import Dist

try:
    from PIL import Image, ImageTk
    _PIL_OK = True
except Exception:
    _PIL_OK = False

# Constantes de dibujo
BLOCK_W = 190
BLOCK_H = 80
ICON_TOP_H = 68
ICON_BLOCK = 120
MIN_ICON_PX = 16
MAX_ICON_PX = 96
ICON_SIZE_FRAC = 0.5

# Padding interno para el texto (en coordenadas del canvas; se escalan por cámara)
PAD_X = 12
PAD_Y = 10

class ComponentRenderer:
    """
    Dibuja componentes (rectángulo + etiqueta) y, opcionalmente, el ícono.
    Mantiene un caché de imágenes re-muestreadas en función del zoom.
    """
    def __init__(self, owner, canvas: tk.Canvas, camera, menu, node_centers: dict):
        self.owner = owner
        self.canvas = canvas
        self.camera = camera
        self.menu = menu
        self.node_centers = node_centers
        # cachés
        self._icon_images = {}   # unit_type -> base image (PIL.Image or PhotoImage)
        self._icon_scaled = {}   # (unit_type, px) -> PhotoImage
        self._icons_dir = self._resolve_icons_dir()
        self._icon_index = None  # lazy map of loose_key -> actual filename

    # ----------------- kind -----------------
    def _kind_short(self, kind: str) -> str:
        k = (kind or "").lower().strip()
        if k.startswith("exp"):
            return "EXP"
        if k.startswith("wei"):
            return "WBL"
        return k[:3].upper() or "?"

    def _draw_kind_badge(self, kind: str, x: float, y: float, bg: str, fg: str):
        # tamaño según zoom
        s = getattr(self.camera, "s", 1.0)
        r = max(8, min(24, int(13 * s)))       # radio
        txt_sz = max(4, min(14, int(8 * s)))   # texto
        # círculo
        self.canvas.create_oval(
            x - r, y - r, x + r, y + r,
            fill=bg, outline="#0a5fb8", width=2,
            tags=("node_kind",)
        )
        # texto
        self.canvas.create_text(
            x, y,
            text=self._kind_short(kind),
            font=("Segoe UI", txt_sz, "bold"),
            fill=fg,
            tags=("node_kind",)
        )

    # ----------------- path helpers -----------------
    def _resolve_project_root(self) -> str:
        here = os.path.abspath(os.path.dirname(__file__))  # .../rbd/ui
        candidates = [
            os.path.dirname(os.path.dirname(here)),        # project root (expected)
            os.path.dirname(os.path.dirname(os.path.dirname(here))),  # backup
        ]
        for root in candidates:
            if os.path.isdir(os.path.join(root, "assets")):
                return root
        return candidates[0]

    def _resolve_icons_dir(self) -> str:
        root = self._resolve_project_root()
        return os.path.join(root, "assets", "icons")

    @staticmethod
    def _loose_key(name: str) -> str:
        s = (name or "").strip().lower()
        s = unicodedata.normalize("NFKD", s)
        s = "".join(ch for ch in s if not unicodedata.combining(ch))
        s = s.replace(".png", "")
        return s

    def _ensure_icon_index(self):
        if self._icon_index is not None:
            return
        self._icon_index = {}
        try:
            for fname in os.listdir(self._icons_dir):
                if not fname.lower().endswith(".png"):
                    continue
                base = os.path.splitext(fname)[0]
                key = self._loose_key(base)
                self._icon_index[key] = fname
        except Exception:
            self._icon_index = {}

    # ----------------- API pública -----------------
    def draw_component(self, nid: str, unit_type: str, cx: float, cy: float,
                       fnt: tkfont.Font, show_icons: bool):
        """
        Dibuja el componente centrado en (cx, cy).
        - Si show_icons: dibuja un cuadrado (ICON_BLOCK) + ícono + texto
        - Si no: rectángulo BLOCK_W x BLOCK_H + texto
        """
        if show_icons:
            total_h = BLOCK_H + ICON_TOP_H
            x0 = cx - BLOCK_W / 2
            y0 = cy - total_h / 2

            self.canvas.create_rectangle(
                x0, y0, x0 + BLOCK_W, y0 + total_h,
                fill="#e6e6e6", outline="#8a8a8a", width=2,
                tags=(f"node:{nid}", "node")
            )

            # Fuentes que escalan con el zoom (igual que en modo normal)
            s = getattr(self.camera, "s", 1.0)
            name_sz  = max(6, min(28, int(12 * s)))
            value_sz = max(8, min(28, int(14 * s)))
            f_name = tkfont.Font(family="Segoe UI", size=name_sz,  weight="bold")
            f_val  = tkfont.Font(family="Segoe UI", size=value_sz, weight="bold")

            # Icono centrado en la bandeja superior
            icon_cx = cx
            icon_cy = y0 + ICON_TOP_H * 0.50
            self._draw_icon(unit_type or "generic", icon_cx, icon_cy)

            # Área de texto (dos líneas) en la sección inferior (como el modo normal)
            name_y  = y0 + ICON_TOP_H + PAD_Y + (name_sz // 2) + 2
            value_y = y0 + ICON_TOP_H + BLOCK_H - PAD_Y - (value_sz // 2) - 2

            # Línea 1: nombre
            self.canvas.create_text(
                cx, name_y, text=nid, font=f_name, fill="#222222",
                tags=(f"node:{nid}", "node")
            )
            # Línea 2: valor (placeholder para porcentaje)
            self.canvas.create_text(
                cx, value_y, text="", font=f_val, fill="#222222",
                tags=(f"node:{nid}", "node", f"value:{nid}")
            )
            # Seteamos el texto si existe confiabilidad
            try:
                node = self.owner.es.graph.nodes.get(nid)
                r = getattr(node, "reliability", None)
                if r is not None:
                    self.canvas.itemconfigure(f"value:{nid}", text=f"{r*100:.1f}%")
                is_conflict = bool(getattr(node, "conflict", False))
                self.canvas.itemconfigure(
                    f"value:{nid}",
                    fill="#7b0303" if is_conflict else "#222222"
                )
            except Exception:
                pass

            # Badge de kind en esquina superior derecha del bloque total
            try:
                node = self.owner.es.graph.nodes.get(nid)
                kind = (getattr(node, "dist", None) or Dist("exponential")).kind
                x0 = cx - BLOCK_W/2
                y0 = cy - (BLOCK_H + ICON_TOP_H)/2
                self._draw_kind_badge(kind, x0 + BLOCK_W - 14, y0 + BLOCK_H - 18, bg="#ffffff", fg="#0a5fb8")
            except Exception:
                pass

        else:
            # bloque base
            x0 = cx - BLOCK_W/2
            y0 = cy - BLOCK_H/2
            self.canvas.create_rectangle(
                x0, y0, x0 + BLOCK_W, y0 + BLOCK_H,
                fill="#1e90ff", outline="#0a5fb8", width=2,
                tags=(f"node:{nid}", "node")
            )

            # fuente relativa al zoom (clamp para que no explote)
            s = getattr(self.camera, "s", 1.0)
            name_sz  = max(6, min(28, int(12 * s)))
            value_sz = max(8, min(28, int(14 * s)))
            f_name = tkfont.Font(family="Segoe UI", size=name_sz,  weight="bold")
            f_val  = tkfont.Font(family="Segoe UI", size=value_sz, weight="bold")

            # posiciones (dos líneas centradas con padding interno vertical)
            name_y  = y0 + PAD_Y + (name_sz // 2) + 2
            value_y = y0 + BLOCK_H - PAD_Y - (value_sz // 2) - 2

            # línea 1: nombre
            self.canvas.create_text(
                cx, name_y, text=nid, font=f_name, fill="white",
                tags=(f"node:{nid}", "node")
            )
            # línea 2: valor (reliability % — por ahora vacío)
            self.canvas.create_text(
                cx, value_y, text="", font=f_val, fill="#eef6ff",
                tags=(f"node:{nid}", "node", f"value:{nid}")
            )
            # Seteamos el texto si existe confiabilidad
            try:
                node = self.owner.es.graph.nodes.get(nid)
                r = getattr(node, "reliability", None)
                if r is not None:
                    self.canvas.itemconfigure(f"value:{nid}", text=f"{r*100:.1f}%")
                is_conflict = bool(getattr(node, "conflict", False))
                self.canvas.itemconfigure(
                    f"value:{nid}",
                    fill="#d34545" if is_conflict else "#eef6ff"
                )
            except Exception:
                pass

            # Badge de kind en esquina superior derecha del rectángulo
            try:
                node = self.owner.es.graph.nodes.get(nid)
                kind = (getattr(node, "dist", None) or Dist("exponential")).kind
                x0 = cx - BLOCK_W/2
                y0 = cy - BLOCK_H/2
                self._draw_kind_badge(kind, x0 + BLOCK_W - 14, y0 + BLOCK_H - 18, bg="#e6f1ff", fg="black")
            except Exception:
                pass

        # centro para menú hover y otros
        self.node_centers[nid] = (cx, cy)

        # hover menu
        self.canvas.tag_bind(f"node:{nid}", "<Enter>", lambda e, nid=nid: self.menu.on_node_enter(nid))
        self.canvas.tag_bind(f"node:{nid}", "<Leave>", self.menu.on_node_leave)
        # click derecho para editar
        self.canvas.tag_bind(f"node:{nid}", "<Button-3>", lambda e, nid=nid: self.owner._open_edit_dialog(nid))

    # ----------------- helpers internos -----------------
    def _draw_icon(self, unit_type: str, cx: float, cy: float):
        base = self._get_icon_base(unit_type)
        # tamaño destino en px (depende del zoom)
        target_px = int(ICON_BLOCK * ICON_SIZE_FRAC * getattr(self.camera, "s", 1.0))
        target_px = max(MIN_ICON_PX, min(MAX_ICON_PX, target_px))

        if base is None:
            # fallback geométrico
            r = max(6, target_px // 2)
            self.canvas.create_oval(
                cx - r, cy - r, cx + r, cy + r,
                fill="#777777", outline="#555555", width=1, tags=("node_icon",)
            )
            return

        if _PIL_OK and hasattr(base, "resize"):  # PIL.Image
            key = (unit_type, target_px)
            img_tk = self._icon_scaled.get(key)
            if img_tk is None:
                img_tk = ImageTk.PhotoImage(base.resize((target_px, target_px), Image.LANCZOS))
                self._icon_scaled[key] = img_tk
            self.canvas.create_image(cx, cy, image=img_tk, tags=("node_icon",))
        else:
            # sin PIL (PhotoImage): zoom/subsample entero
            bw = base.width()
            if target_px <= bw:
                k = max(1, round(bw / target_px))
                key = (unit_type, 'sub', k)
                img_scaled = self._icon_scaled.get(key)
                if img_scaled is None:
                    img_scaled = base.subsample(k, k)
                    self._icon_scaled[key] = img_scaled
            else:
                k = max(1, round(target_px / bw))
                key = (unit_type, 'zoom', k)
                img_scaled = self._icon_scaled.get(key)
                if img_scaled is None:
                    img_scaled = base.zoom(k, k)
                    self._icon_scaled[key] = img_scaled
            self.canvas.create_image(cx, cy, image=img_scaled, tags=("node_icon",))

    def _get_icon_base(self, unit_type: str):
        img = self._icon_images.get(unit_type)
        if img is not None:
            return img
        # intentar cargar desde assets/icons/<unit_type>.png con resolución robusta
        path = None
        direct = os.path.join(self._icons_dir, f"{unit_type}.png")
        if os.path.exists(direct):
            path = direct
        else:
            self._ensure_icon_index()
            key = self._loose_key(unit_type)
            alt = self._icon_index.get(key)
            if alt:
                path = os.path.join(self._icons_dir, alt)

        try:
            if path and _PIL_OK:
                img = Image.open(path).convert("RGBA")
            elif path:
                img = tk.PhotoImage(file=path)
            else:
                img = None
        except Exception:
            img = None
        self._icon_images[unit_type] = img
        return img
