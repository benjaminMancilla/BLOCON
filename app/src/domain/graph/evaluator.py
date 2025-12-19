from datetime import datetime
from typing import TYPE_CHECKING, Dict, Optional
from .node import Node
from .dist import has_enough_records

if TYPE_CHECKING:
    from .graph import ReliabilityGraph

class ReliabilityEvaluator:
    """Separa la lógica de evaluación del grafo"""
    
    def __init__(self, graph: 'ReliabilityGraph'):
        self.graph = graph
        self.project_root: Optional[str] = None
    
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
            node.reliability = None
            if node.is_component():
                node.conflict = False
    
    def _eval_node(self, node_id: str, memo: Dict[str, float]) -> float:
        if node_id in memo:
            return memo[node_id]
        
        node = self.graph.nodes[node_id]
        
        if node.is_component():
            result = self._eval_component(node, node_id)
        else:
            result = self._eval_gate(node, node_id, memo)
        
        memo[node_id] = result
        node.reliability = result
        return result
    
    def _eval_component(self, node: Node, node_id: str) -> float:
        if node.dist is None:
            raise ValueError(f"Component '{node_id}' missing distribution")
        
        # Check records
        try:
            enough = has_enough_records(node_id, self.project_root)
            node.conflict = not enough
        except Exception:
            node.conflict = False
        
        return node.dist.reliability(node_id, datetime.today(), 
                                    project_root=self.project_root)
    
    def _eval_gate(self, node: Node, node_id: str, 
                   memo: Dict[str, float]) -> float:
        children = self.graph.children[node_id]
        
        if node.subtype == "AND":
            return self._eval_and_gate(children, memo)
        elif node.subtype == "OR":
            return self._eval_or_gate(children, memo)
        elif node.subtype == "KOON":
            return self._eval_koon_gate(node, children, memo)
        else:
            raise NotImplementedError(f"Gate subtype: {node.subtype}")
    
    def _eval_and_gate(self, children: list[str], memo: Dict[str, float]) -> float:
        """Evaluate AND gate (series): R = R1 * R2 * ... * Rn"""
        r = 1.0
        for child_id in children:
            r *= self._eval_node(child_id, memo)
        return r
    
    def _eval_or_gate(self, children: list[str], memo: Dict[str, float]) -> float:
        """Evaluate OR gate (parallel): R = 1 - (1-R1)*(1-R2)*...*(1-Rn)"""
        q = 1.0
        for child_id in children:
            r_child = self._eval_node(child_id, memo)
            q *= (1.0 - r_child)
        return 1.0 - q
    
    def _eval_koon_gate(self, node, children: list[str], memo: Dict[str, float]) -> float:
        """Evaluate k-out-of-n gate using Poisson-binomial distribution"""
        n = len(children)
        if n == 0:
            return 1.0
        
        k = node.k if (node.k is not None) else 1
        k = max(1, min(k, n))  # Clamp to valid range
        
        # Get child probabilities
        probs = [self._eval_node(ch, memo) for ch in children]
        
        # Dynamic programming for Poisson-binomial
        # dp[j] = P(exactly j successes)
        dp = [0.0] * (n + 1)
        dp[0] = 1.0
        
        for p in probs:
            for j in range(n, 0, -1):
                dp[j] = dp[j] * (1.0 - p) + dp[j - 1] * p
            dp[0] = dp[0] * (1.0 - p)
        
        # Sum P(≥k successes)
        return sum(dp[k:])