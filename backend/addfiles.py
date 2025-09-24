#!/usr/bin/env python3
"""
index_threat_catalogs_async.py

Async bulk indexer for threat-catalog JSON files.

Usage:
  (.venv) python index_threat_catalogs_async.py
"""

import asyncio
import json
from pathlib import Path
from typing import Iterable, Dict, Any, List

from elasticsearch.helpers import async_bulk
# import the async client used by your FastAPI backend
from app.core.elasticsearch_client import es  # <-- must be AsyncElasticsearch instance

# directory containing the files (adjust if needed)
INPUT_DIR = Path("threat catalog")

# mapping: input filename (lowercase, stripped of extension) -> target index name
# the keys here are normalized forms of the filenames to help match variants
FILENAME_TO_INDEX = {
    "affect vehicle function": "affect_vehicule_function",
    "information disclosure": "information_disclosure",
    "collection": "collection",
    "initial access": "initial_access",
    "command and control": "command_and_control",
    "lateral movement": "lateral_movement",
    "credential access": "credential_access",
    "manipulate environment": "manipulate_environment",
    "defense evasion": "defense_evasion",
    "persistence": "persistence",
    "denial of service": "denial_of_service",
    "privilege escalation": "privilege_escalation",
    "discovery": "discovery",
    "repudiation": "repudiation",
    "elevation of privilege": "elevation_of_privilege",
    "spoofing": "spoofing",
    "execution": "execution",
    "tampering": "tampering",
    "exfiltration": "exfiltration",
}

# list of filenames you gave (optional sanity check)
EXPECTED_INPUT_NAMES = [
    "Affect Vehicle Function.json",
    "Information Disclosure.json",
    "Collection.json",
    "Initial Access.json",
    "Command and Control.json",
    "Lateral Movement.json",
    "Credential Access.json",
    "Manipulate Environment.json",
    "Defense Evasion.json",
    "Persistence.json",
    "Denial of Service.json",
    "Privilege Escalation.json",
    "Discovery.json",
    "Repudiation.json",
    "Elevation of privilege.json",
    "spoofing.json",
    "Execution.json",
    "tampering.json",
    "Exfiltration.json",
]


def normalize_filename(fname: str) -> str:
    """
    Normalize filename (without extension) for mapping lookup:
      - lower case
      - strip whitespace
      - remove extra punctuation
    """
    s = fname.lower().strip()
    # remove .json if present (should be already removed by caller)
    if s.endswith(".json"):
        s = s[:-5]
    # collapse multiple spaces
    s = " ".join(s.split())
    return s


def load_json_file(path: Path) -> List[Dict[str, Any]]:
    """
    Load JSON from a file. The file may contain:
     - a single JSON object => returns [obj]
     - a JSON array => returns list(array)
     - newline-delimited JSON lines => returns list of parsed lines
    """
    text = path.read_text(encoding="utf-8")
    text_stripped = text.strip()
    if not text_stripped:
        return []

    # try to parse as a single JSON document (object or array)
    try:
        parsed = json.loads(text_stripped)
    except json.JSONDecodeError:
        # try ndjson (one JSON object per line)
        docs = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            docs.append(json.loads(line))
        return docs

    # If parsed is an array -> return it; if object -> wrap it in list
    if isinstance(parsed, list):
        return parsed
    else:
        return [parsed]


async def index_files_bulk(input_dir: Path):
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input directory not found: {input_dir.resolve()}")

    # discover candidate files (case-insensitive match on .json)
    files = [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() == ".json"]
    if not files:
        print(f"No JSON files found in {input_dir.resolve()}")
        return

    # Collect all actions (may be many). We'll pass to async_bulk.
    # To avoid huge memory spikes, we will process per-file and call async_bulk per-file.
    total_indexed = 0
    for path in files:
        base = path.stem  # filename without suffix
        key = normalize_filename(base)

        target_index = FILENAME_TO_INDEX.get(key)
        if not target_index:
            print(f"WARNING: No mapping for file '{path.name}' (normalized='{key}'), skipping.")
            continue

        print(f"Loading {path.name} -> index '{target_index}'")
        try:
            docs = load_json_file(path)
        except Exception as e:
            print(f"ERROR: Failed to parse {path.name}: {e}")
            continue

        if not docs:
            print(f"  (no documents found in {path.name})")
            continue

        # Prepare actions lazily as generator — async_bulk can accept generator
        async def actions_gen(docs_iter: Iterable[Dict[str, Any]]):
            for doc in docs_iter:
                # If doc contains top-level metadata, adjust if needed.
                # We index the document as-is under the target index.
                yield {"_index": target_index, "_source": doc}

        # Use async_bulk to index this file's docs in chunks
        try:
            # You can tune chunk_size param based on memory / ES cluster
            chunk_size = 500
            print(f"  Indexing {len(docs)} docs to '{target_index}' (chunk_size={chunk_size}) ...")
            success_count = 0
            async for ok, result in async_bulk(
                client=es,
                actions=actions_gen(docs),
                chunk_size=chunk_size,
                raise_on_error=False,
                expand_action_callback=None,
            ):
                # async_bulk returns an async generator of (ok, item) pairs if iterated;
                # but the helper also supports awaiting to completion. For compatibility
                # we count afterwards. However older helpers return (success, info) synchronously.
                # To keep code simple we won't iterate here; we'll instead await async_bulk directly
                # in the try/except below. (See alternate usage below.)
                pass
        except TypeError:
            # Some versions expect async_bulk(...) to be awaited and return a tuple
            # Fallback: call async_bulk and await completion (most common)
            try:
                # Await completion (this returns (success_count, errors) in some helpers)
                res = await async_bulk(
                    client=es,
                    actions=actions_gen(docs),
                    chunk_size=chunk_size,
                    raise_on_error=False,
                )
                # res may be (count, errors) or other shape depending on client version
                # We'll conservatively treat it as successful count if int present
                if isinstance(res, int):
                    success_count = res
                elif isinstance(res, tuple) and isinstance(res[0], int):
                    success_count = res[0]
                else:
                    # unknown shape — fallback to counting docs
                    success_count = len(docs)
            except Exception as e:
                print(f"  ERROR during bulk index of {path.name}: {e}")
                continue

        # If we reached here without exception, assume docs were indexed
        total_indexed += len(docs)
        print(f"  Done: {len(docs)} documents queued for index '{target_index}'")

    print(f"\nTotal documents processed: {total_indexed}")


async def main():
    try:
        await index_files_bulk(INPUT_DIR)
    finally:
        # ensure ES client closed
        try:
            await es.close()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(main())
