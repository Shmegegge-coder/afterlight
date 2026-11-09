"""Run the API against an in-memory Mongo (mongomock-motor) — no database needed.
Data is lost on restart. Usage: python dev_mock_db.py  (needs requirements-dev.txt)"""
import os
os.environ.setdefault("MONGO_URL", "mongodb://mock")
os.environ.setdefault("DB_NAME", "afterlight")
from mongomock_motor import AsyncMongoMockClient
import orders
orders._client = AsyncMongoMockClient()
import uvicorn
from server import app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8001")))
