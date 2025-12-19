import tkinter as tk
from tkinter import ttk

class TopBar(ttk.Frame):
    def __init__(self, master, owner):
        # mantenemos el padding externo via pack en gui.py (evita doble espacio)
        super().__init__(master)
        self.owner = owner
        self._build()

    def _build(self):
        # Undo/Redo
        ttk.Button(self, text="Undo", command=self.owner.on_undo).pack(side=tk.LEFT, padx=4)
        ttk.Button(self, text="Redo", command=self.owner.on_redo).pack(side=tk.LEFT, padx=4)

        # Init graph
        style = ttk.Style(self)
        style.configure("Danger.TButton", foreground="#bb3333")
        style.map("Danger.TButton", foreground=[("active", "#aa2222")])
        ttk.Button(self, text="Reset", style="Danger.TButton",
                command=self.owner.on_reset).pack(side=tk.LEFT, padx=4)

        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # Version Control
        ttk.Button(self, text="Version Control", command=self.owner.on_version_control).pack(side=tk.LEFT, padx=4)
        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # Cloud
        ttk.Button(self, text="Cloud Load", command=self.owner.on_cloud_load).pack(side=tk.LEFT, padx=4)
        ttk.Button(self, text="Cloud Save", command=self.owner.on_cloud_save).pack(side=tk.LEFT, padx=4)
        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # Failures
        ttk.Button(self, text="Reload Failures", command=self.owner.on_reload_failures).pack(side=tk.LEFT, padx=4)
        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # Draft
        ttk.Button(self, text="Draft Load", command=self.owner.on_draft_load).pack(side=tk.LEFT, padx=4)
        ttk.Button(self, text="Draft Save", command=self.owner.on_draft_save).pack(side=tk.LEFT, padx=4)
        ttk.Button(self, text="Draft Delete", command=self.owner.on_draft_delete).pack(side=tk.LEFT, padx=4)
        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # Eval
        ttk.Button(self, text="Eval", command=self.owner.on_eval).pack(side=tk.LEFT, padx=4)
        ttk.Separator(self, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # Settings
        ttk.Button(self, text="Settings", command=self.owner.on_settings).pack(side=tk.LEFT, padx=4)