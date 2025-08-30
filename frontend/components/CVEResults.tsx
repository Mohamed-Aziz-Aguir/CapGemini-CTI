"use client"

// components/CVEResults.tsx
import { useState } from "react"
import { enrichCve, simplifyCve } from "../lib/lillyApi"
import { motion, AnimatePresence } from "framer-motion"

type CVEItem = {
  cve_id?: string
  id?: string
  name?: string
  description?: string
  summary?: string
  // Add other possible fields from your API
  [key: string]: any
}

type CVEResultsState = Record<string, { enrich?: string; simplify?: string }>

export default function CVEResults({ items }: { items: CVEItem[] }) {
  const [loading, setLoading] = useState<Record<string, { enrich?: boolean; simplify?: boolean }>>({})
  const [results, setResults] = useState<CVEResultsState>({})
  const [expanded, setExpanded] = useState<Record<string, { enrich?: boolean; simplify?: boolean }>>({})

  // Helper function to get CVE ID from different possible field names
  const getCveId = (cve: CVEItem): string => {
    return cve.name || cve.cve_id || cve.id || "Unknown CVE"
  }

  // Helper function to get CVE description from different possible field names
  const getCveDescription = (cve: CVEItem): string => {
    return cve.description || cve.summary || "No description available"
  }

  // Helper function to get the ASRG vulnerability link
  const getAsrgLink = (cve: CVEItem): string => {
    if (cve.id) {
      return `https://asrg.io/autovulndb/#/vulnerabilities/${cve.id}`
    }
    return "#"
  }

  async function handleEnrich(cve: CVEItem) {
    const cveId = getCveId(cve)
    const description = getCveDescription(cve)

    setLoading((prev) => ({ ...prev, [cveId]: { ...prev[cveId], enrich: true } }))
    try {
      console.log(`[v0] Enriching CVE: ${cveId}`)
      const enriched = await enrichCve(cveId, description)
      console.log(`[v0] Enrich result:`, enriched)

      setResults((prev) => ({
        ...prev,
        [cveId]: { ...prev[cveId], enrich: enriched },
      }))
      setExpanded((prev) => ({ ...prev, [cveId]: { ...prev[cveId], enrich: true } }))
    } catch (err) {
      console.error(`[v0] Error enriching CVE ${cveId}:`, err)
      setResults((prev) => ({
        ...prev,
        [cveId]: { ...prev[cveId], enrich: "[Error fetching enrichment data]" },
      }))
    } finally {
      setLoading((prev) => ({ ...prev, [cveId]: { ...prev[cveId], enrich: false } }))
    }
  }

  async function handleSimplify(cve: CVEItem) {
    const cveId = getCveId(cve)
    const description = getCveDescription(cve)

    setLoading((prev) => ({ ...prev, [cveId]: { ...prev[cveId], simplify: true } }))
    try {
      console.log(`[v0] Simplifying CVE: ${cveId}`)
      const simplified = await simplifyCve(cveId, description)
      console.log(`[v0] Simplify result:`, simplified)

      setResults((prev) => ({
        ...prev,
        [cveId]: { ...prev[cveId], simplify: simplified },
      }))
      setExpanded((prev) => ({ ...prev, [cveId]: { ...prev[cveId], simplify: true } }))
    } catch (err) {
      console.error(`[v0] Error simplifying CVE ${cveId}:`, err)
      setResults((prev) => ({
        ...prev,
        [cveId]: { ...prev[cveId], simplify: "[Error fetching simplification data]" },
      }))
    } finally {
      setLoading((prev) => ({ ...prev, [cveId]: { ...prev[cveId], simplify: false } }))
    }
  }

  const slideDown = {
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
  }

  if (!items || items.length === 0) {
    return <div className="text-gray-600">No CVEs found.</div>
  }

  return (
    <div className="space-y-4">
      {items.map((cve, index) => {
        const cveId = getCveId(cve)
        const description = getCveDescription(cve)
        const asrgLink = getAsrgLink(cve)
        const uniqueKey = cveId !== "Unknown CVE" ? cveId : `cve-${index}`

        return (
          <div
            key={uniqueKey}
            className="p-4 bg-white shadow rounded-lg transition-all duration-300 hover:shadow-lg border border-gray-200"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xl text-blue-600 bg-blue-50 px-3 py-1 rounded-md">{cveId}</h3>
              <div className="text-xs text-gray-500">{cve.published_date || cve.date || ""}</div>
            </div>

            <p className="text-gray-700 mb-3 leading-relaxed">{description}</p>

            {/* CVSS Score Display */}
            {cve.cvss && (
              <div className="mb-3">
                <span className="inline-block bg-gray-100 text-gray-800 text-sm font-medium px-2.5 py-0.5 rounded">
                  CVSS Score: {cve.cvss.baseScore} ({cve.cvss.baseSeverity})
                </span>
              </div>
            )}

            {/* ASRG Link */}
            {asrgLink !== "#" && (
              <div className="mb-3">
                <a
                  href={asrgLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                  View on ASRG AutoVulnDB
                </a>
              </div>
            )}

            <div className="flex gap-3 mb-3">
              <button
                onClick={() => handleEnrich(cve)}
                disabled={loading[cveId]?.enrich}
                className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                  loading[cveId]?.enrich
                    ? "bg-blue-300 cursor-not-allowed text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md"
                }`}
              >
                {loading[cveId]?.enrich ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enriching...
                  </span>
                ) : (
                  "🔍 Enrich"
                )}
              </button>

              <button
                onClick={() => handleSimplify(cve)}
                disabled={loading[cveId]?.simplify}
                className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                  loading[cveId]?.simplify
                    ? "bg-green-300 cursor-not-allowed text-white"
                    : "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md"
                }`}
              >
                {loading[cveId]?.simplify ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Simplifying...
                  </span>
                ) : (
                  "📝 Simplify"
                )}
              </button>
            </div>

            <AnimatePresence>
              {expanded[cveId]?.enrich && results[cveId]?.enrich && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={slideDown}
                  transition={{ duration: 0.4 }}
                  className="mb-3 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-md"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600 font-semibold">🔍 Enriched Analysis:</span>
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [cveId]: { ...prev[cveId], enrich: false } }))}
                      className="ml-auto text-blue-400 hover:text-blue-600 text-sm"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {results[cveId].enrich}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {expanded[cveId]?.simplify && results[cveId]?.simplify && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={slideDown}
                  transition={{ duration: 0.4 }}
                  className="mb-3 p-4 bg-green-50 border-l-4 border-green-400 rounded-r-md"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600 font-semibold">📝 Simplified Explanation:</span>
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [cveId]: { ...prev[cveId], simplify: false } }))}
                      className="ml-auto text-green-400 hover:text-green-600 text-sm"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {results[cveId].simplify}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
