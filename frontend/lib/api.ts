// lib/api.ts
// Place at: /lib/api.ts
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function getNews(limit = 10) {
  const res = await axios.get(`${API_BASE}/news/`, { params: { limit } });
  return res.data;
}

export async function analyzeIoc(ioc: string) {
  const res = await axios.post(`${API_BASE}/api/ioc/analyze`, { value: ioc });
  return res.data;
}

export async function searchZeroDay(q: string, page = 1, page_size = 10) {
  const res = await axios.get(`${API_BASE}/zeroday/search`, {
    params: { query: q, page, page_size },
  });
  return res.data;
}


export async function getThreatCatalog(category: string) {
  const res = await axios.get(`${API_BASE}/threat-catalog/get`, { params: { category } });
  return res.data;
}

export async function searchAll(q: string, page = 1, page_size = 10) {
  const res = await axios.get(`${API_BASE}/api/search/all`, {
    params: { q, page, page_size },
  });
  return res.data;
}

export default {
  getNews,
  analyzeIoc,
  searchZeroDay,
  getThreatCatalog,
  searchAll,
};

