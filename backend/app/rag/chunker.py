from __future__ import annotations

import re

from app.config import CHUNK_OVERLAP, CHUNK_SIZE


def _split_long_text(text: str, max_chars: int, overlap: int) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
            carry = current[-overlap:].strip() if overlap else ""
            current = f"{carry}\n\n{paragraph}".strip() if carry else paragraph
        else:
            start = 0
            while start < len(paragraph):
                end = min(start + max_chars, len(paragraph))
                chunks.append(paragraph[start:end].strip())
                if end >= len(paragraph):
                    break
                start = max(end - overlap, start + 1)
            current = ""

        while len(current) > max_chars:
            chunks.append(current[:max_chars].strip())
            current = current[max_chars - overlap:].strip() if overlap else current[max_chars:].strip()

    if current:
        chunks.append(current)
    return [chunk for chunk in chunks if chunk]


def chunk_records(records: list[dict]) -> list[dict]:
    chunks: list[dict] = []
    serial = 0

    for record in records:
        pieces = _split_long_text(record.get("text", ""), CHUNK_SIZE, CHUNK_OVERLAP)
        for piece in pieces:
            serial += 1
            chunks.append({
                **record,
                "text": piece,
                "chunk_id": f"chunk-{serial:04d}",
            })
    return chunks
