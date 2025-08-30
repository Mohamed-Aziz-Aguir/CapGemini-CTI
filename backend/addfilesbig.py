from elasticsearch import Elasticsearch, helpers
import json
from app.core.elasticsearch_client import es

index_name = "asrg-cve"

def load_documents(file_path):
    docs = []
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)

            # If it's Elasticsearch export format
            if "_source" in record:
                docs.append(record["_source"])
            else:
                docs.append(record)
    return docs

def index_bulk(docs, index):
    actions = [
        {
            "_index": index,
            "_source": doc
        }
        for doc in docs
    ]
    helpers.bulk(es, actions)

if __name__ == "__main__":
    documents = load_documents("asrg-cve.json")
    index_bulk(documents, index_name)
    print(f"Indexed {len(documents)} documents into '{index_name}' successfully!")
