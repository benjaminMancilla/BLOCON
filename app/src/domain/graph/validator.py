from typing import Dict, Optional

class GraphValidator:
    """Centraliza todas las validaciones"""
    
    @staticmethod
    def validate_node_exists(nodes: Dict, node_id: str, operation: str):
        if node_id not in nodes:
            raise KeyError(f"{operation}: unknown node id '{node_id}'")
    
    @staticmethod
    def validate_new_node(nodes: Dict, node_id: str):
        if node_id in nodes:
            raise ValueError(f"Node '{node_id}' already exists")
    
    @staticmethod
    def validate_relation(relation: str):
        if relation not in ("series", "parallel", "koon"):
            raise ValueError(f"Invalid relation: {relation}")
    
    @staticmethod
    def validate_koon_k(k: Optional[int], n: int) -> int:
        if k is None:
            return 1
        if n <= 0:
            return max(1, k)
        if k < 1 or k > n:
            raise ValueError(f"k must be between 1 and {n}")
        return k