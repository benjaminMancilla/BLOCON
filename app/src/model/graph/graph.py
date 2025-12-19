from __future__ import annotations
from typing import Dict, List, Optional, Literal, Any
from .node import Node
from .dist import Dist
from .evaluator import ReliabilityEvaluator
from .serializer import GraphSerializer
from .validator import GraphValidator
from ..failure.ports import FailuresCachePort

GateType = Literal["AND", "OR", "KOON"]
RelType = Literal["series", "parallel", "koon"]


class ReliabilityGraph:
    """
    Reliability Block Diagram graph structure.
    
    Manages nodes (components and gates) and their relationships to model
    system reliability. Supports series, parallel, and k-out-of-n configurations.
    """
    
    def __init__(self, auto_normalize: bool = False) -> None:
        # Core graph structure
        self.nodes: Dict[str, Node] = {}
        self.children: Dict[str, List[str]] = {}
        self.parent: Dict[str, Optional[str]] = {}
        self.root: Optional[str] = None
        self._gate_auto_counter = 1
        self.reliability_total: Optional[float] = None
        self.auto_normalize: bool = auto_normalize
        
        # Dependency injection for separated concerns
        self._evaluator = ReliabilityEvaluator(self)
        self._validator = GraphValidator()
        self._serializer = GraphSerializer()
        
        # Backward compatibility: allow external code to set project_root
        self.project_root: Optional[str] = None

        self.failures_cache: Optional[FailuresCachePort] = None

    # PUBLIC API - Core graph operations

    def clear(self) -> None:
        """Clear all nodes, edges, and reset the graph"""
        self.nodes.clear()
        self.children.clear()
        self.parent.clear()
        self.root = None
        self._gate_auto_counter = 1
        self.reliability_total = None

    def add_node(self, node: Node) -> None:
        """
        Add a node to the graph.
        
        Args:
            node: Node to add (component or gate)
            
        Raises:
            ValueError: If node with same ID already exists
        """
        self._validator.validate_new_node(self.nodes, node.id)
        
        self.nodes[node.id] = node
        self.children[node.id] = []
        self.parent[node.id] = None
        
        # First node becomes root
        if self.root is None:
            self.root = node.id
    
    def add_edge(self, src: str, dst: str) -> None:
        """
        Add an edge from source to destination node.
        
        Args:
            src: Source node ID
            dst: Destination node ID
            
        Raises:
            KeyError: If either node doesn't exist
            ValueError: If destination already has a parent
        """
        self._validator.validate_node_exists(self.nodes, src, "add_edge")
        self._validator.validate_node_exists(self.nodes, dst, "add_edge")
        
        if self.parent[dst] is not None:
            raise ValueError(f"Node '{dst}' already has a parent")
        
        self.children[src].append(dst)
        self.parent[dst] = src

    def remove_node(self, node_id: str) -> None:
        """
        Remove a node from the graph.
        
        For gates with >1 child, raises an error (ambiguous).
        For gates with 1 child, adopts the child.
        For components, simply removes the node.
        
        Args:
            node_id: ID of node to remove
            
        Raises:
            KeyError: If node doesn't exist
            ValueError: If gate has >1 child
        """
        if node_id not in self.nodes:
            raise KeyError(f"Unknown node '{node_id}'")
        
        node = self.nodes[node_id]

        if node.is_gate():
            self._remove_gate(node_id)
        else:
            self._remove_component(node_id)
        
        if self.auto_normalize:
            self.normalize()

    def edit_gate(self, node_id: str, params: Dict[str, Any]) -> None:
        """
        Edit gate parameters (e.g., k value for KOON gates).
        
        Args:
            node_id: Gate node ID
            params: Dictionary with parameters to update
            
        Raises:
            KeyError: If node doesn't exist
            ValueError: If node is not a gate or params are invalid
        """
        if node_id not in self.nodes:
            raise KeyError(f"Unknown node '{node_id}'")
        
        node = self.nodes[node_id]
        if not node.is_gate():
            raise ValueError("Only gate nodes can be edited with edit_gate")
        
        # KOON gate: supports 'k' parameter
        if node.subtype == "KOON" and "k" in params:
            k_val = int(params["k"])
            n = len(self.children.get(node_id, []))
            
            if n <= 0:
                # No children yet: allow any k>=1, clamp to 1
                k_val = max(1, k_val)
            else:
                if k_val < 1 or k_val > n:
                    raise ValueError(f"k must be between 1 and {n}")
            
            node.k = k_val

        if self.auto_normalize:
            self.normalize()

    def edit_component(self, old_id: str, new_id: str, dist: Dist) -> None:
        """
        Edit a component node (change ID and/or distribution).
        
        Args:
            old_id: Current component ID
            new_id: New component ID
            dist: New distribution
            
        Raises:
            KeyError: If old_id doesn't exist
            ValueError: If node is not a component or new_id already exists
        """
        if old_id not in self.nodes:
            raise KeyError(f"Unknown node '{old_id}'")
        
        node = self.nodes[old_id]
        if not node.is_component():
            raise ValueError("Only component nodes can be edited")
        
        if new_id != old_id and new_id in self.nodes:
            raise ValueError(f"Target id '{new_id}' already exists")

        # Update distribution
        node.dist = dist

        # If ID unchanged, we're done
        if new_id == old_id:
            if self.auto_normalize:
                self.normalize()
            return

        # Rename node: update all references
        self._rename_node(old_id, new_id)

        if self.auto_normalize:
                self.normalize()

    def add_component_relative(
        self,
        target_id: str,
        new_comp_id: str,
        relation: RelType,
        dist: Dist,
        k: Optional[int] = None,
        unit_type: Optional[str] = None
    ) -> None:
        """
        Add a component relative to an existing node with specified relation.
        
        Args:
            target_id: Existing node to relate to
            new_comp_id: ID for new component
            relation: Type of relation ("series", "parallel", "koon")
            dist: Distribution for the new component
            k: k value for KOON relation (required if relation="koon")
            unit_type: Optional unit type for the component
            
        Raises:
            ValueError: If new_comp_id exists or relation is invalid
            KeyError: If target_id doesn't exist
        """
        if new_comp_id in self.nodes:
            raise ValueError(f"new_comp_id '{new_comp_id}' already exists")
        if target_id not in self.nodes:
            raise KeyError(f"target_id '{target_id}' not found")
        
        self._validator.validate_relation(relation)
        
        # Create the new component
        new_node = Node(
            id=new_comp_id,
            type="component",
            dist=dist,
            unit_type=unit_type
        )
        self.add_node(new_node)
        
        # Determine required gate type
        want_gate: GateType = self._relation_to_gate_type(relation)
        target_parent = self.parent[target_id]
        
        # KOON-specific handling
        if relation == "koon":
            if self._handle_koon_insertion(target_id, new_comp_id, target_parent, k):
                if self.auto_normalize:
                    self.normalize()
                return
        
        # Case 1: Parent is already the desired gate type
        if target_parent is not None and self._is_gate(target_parent, want_gate):
            self._insert_child_after(target_parent, target_id, new_comp_id)
            if self.auto_normalize:
                self.normalize()
            return
        
        # Case 2: Target itself is the desired gate and is root
        if target_parent is None and self._is_gate(target_id, want_gate):
            self.add_edge(target_id, new_comp_id)
            if self.auto_normalize:
                self.normalize()
            return
        
        # Case 3: Need to interpose a new gate
        gate_id = self._interpose_gate(target_id, target_parent, want_gate, k)
        self.add_edge(gate_id, new_comp_id)

        if self.auto_normalize:
                self.normalize()

    def normalize(self) -> None:
        """Simplify graph by collapsing 0/1-child gates from the root."""
        if self.root is None:
            return

        visited: List[str] = []
        stack = [self.root]
        while stack:
            nid = stack.pop()
            visited.append(nid)
            stack.extend(self.children.get(nid, []))

        for nid in reversed(visited):
            if nid in self.nodes and self.nodes[nid].is_gate():
                self._try_collapse_gate(nid)

    # EVALUATION & OUTPUT

    def evaluate(self) -> float:
        """
        Evaluate total system reliability.
        
        Returns:
            System reliability value (0.0 to 1.0)
        """
        # Set project_root in evaluator for proper cache access
        self._evaluator.project_root = getattr(self, "project_root", None)
        self._evaluator.failures_cache = getattr(self, "failures_cache", None)
        
        result = self._evaluator.evaluate()
        self.reliability_total = result
        return result
    
    def clear_reliability(self) -> None:
        """Clear all cached reliability values"""
        for node in self.nodes.values():
            node.reliability = None
        self.reliability_total = None

    def to_expression(self) -> str:
        """
        Generate algebraic expression representing the graph.
        
        Returns:
            String expression (e.g., "(A & B) || C")
        """
        return "(empty)" if self.root is None else self._expr(self.root)

    def to_data(self) -> Dict[str, Any]:
        """
        Serialize graph to dictionary.
        
        Returns:
            Dictionary with nodes, edges, root, and reliability data
        """
        return self._serializer.to_data(self)

    @classmethod
    def from_data(cls, data: Dict[str, Any]) -> "ReliabilityGraph":
        """
        Deserialize graph from dictionary.
        
        Args:
            data: Dictionary with graph data
            
        Returns:
            New ReliabilityGraph instance
        """
        return GraphSerializer.from_data(data)

    # PRIVATE HELPERS - Node manipulation

    def _remove_gate(self, node_id: str) -> None:
        """Remove a gate node, handling child adoption"""
        chs = list(self.children[node_id])
        
        if len(chs) > 1:
            raise ValueError(
                "Cannot remove a gate with >1 child (ambiguous). "
                "Remove/rewire children first or leave only 1 child to collapse."
            )
        
        adopt_child = chs[0] if len(chs) == 1 else None
        p = self.parent[node_id]
        
        if p is None:
            # Removing root gate
            if adopt_child is not None:
                self.parent[adopt_child] = None
                self.root = adopt_child
            else:
                self.root = None
        else:
            # Gate has parent: replace in parent's children
            self._replace_child(p, node_id, adopt_child)
        
        self.children[node_id] = []
        self._delete_node(node_id)

    def _remove_component(self, node_id: str) -> None:
        """Remove a component node"""
        p = self.parent[node_id]
        
        if p is None:
            # Root component
            self._delete_node(node_id)
            self.root = None
            return
        
        # Remove from parent's children list
        self.children[p] = [c for c in self.children[p] if c != node_id]
        self.parent[node_id] = None
        self._delete_node(node_id)

    def _rename_node(self, old_id: str, new_id: str) -> None:
        """Rename a node, updating all references"""
        node = self.nodes[old_id]
        children = self.children.pop(old_id)
        parent_id = self.parent.pop(old_id)
        self.nodes.pop(old_id)
        
        # Update node ID
        node.id = new_id
        
        # Reinsert with new ID
        self.nodes[new_id] = node
        self.children[new_id] = children
        self.parent[new_id] = parent_id
        
        # Update children's parent pointers
        for child_id in children:
            self.parent[child_id] = new_id
        
        # Update parent's children list
        if parent_id is not None:
            chs = self.children[parent_id]
            for i, cid in enumerate(chs):
                if cid == old_id:
                    chs[i] = new_id
                    break
        
        # Update root if necessary
        if self.root == old_id:
            self.root = new_id

    def _delete_node(self, node_id: str) -> None:
        """Delete a node and clean up references"""
        for child in self.children.get(node_id, []):
            if self.parent.get(child) == node_id:
                self.parent[child] = None
        
        self.children.pop(node_id, None)
        self.parent.pop(node_id, None)
        self.nodes.pop(node_id, None)

    def _replace_child(
        self,
        parent_id: str,
        old_child: str,
        new_child: Optional[str]
    ) -> None:
        """Replace a child in parent's children list"""
        if parent_id is None:
            raise ValueError("_replace_child called with parent_id=None")
        
        chs = self.children[parent_id]
        for i, c in enumerate(chs):
            if c == old_child:
                if new_child is None:
                    chs.pop(i)
                else:
                    chs[i] = new_child
                    self.parent[new_child] = parent_id
                break
        
        self.parent[old_child] = None

    def _insert_child_after(
        self,
        parent_id: str,
        after_child: str,
        new_child: str
    ) -> None:
        """Insert new_child after after_child in parent's children list"""
        if parent_id not in self.children:
            raise KeyError(f"Unknown parent '{parent_id}'")
        if new_child not in self.nodes:
            raise KeyError(f"Unknown child to insert '{new_child}'")
        if self.parent[new_child] is not None:
            raise ValueError(f"Node '{new_child}' already has a parent")
        
        chs = self.children[parent_id]
        try:
            idx = chs.index(after_child)
            chs.insert(idx + 1, new_child)
        except ValueError:
            # Fallback if target not found
            chs.append(new_child)
        
        self.parent[new_child] = parent_id

    def _try_collapse_gate(self, gate_id: Optional[str]) -> None:
        """
        Collapse gates with 0 or 1 children recursively.
        
        Gates with single child are replaced by that child.
        Empty gates are removed.
        """
        gid = gate_id
        
        while gid is not None and gid in self.nodes and self.nodes[gid].is_gate():
            chs = self.children[gid]
            gp = self.parent[gid]
            
            if len(chs) == 1:
                # Single child: collapse gate
                only = chs[0]
                if gp is None:
                    self.root = only
                    self.parent[only] = None
                else:
                    self._replace_child(gp, gid, only)
                self._delete_node(gid)
                gid = gp
                
            elif len(chs) == 0:
                # Empty gate: remove
                if gp is None:
                    self.root = None
                else:
                    self.children[gp] = [c for c in self.children[gp] if c != gid]
                self._delete_node(gid)
                gid = gp
            else:
                # Multiple children: stop
                break

    # PRIVATE HELPERS - Gate operations

    def _is_gate(self, node_id: str, subtype: GateType) -> bool:
        """Check if node is a gate of specific subtype"""
        node = self.nodes[node_id]
        return node.is_gate() and node.subtype == subtype

    def _relation_to_gate_type(self, relation: RelType) -> GateType:
        """Convert relation type to gate type"""
        if relation == "series":
            return "AND"
        elif relation == "parallel":
            return "OR"
        else:  # koon
            return "KOON"

    def _interpose_gate(
        self,
        target_id: str,
        target_parent: Optional[str],
        gate_type: GateType,
        k: Optional[int] = None
    ) -> str:
        """
        Create a new gate between target_parent and target.
        
        Returns:
            ID of the newly created gate
        """
        # Generate gate ID
        prefix = {
            "AND": "G_and",
            "OR": "G_or",
            "KOON": "G_koon"
        }.get(gate_type, "G_auto")
        
        gate_id = self._alloc_gate_id(prefix)
        
        # Create gate node
        if gate_type == "KOON":
            if k is None:
                raise ValueError("KOON insertion requires k")
            gate_node = Node(id=gate_id, type="gate", subtype="KOON", k=k)
        else:
            gate_node = Node(id=gate_id, type="gate", subtype=gate_type)
        
        self.add_node(gate_node)
        
        # Wire it between parent and target
        if target_parent is None:
            self.root = gate_id
        else:
            self._replace_child(target_parent, target_id, gate_id)
        
        self.add_edge(gate_id, target_id)
        return gate_id

    def _handle_koon_insertion(
        self,
        target_id: str,
        new_comp_id: str,
        target_parent: Optional[str],
        k: Optional[int]
    ) -> bool:
        """
        Handle special cases for KOON insertion.
        
        Returns:
            True if insertion was handled, False if standard logic should apply
        """
        # Case 1: Target itself is a KOON gate
        if self._is_gate(target_id, "KOON"):
            self.add_edge(target_id, new_comp_id)
            return True
        
        # Case 2: Target is a component inside a KOON gate
        if target_parent is not None and self._is_gate(target_parent, "KOON"):
            target_node = self.nodes[target_id]
            if target_node.is_component():
                # Create nested KOON around target
                gate_id = self._interpose_gate(target_id, target_parent, "KOON", k)
                self.add_edge(gate_id, new_comp_id)
                return True
        
        return False

    def _alloc_gate_id(self, prefix: str = "G_auto") -> str:
        """
        Allocate a unique gate ID with given prefix.
        
        Format: <prefix>_<number>
        
        Args:
            prefix: Prefix for the gate ID
            
        Returns:
            Unique gate ID
        """
        if prefix.endswith("_"):
            prefix = prefix[:-1]
        
        n = 1
        while True:
            candidate = f"{prefix}_{n}"
            if candidate not in self.nodes:
                return candidate
            n += 1

    # PRIVATE HELPERS - Expression generation

    def _expr(self, nid: str) -> str:
        """Recursively generate expression for a node"""
        node = self.nodes[nid]
        
        if node.is_component():
            return node.id
        
        kids = self.children[nid]
        
        if node.subtype == "AND":
            # Series: (A & B & C)
            return "(" + " & ".join(self._expr(k) for k in kids) + ")"
        
        if node.subtype == "OR":
            # Parallel: (A || B || C)
            return "(" + " || ".join(self._expr(k) for k in kids) + ")"
        
        if node.subtype == "KOON":
            # k-out-of-n: KOON[k/n](A, B, C)
            k = node.k if node.k is not None else 1
            n = len(kids)
            parts = ", ".join(self._expr(kid) for kid in kids)
            return f"KOON[{k}/{n}]({parts})"
        
        # Unknown gate type
        return "(" + " ? ".join(self._expr(k) for k in kids) + ")"

    # BACKWARD COMPATIBILITY

    def _new_gate_id(self) -> str:
        """Legacy method for gate ID allocation"""
        return self._alloc_gate_id("G_auto")
