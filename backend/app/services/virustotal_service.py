import re
from datetime import datetime
import httpx
from typing import Tuple
from urllib.parse import quote
from app.core.config import settings
from app.core.elasticsearch_client import es  

VT_BASE = "https://www.virustotal.com/api/v3"

_hash_re = re.compile(r"^[A-Fa-f0-9]{32}$|^[A-Fa-f0-9]{40}$|^[A-Fa-f0-9]{64}$")
_ipv4_re = re.compile(r"^(?:\d{1,3}\.){3}\d{1,3}$")
_email_re = re.compile(r"^[^@]+@[^@]+\.[^@]+$")


def _detect_vt_endpoint(ioc: str) -> Tuple[str, str]:
    if _hash_re.match(ioc):
        return ("files", ioc)
    if _ipv4_re.match(ioc):
        return ("ip_addresses", ioc)
    if _email_re.match(ioc):
        return ("search", f"email:{ioc}")
    return ("domains", ioc)


async def get_info_from_virustotal(ioc: str) -> dict:
    """Get IOC data from VirusTotal, using Elasticsearch as a cache."""
    # 1️⃣ Check cache first
    try:
        query = {"query": {"match": {"ioc": ioc}}}
        res = await es.search(index="vt-iocs", query=query)
        if res.get("hits", {}).get("total", {}).get("value", 0) > 0:
            return res["hits"]["hits"][0]["_source"]["raw"]
    except Exception:
        pass

    # 2️⃣ Fetch from API
    api_key = getattr(settings, "virustotal_api_key", None)
    if not api_key:
        return {"error": "VirusTotal API key not configured."}

    headers = {"x-apikey": api_key}
    path, ident = _detect_vt_endpoint(ioc)

    url = (
        f"{VT_BASE}/search?query={quote(ident)}"
        if path == "search"
        else f"{VT_BASE}/{path}/{ident}"
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            result = resp.json()

        # Save in ES
        doc = {
            "ioc": ioc,
            "type": path,
            "source": "virustotal",
            "fetched_at": datetime.utcnow().isoformat(),
            "raw": result,
        }
        try:
            await es.index(index="vt-iocs", document=doc)
        except Exception:
            pass

        return result

    except httpx.HTTPStatusError as e:
        try:
            details = e.response.json()
        except Exception:
            details = e.response.text
        return {
            "error": f"VirusTotal API error: {e.response.status_code}",
            "details": details,
        }
    except Exception as e:
        return {"error": str(e)}
