from app.src.model.failure.ports import FailuresCachePort, FailuresClientPort


class CacheImpl:
    def load_failures_cache(self, project_root=None):
        return {}

    def save_failures_cache(self, cache, project_root=None):
        return None


class ClientImpl:
    def fetch_failures_for_components(self, component_ids):
        return []


def test_ports_runtime_conformance():
    cache = CacheImpl()
    client = ClientImpl()

    assert isinstance(cache, FailuresCachePort)
    assert isinstance(client, FailuresClientPort)
