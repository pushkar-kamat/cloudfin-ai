from __future__ import annotations

import hashlib
import json
import time
from collections import OrderedDict
from typing import Any

from app.config import CACHE_MAX_ENTRIES, CACHE_TTL_SECONDS


class TTLCache:
    def __init__(self) -> None:
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self.hits = 0
        self.misses = 0

    @staticmethod
    def key(payload: dict) -> str:
        raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if not item:
            self.misses += 1
            return None
        created, value = item
        if time.time() - created > CACHE_TTL_SECONDS:
            self._data.pop(key, None)
            self.misses += 1
            return None
        self._data.move_to_end(key)
        self.hits += 1
        return value

    def set(self, key: str, value: Any) -> None:
        self._data[key] = (time.time(), value)
        self._data.move_to_end(key)
        while len(self._data) > CACHE_MAX_ENTRIES:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()

    @property
    def size(self) -> int:
        return len(self._data)


answer_cache = TTLCache()
