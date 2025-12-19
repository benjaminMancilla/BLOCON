
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Literal
from .dist import Dist

@dataclass
class Node:
    id: str
    type: Literal["component", "gate"]
    dist: Optional[Dist] = None
    subtype: Optional[Literal["AND", "OR", "KOON"]] = None
    k: Optional[int] = None
    unit_type: Optional[str] = None
    reliability: Optional[float] = None
    conflict: bool = False

    def is_component(self) -> bool:
        return self.type == "component"

    def is_gate(self) -> bool:
        return self.type == "gate"
