from datetime import datetime
from typing import TYPE_CHECKING, Dict, Optional, Protocol, Any

if TYPE_CHECKING:
    from .graph import ReliabilityGraph
    from ..failure.ports import FailuresCachePort

class Clock(Protocol):
    def now(self) -> datetime:
        ...

class SystemClock:
    def now(self) -> datetime:
        return datetime.today()

class ReliabilityEvaluator:
    """Separa la lógica de evaluación del grafo"""
    
    def __init__(self, graph: 'ReliabilityGraph'):
        self.graph = graph
        self.project_root: Optional[str] = None
        self.failures_cache: Optional["FailuresCachePort"] = None
        self.clock: Clock = SystemClock()
    
    def set_project_root(self, root: Optional[str]):
        self.project_root = root
    
    def evaluate(self) -> float:
        """Evalúa confiabilidad sin mutar el grafo directamente"""
        self._clear_previous_results()
        
        if self.graph.root is None:
            return 1.0
        
        memo: Dict[str, float] = {}
        return self._eval_node(self.graph.root, memo)
    
    def _clear_previous_results(self):
        for node in self.graph.nodes.values():
            node.reset_evaluation()
    
    def _eval_node(self, node_id: str, memo: Dict[str, float]) -> float:
        if node_id in memo:
            return memo[node_id]
        
        node = self.graph.nodes[node_id]
        
        result = node.evaluate(self, node_id, memo)
        self._set_curve_params(node_id, node)
        
        memo[node_id] = result
        node.reliability = result
        return result
    
    def _set_curve_params(self, node_id: str, node: Any) -> None:
        if not getattr(node, "is_gate", None):
            return
        if not node.is_gate():
            return
        children = self.graph.children.get(node_id, [])
        child_params = {
            child_id: self.graph.nodes[child_id].curve_params
            for child_id in children
        }
        node.curve_params = {
            "subtype": getattr(node, "subtype", None),
            "children": child_params,
        }