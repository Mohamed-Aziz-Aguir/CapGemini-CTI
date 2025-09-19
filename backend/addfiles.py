from elasticsearch import Elasticsearch
import json
from app.core.elasticsearch_client import es

# Read file content (example: JSON file)
with open("threat catalog/tampering.json", "r") as f:
    data = json.load(f)

# Index the document
es.index(index="tampering", document=data)
print("File indexed successfully!")
