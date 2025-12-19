from app.src.model.eventsourcing.in_memory_store import InMemoryEventStore
from app.src.model.eventsourcing.ports import EventStorePort


def test_in_memory_store_conforms_to_port_runtime():
    store = InMemoryEventStore()
    assert isinstance(store, EventStorePort)
