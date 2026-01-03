
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, Optional, Literal, Any
from .dist import Dist, has_enough_records
from .guid import new_gate_guid

GateSubtype = Literal["AND", "OR", "KOON"]


@dataclass
class Node:
    id: str
    reliability: Optional[float] = None

    @property
    def type(self) -> str:
        return "component" if self.is_component() else "gate"

    def is_component(self) -> bool:
        return isinstance(self, ComponentNode)

    def is_gate(self) -> bool:
        return isinstance(self, GateNode)

    def reset_evaluation(self) -> None:
        self.reliability = None

    def to_dict(self) -> Dict[str, Any]:
        data = {"id": self.id, "type": self.type}
        if self.reliability is not None:
            data["reliability"] = self.reliability
        return data

    def evaluate(self, evaluator: Any, node_id: str, memo: Dict[str, float]) -> float:
        raise NotImplementedError

    def expression(self, child_exprs: list[str]) -> str:
        raise NotImplementedError
    
@dataclass
class ComponentNode(Node):
    dist: Optional[Dist] = None
    unit_type: Optional[str] = None
    conflict: bool = False

    def reset_evaluation(self) -> None:
        super().reset_evaluation()
        self.conflict = False

    def evaluate(self, evaluator: Any, node_id: str, memo: Dict[str, float]) -> float:
        if self.dist is None:
            raise ValueError(f"Component '{node_id}' missing distribution")

        try:
            enough = has_enough_records(node_id, evaluator.project_root, cache=evaluator.failures_cache)
            self.conflict = not enough
        except Exception:
            self.conflict = False

        return self.dist.reliability(
            node_id,
            evaluator.clock.now(),
            project_root=evaluator.project_root,
            cache=evaluator.failures_cache,
        )

    def expression(self, child_exprs: list[str]) -> str:
        return self.id

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data.update({
            "unit_type": self.unit_type,
            "dist": {"kind": self.dist.kind} if self.dist else None,
        })
        if self.conflict:
            data["conflict"] = True
        return data


@dataclass(kw_only=True)
class GateNode(Node):
    subtype: GateSubtype
    name: Optional[str] = None
    label: Optional[str] = None
    guid: str = field(default_factory=new_gate_guid)

    def __post_init__(self) -> None:
        if self.name is None:
            self.name = self.id
        if self.label is None:
            self.label = self.id

    def is_subtype(self, subtype: GateSubtype) -> bool:
        return self.subtype == subtype

    def update_params(self, params: Dict[str, Any], child_count: int) -> None:
        if "name" in params:
            self.name = str(params["name"])
        if "label" in params:
            self.label = str(params["label"])

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data.update({
            "subtype": self.subtype,
            "name": self.name,
            "label": self.label,
            "guid": self.guid,
        })
        return data


@dataclass
class AndGateNode(GateNode):
    subtype: Literal["AND"] = "AND"

    def evaluate(self, evaluator: Any, node_id: str, memo: Dict[str, float]) -> float:
        r = 1.0
        for child_id in evaluator.graph.children[node_id]:
            r *= evaluator._eval_node(child_id, memo)
        return r

    def expression(self, child_exprs: list[str]) -> str:
        return "(" + " & ".join(child_exprs) + ")"


@dataclass
class OrGateNode(GateNode):
    subtype: Literal["OR"] = "OR"

    def evaluate(self, evaluator: Any, node_id: str, memo: Dict[str, float]) -> float:
        q = 1.0
        for child_id in evaluator.graph.children[node_id]:
            r_child = evaluator._eval_node(child_id, memo)
            q *= (1.0 - r_child)
        return 1.0 - q

    def expression(self, child_exprs: list[str]) -> str:
        return "(" + " || ".join(child_exprs) + ")"


@dataclass
class KoonGateNode(GateNode):
    k: int = 1
    subtype: Literal["KOON"] = "KOON"

    def update_params(self, params: Dict[str, Any], child_count: int) -> None:
        super().update_params(params, child_count)
        if "k" in params:
            k_val = int(params["k"])
            if child_count <= 0:
                k_val = max(1, k_val)
            else:
                if k_val < 1 or k_val > child_count:
                    raise ValueError(f"k must be between 1 and {child_count}")
            self.k = k_val

    def evaluate(self, evaluator: Any, node_id: str, memo: Dict[str, float]) -> float:
        children = evaluator.graph.children[node_id]
        n = len(children)
        if n == 0:
            return 1.0

        k = max(1, min(self.k, n))

        probs = [evaluator._eval_node(ch, memo) for ch in children]

        dp = [0.0] * (n + 1)
        dp[0] = 1.0

        for p in probs:
            for j in range(n, 0, -1):
                dp[j] = dp[j] * (1.0 - p) + dp[j - 1] * p
            dp[0] = dp[0] * (1.0 - p)

        return sum(dp[k:])

    def expression(self, child_exprs: list[str]) -> str:
        n = len(child_exprs)
        parts = ", ".join(child_exprs)
        return f"KOON[{self.k}/{n}]({parts})"

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data["k"] = self.k
        return data


GATE_NODE_BY_SUBTYPE: Dict[GateSubtype, type[GateNode]] = {
    "AND": AndGateNode,
    "OR": OrGateNode,
    "KOON": KoonGateNode,
}


def create_gate_node(subtype: GateSubtype, node_id: str, **kwargs: Any) -> GateNode:
    gate_cls = GATE_NODE_BY_SUBTYPE.get(subtype)
    if not gate_cls:
        raise ValueError(f"Unknown gate subtype: {subtype}")
    return gate_cls(id=node_id, **kwargs)
