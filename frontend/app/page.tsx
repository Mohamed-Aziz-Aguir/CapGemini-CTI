"use client"

import { useEffect, useState } from "react"
import TopNavigation from "../components/TopNavigation"
import ChatbotPopup from "../components/ChatbotPopup"
import Navbar from "../components/Navbar"
import SearchBar from "../components/SearchBar"
import CVEResults from "../components/CVEResults"
import Pagination from "../components/Pagination"
import NewsList from "../components/NewsList"
import api from "../lib/api"

export default function Dashboard() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [cves, setCves] = useState<any[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [news, setNews] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // load initial data
    loadCves("", 1)
    api
      .getNews(10)
      .then(setNews)
      .catch((e) => console.error(e))
  }, [])

  async function loadCves(query: string, pageNum = 1) {
    setLoading(true)
    setError(null)
    try {
      const res = await api.searchAll(query, pageNum, pageSize)
      // expected res: { results: [...], pagination: {...} }
      setCves(res.results || [])
      setPagination(res.pagination || null)
    } catch (e) {
      console.error(e)
      setError("Failed to load CVEs")
    } finally {
      setLoading(false)
    }
  }

  function onSearch(qstr: string) {
    setQ(qstr)
    setPage(1)
    loadCves(qstr, 1)
  }

  function onPageChange(newPage: number) {
    setPage(newPage)
    loadCves(q, newPage)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <TopNavigation />
      <Navbar />
      <main className="max-w-6xl mx-auto p-6 grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white glow-text">Recent CVEs</h1>
            <SearchBar onSearch={onSearch} defaultValue="" />
          </div>

          {loading && <div className="text-cyan-400">Loading CVEs...</div>}
          {error && <div className="text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-3">{error}</div>}
          {!loading && cves.length === 0 && <div className="text-gray-400">No CVEs found.</div>}
          {!loading && cves.length > 0 && <CVEResults items={cves} />}

          {pagination && pagination.total_pages > 1 && (
            <Pagination pagination={pagination} onPageChange={onPageChange} />
          )}
        </section>

        <aside className="md:col-span-1">
          <h2 className="text-xl font-semibold mb-3 text-white glow-text">Latest News</h2>
          <div className="cyber-card">
            <NewsList items={news} />
          </div>
        </aside>
      </main>
      <ChatbotPopup />
    </div>
  )
}
