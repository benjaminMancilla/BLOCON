
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.service import GraphES
from src.services.cache.local_store import LocalWorkspaceStore
from src.services.cache.event_store import EventStore
from src.ui.gui import run_gui

def main():
    g = ReliabilityGraph()
    local = LocalWorkspaceStore()
    store = EventStore(local)

    es = GraphES(graph=g, store=store, actor="anonymous")
    run_gui(es)

if __name__ == "__main__":
    main()
