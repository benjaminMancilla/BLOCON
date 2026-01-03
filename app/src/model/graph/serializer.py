from typing import TYPE_CHECKING, Dict, Any
from .node import Node, ComponentNode, create_gate_node

if TYPE_CHECKING:
    from .graph import ReliabilityGraph

class GraphSerializer:
    """Maneja serialización/deserialización"""
    
    @staticmethod
    def to_data(graph: 'ReliabilityGraph') -> Dict[str, Any]:
        nodes = [GraphSerializer._serialize_node(nid, node) 
                 for nid, node in graph.nodes.items()]
        edges = [{"from": parent, "to": child} 
                 for parent, children in graph.children.items() 
                 for child in children]
        
        result = {
            "nodes": nodes,
            "edges": edges,
            "root": graph.root
        }
        
        if graph.reliability_total is not None:
            result["reliability_total"] = graph.reliability_total
        
        return result
    
    @staticmethod
    def _serialize_node(node_id: str, node: Node) -> Dict[str, Any]:
        data = node.to_dict()
        data["id"] = node_id
        return data
    
    @staticmethod
    def from_data(data: Dict[str, Any]) -> 'ReliabilityGraph':
        """Deserialize graph from dictionary"""
        from .graph import ReliabilityGraph
        from .dist import Dist
        
        g = ReliabilityGraph(auto_normalize=True)
        g.clear()
        
        # Load nodes
        for nd in data.get("nodes", []):
            if nd["type"] == "component":
                dist = nd.get("dist")
                d = None
                if dist:
                    d = Dist(kind=dist["kind"])
                
                node = ComponentNode(
                    id=nd["id"],
                    dist=d,
                    unit_type=nd.get("unit_type")
                )
                g.add_node(node)
                
                # Restore reliability if present
                if "reliability" in nd:
                    g.nodes[nd["id"]].reliability = nd["reliability"]
                
                # Restore conflict flag
                g.nodes[nd["id"]].conflict = bool(nd.get("conflict", False))
                
            elif nd["type"] == "gate":
                subtype = nd.get("subtype", "AND")
                gate_kwargs: Dict[str, Any] = {
                    "name": nd.get("name"),
                    "label": nd.get("label"),
                }
                if nd.get("guid"):
                    gate_kwargs["guid"] = nd.get("guid")
                if subtype == "KOON":
                    gate_kwargs["k"] = nd.get("k") or 1
                node = create_gate_node(subtype, nd["id"], **gate_kwargs)
                g.add_node(node)
                
                # Restore reliability if present
                if "reliability" in nd:
                    g.nodes[nd["id"]].reliability = nd["reliability"]
        
        # Load edges
        for e in data.get("edges", []):
            g.add_edge(e["from"], e["to"])
        
        # Restore root
        g.root = data.get("root", g.root)
        
        # Restore total reliability
        if "reliability_total" in data:
            g.reliability_total = data["reliability_total"]
        
        return g