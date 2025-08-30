"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import axios from "axios"
import TopNavigation from "../../components/TopNavigation"
import ChatbotPopup from "../../components/ChatbotPopup"

type ZeroDayItem = {
  zero_day_id: string
  cve: string
  category: string
  impact: string
  [key: string]: any
}

export default function ZeroDayTracker() {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<ZeroDayItem[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // ✅ Base URL for backend
  const API_BASE = "http://localhost:8000"

  // ✅ Fetch zero-days (backend expects `query`)
  const handleSearch = async (term: string = searchTerm) => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/zeroday/search`, {
        params: { query: term.trim() || null }, // Send null for empty query
      })
      setResults(response.data.results || [])
    } catch (error) {
      console.error("Zero-day search error:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // ✅ Auto-search with debounce (like CVE)
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleSearch(searchTerm)
    }, 500)
    return () => clearTimeout(delayDebounce)
  }, [searchTerm])

  // ✅ Auto refresh every 30s
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => handleSearch(searchTerm), 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, searchTerm])

  // ✅ Load all zero-days on initial render
  useEffect(() => {
    handleSearch("")
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <TopNavigation />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">Zero-Day Tracker</h1>
          <p className="text-gray-400">Monitor the latest zero-day vulnerabilities and exploits</p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-8 border border-cyan-500/20"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex space-x-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search zero-day vulnerabilities..."
                className="flex-1 bg-gray-900/50 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                disabled={loading}
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
              >
                {loading ? "⏳" : "🔍"} Search
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-refresh</span>
              </label>
              <button
                onClick={() => handleSearch(searchTerm)}
                disabled={loading}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* Results */}
        <div className="space-y-6">
          {results.map((item, index) => (
            <motion.div
              key={item.zero_day_id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-cyan-400 mb-2">
                    {item.zero_day_id || "Unknown Zero-Day"}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {item.impact || "No impact description available."}
                  </p>
                </div>
              </div>

              {/* Extra details */}
              <div className="flex flex-wrap gap-2 mt-4">
                {item.cve && (
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                    CVE: {item.cve}
                  </span>
                )}
                {item.category && (
                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">
                    {item.category}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {results.length === 0 && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">⚡</div>
            <p>No zero-day vulnerabilities found</p>
          </motion.div>
        )}

        {/* Loader */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading zero-day data...</p>
          </div>
        )}
      </div>

      <ChatbotPopup />
    </div>
  )
}
