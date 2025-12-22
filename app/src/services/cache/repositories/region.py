from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Optional

from ..utils import _atomic_write_text, _read_json_file, default_user_data_dir, iso_utc


@dataclass
class RegionCacheRepo:
    path: str

    @classmethod
    def default(
        cls,
        *,
        app_name: str = "BLOCON",
        cache_dirname: str = "cache",
        filename: str = "search_region.json",
    ) -> "RegionCacheRepo":
        base = default_user_data_dir(app_name=app_name)
        cache_dir = os.path.join(base, cache_dirname)
        os.makedirs(cache_dir, exist_ok=True)
        return cls(path=os.path.join(cache_dir, filename))

    def load(self) -> Optional[str]:
        data = _read_json_file(self.path, {})
        if not isinstance(data, dict):
            return None
        region = data.get("region")
        if not region:
            return None
        value = str(region).strip()
        return value or None

    def save(self, region: str) -> None:
        if not region:
            return
        payload = {"region": region, "saved_at": iso_utc()}
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        _atomic_write_text(self.path, text)