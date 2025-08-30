from elasticsearch import AsyncElasticsearch
from app.core.config import settings

es = AsyncElasticsearch(
    [settings.elastic_host],
    verify_certs=False,  # or True if using proper certs
    ssl_show_warn=False
)
