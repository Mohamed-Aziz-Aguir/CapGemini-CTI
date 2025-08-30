from pydantic import BaseModel
from typing import Optional

class ZeroDay(BaseModel):
    zero_day_id: str
    cve: str
    category: str
    impact: str
