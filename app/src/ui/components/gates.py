import tkinter as tk
from tkinter import font as tkfont

# Copiamos constantes mínimas para evitar dependencias circulares
BLOCK_W = 190
BLOCK_H = 80
GROUP_LABEL_H = 22
KOON_BADGE_RADIUS = 28
KOON_TOP_MARGIN = 18
OR_TOP_MARGIN   = 12
OR_LABEL_GAP = 10



class GateRenderer:
    """
    Dibuja piezas de UI de compuertas: label superior, bloque "collapsed"
    y KOON (badge + rieles + conectores). Reenvía callbacks al owner (GUI).
    """
    def __init__(self, owner, canvas: tk.Canvas, menu, node_centers: dict):
        self.owner = owner
        self.canvas = canvas
        self.menu = menu
        self.node_centers = node_centers

    def draw_collapsed_gate(self, nid: str, cx: float, cy: float, fnt: tkfont.Font):
        x0 = cx - BLOCK_W/2
        y0 = cy - BLOCK_H/2
        s = getattr(getattr(self.owner, "camera", None), "s", 1.0)

        # fuentes similares a componentes (dos líneas)
        name_sz  = max(6, min(28, int(12 * s)))
        value_sz = max(8, min(22, int(10 * s)))
        f_name = tkfont.Font(family="Segoe UI", size=name_sz,  weight="bold")
        f_val  = tkfont.Font(family="Segoe UI", size=value_sz)

        # rectángulo (mismos colores)
        self.canvas.create_rectangle(
            x0, y0, x0+BLOCK_W, y0+BLOCK_H,
            fill="#d0d0d0", outline="#8a8a8a", width=2,
            tags=(f"node:{nid}", "node")
        )

        # posiciones (dos líneas)
        PAD_Y = 10
        name_y  = y0 + PAD_Y + (name_sz // 2) + 2
        value_y = y0 + BLOCK_H - PAD_Y - (value_sz // 2) - 2

        # línea 1: nombre (igual que antes, pero arriba)
        self.canvas.create_text(
            cx, name_y, text=nid, font=f_name, fill="#222222",
            tags=(f"node:{nid}", "node")
        )

        # línea 2: porcentaje (solo si existe)
        try:
            node = self.owner.es.graph.nodes.get(nid)
            r = getattr(node, "reliability", None)
            pct = f"{r*100:.1f}%" if r is not None else ""
        except Exception:
            pct = ""

        self.canvas.create_text(
            cx, value_y, text=pct, font=f_val, fill="#222222",
            tags=(f"node:{nid}", "node", f"value:{nid}")
        )

        # bindings (igual que antes)
        self.node_centers[nid] = (cx, cy)
        self.canvas.tag_bind(f"node:{nid}", "<Enter>", lambda e, nid=nid: self.menu.on_node_enter(nid))
        self.canvas.tag_bind(f"node:{nid}", "<Leave>", self.menu.on_node_leave)
        self.canvas.tag_bind(f"node:{nid}", "<Double-Button-1>", lambda e, nid=nid: self.owner._toggle_collapse(nid))
        self.canvas.tag_bind(f"node:{nid}", "<Button-3>", lambda e, nid=nid: self.owner._open_edit_gate_dialog(nid))

    def draw_label(self, nid: str, x: float, y: float, width: float, subtype: str, fnt: tkfont.Font):
        # recalcular fuente según zoom de la cámara
        s = getattr(getattr(self.owner, "camera", None), "s", 1.0)
        gate_sz = max(6, min(24, int(11 * s)))
        f_gate = tkfont.Font(family="Segoe UI", size=gate_sz, weight="bold")

        label_w = max(60, min(140, width * 0.6))
        label_h = GROUP_LABEL_H
        cx = x + width/2
        cy = y + label_h/2
        x0 = cx - label_w/2
        y0 = cy - label_h/2
        rect_id = self.canvas.create_rectangle(
            x0, y0, x0+label_w, y0+label_h,
            fill="#1e90ff", outline="#0a5fb8", width=2,
            tags=(f"node:{nid}", "node")
        )
        text_id = self.canvas.create_text(
            cx, cy, text=f"{nid} <{subtype}>", font=f_gate, fill="white",
            tags=(f"node:{nid}", "node")
        )
        # Centro de referencia para hover
        self.node_centers[nid] = (cx, cy)
        # Asegurar bindings de hover en todas las compuertas (AND/OR)
        self.canvas.tag_bind(f"node:{nid}", "<Enter>", lambda e, nid=nid: self.menu.on_node_enter(nid))
        self.canvas.tag_bind(f"node:{nid}", "<Leave>", self.menu.on_node_leave)

    def draw_and(self,
                nid: str,
                x: float,
                y: float,
                sizes: list[tuple[float, float]],
                children_ids: list[str],
                row_h: float,
                total_w: float,
                h_spacing: float,
                fnt: tkfont.Font,
                draw_child_cb):
        """
        Dibuja AND: label arriba (llamar antes a draw_label),
        los hijos en fila y conectores con flecha entre i -> i+1.
        """
        # colocar hijos en fila
        cur_x = x
        centers = []
        for cid, (cw, ch) in zip(children_ids, sizes):
            left = cur_x
            top = y + GROUP_LABEL_H + (row_h - ch) / 2
            draw_child_cb(cid, left, top)
            cx = left + cw/2
            cy = y + GROUP_LABEL_H + row_h/2
            centers.append((cx, cy, cw, ch))
            cur_x += cw + h_spacing

        # conectores en serie (flechas)
        for i in range(len(centers) - 1):
            cx1, cy1, cw1, ch1 = centers[i]
            cx2, cy2, cw2, ch2 = centers[i + 1]
            x1 = cx1 + cw1/2
            x2 = cx2 - cw2/2
            self.canvas.create_line(x1, cy1, x2, cy2, arrow=tk.LAST, width=1.5, fill="#333333")

    def draw_or(self,
                nid: str,
                x: float,
                y: float,
                rail_span_w: float,
                total_h: float,
                sizes: list[tuple[float, float]],
                children_ids: list[str],
                v_spacing: float,
                fnt: tkfont.Font,
                draw_child_cb):
        """
        Dibuja OR: label arriba (llamar antes a draw_label),
        rieles verticales y ramas con conectores.
        """
        # rieles
        xL = x
        xR = x + rail_span_w
        y_top = y + GROUP_LABEL_H + OR_TOP_MARGIN
        y_bot = y_top + total_h
        self.canvas.create_line(xL, y_top, xL, y_bot, width=2, fill="#333333")
        self.canvas.create_line(xR, y_top, xR, y_bot, width=2, fill="#333333")

        # ramas
        cur_y = y_top
        for cid, (cw, ch) in zip(children_ids, sizes):
            left = x + (rail_span_w - cw) / 2
            draw_child_cb(cid, left, cur_y)
            cy_m = cur_y + ch/2
            self.canvas.create_line(xL, cy_m, left,     cy_m, width=1.5, fill="#333333")
            self.canvas.create_line(left+cw, cy_m, xR,  cy_m, width=1.5, fill="#333333")
            cur_y += ch + v_spacing

    def draw_koon(self,
                nid: str,
                x: float,
                y: float,
                rail_span_w: float,
                total_h: float,
                sizes: list[tuple[float, float]],
                children_ids: list[str],
                kval: int,
                v_spacing: float,
                fnt: tkfont.Font,
                draw_child_cb):
        """
        Dibuja KOON: badge con k/n, rieles verticales y conectores de cada rama.
        """
        # Badge (círculo)
        n_children = len(children_ids)
        cx = x + rail_span_w/2
        cy = y + GROUP_LABEL_H/2
        r = KOON_BADGE_RADIUS
        self.canvas.create_oval(cx-r, cy-r, cx+r, cy+r, fill="#1e90ff", outline="#0a5fb8",
                                width=2, tags=(f"node:{nid}","node"))
        self.canvas.create_text(cx, cy, text=f"{kval}/{n_children}", fill="white",
                                font=fnt, tags=(f"node:{nid}","node"))
        self.node_centers[nid] = (cx, cy)
        self.canvas.tag_bind(f"node:{nid}", "<Enter>", lambda e, nid=nid: self.menu.on_node_enter(nid))
        self.canvas.tag_bind(f"node:{nid}", "<Leave>", self.menu.on_node_leave)
        self.canvas.tag_bind(f"node:{nid}", "<Double-Button-1>", lambda e, nid=nid: self.owner._toggle_collapse(nid))
        self.canvas.tag_bind(f"node:{nid}", "<Button-3>", lambda e, nid=nid: self.owner._open_edit_gate_dialog(nid))

        # Rieles
        xL = x
        xR = x + rail_span_w
        y_top = y + GROUP_LABEL_H + KOON_TOP_MARGIN
        y_bot = y_top + total_h
        self.canvas.create_line(xL, y_top, xL, y_bot, width=2, fill="#333333")
        self.canvas.create_line(xR, y_top, xR, y_bot, width=2, fill="#333333")

        # Ramas
        cur_y = y_top
        for cid, (cw, ch) in zip(children_ids, sizes):
            left = x + (rail_span_w - cw) / 2
            draw_child_cb(cid, left, cur_y)
            cy_m = cur_y + ch/2
            self.canvas.create_line(xL, cy_m, left,     cy_m, width=1.5, fill="#333333")
            self.canvas.create_line(left+cw, cy_m, xR,  cy_m, width=1.5, fill="#333333")
            cur_y += ch + v_spacing
