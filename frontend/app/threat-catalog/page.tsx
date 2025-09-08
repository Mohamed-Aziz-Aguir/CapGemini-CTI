"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import TopNavigation from "../../components/TopNavigation"
import ChatbotPopup from "../../components/ChatbotPopup"
import api from "../../lib/api"

type FeasibilityRating = {
  ET?: { description: string }
  SE?: { description: string }
  KoIC?: { description: string }
  WoO?: { description: string }
  Eq?: { description: string }
}

type SecurityProperties = {
  Confidentiality?: boolean
  Integrity?: boolean
  Availability?: boolean
}

type SubThreat = {
  ThreatName: string
  ThreatID: string
  AttackFeasibilityLevel: string
  FeasibilityRating: FeasibilityRating
  Description: string
  RefineThreatClass: string
  SecurityProperties: SecurityProperties
  category?: string
}

type ThreatResponse = {
  ThreatName: string
  ThreatID: string
  SubThreats: SubThreat[]
}

const categories = [
  "All",
  "execution",
  "privilege_escalation",
  "lateral_movement",
  "initial_access",
  "collection",
  "command_and_control",
  "defense_evasion", // typo kept to match ES
  "credential_access",
  "discovery",
  "persistence",
  "tampering",
  "exfiltration",
  "spoofing",
  "information_disclosure",
  "repudiation",
  "manipulate_environment",
]

function formatCategoryLabel(category: string) {
  if (category === "All") return "All"
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default function ThreatCatalog() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [threats, setThreats] = useState<SubThreat[]>([])
  const [loading, setLoading] = useState(false)
  const [openThreats, setOpenThreats] = useState<Record<string, boolean>>({})

  const loadThreats = async (category: string = selectedCategory) => {
    setLoading(true)
    try {
      if (category === "All") {
        const results: SubThreat[] = []
        for (const cat of categories.filter((c) => c !== "All")) {
          try {
            const response: ThreatResponse[] = await api.getThreatCatalog(cat)
            response.forEach((t) => {
              if (t.SubThreats) {
                results.push(...t.SubThreats.map((st) => ({ ...st, category: cat })))
              }
            })
          } catch (err) {
            console.warn(`Failed to load ${cat}:`, err)
          }
        }
        setThreats(results)
      } else {
        const response: ThreatResponse[] = await api.getThreatCatalog(category)
        const flattened = response.flatMap((t) =>
          t.SubThreats ? t.SubThreats.map((st) => ({ ...st, category })) : []
        )
        setThreats(flattened)
      }
    } catch (error) {
      console.error("Threat catalog error:", error)
      setThreats([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadThreats()
  }, [selectedCategory])

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "text-red-400 bg-red-400/10 border-red-400/20"
      case "high":
        return "text-orange-400 bg-orange-400/10 border-orange-400/20"
      case "medium":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
      case "low":
        return "text-green-400 bg-green-400/10 border-green-400/20"
      case "very low":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20"
      default:
        return "text-gray-400 bg-gray-400/10 border-gray-400/20"
    }
  }

  const toggleThreat = (id: string) => {
    setOpenThreats((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <TopNavigation />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">Threat Catalog</h1>
          <p className="text-gray-400">Browse and analyze threat intelligence data</p>
        </motion.div>

        {/* Category buttons */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-8 border border-cyan-500/20">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category
                    ? "bg-cyan-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {formatCategoryLabel(category)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-cyan-500/20">
            <div className="text-2xl font-bold text-cyan-400">{threats.length}</div>
            <div className="text-sm text-gray-400">Total Threats</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-red-500/20">
            <div className="text-2xl font-bold text-red-400">
              {threats.filter((t) => t.AttackFeasibilityLevel?.toLowerCase() === "critical").length}
            </div>
            <div className="text-sm text-gray-400">Critical</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-orange-500/20">
            <div className="text-2xl font-bold text-orange-400">
              {threats.filter((t) => t.AttackFeasibilityLevel?.toLowerCase() === "high").length}
            </div>
            <div className="text-sm text-gray-400">High</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-400">
              {threats.filter((t) => t.AttackFeasibilityLevel?.toLowerCase() === "medium").length}
            </div>
            <div className="text-sm text-gray-400">Medium</div>
          </div>
        </div>

        {/* Threats Collapsible List */}
        <div className="space-y-4">
          {threats.map((threat, index) => {
            const isOpen = openThreats[threat.ThreatID]
            return (
              <div
                key={threat.ThreatID || index}
                className="bg-gray-800/50 rounded-lg border border-cyan-500/20"
              >
                {/* Threat Header */}
                <button
                  onClick={() => toggleThreat(threat.ThreatID)}
                  className="w-full flex justify-between items-center px-6 py-4 text-left"
                >
                  <div>
                    <h3 className="text-xl font-bold text-cyan-400">{threat.ThreatName}</h3>
                    <p className="text-gray-400 text-sm">{formatCategoryLabel(threat.category || "")}</p>
                  </div>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-5 h-5 text-cyan-400" />
                  </motion.span>
                </button>

                {/* Collapsible Content */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-4 space-y-3 text-sm"
                    >
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(
                          threat.AttackFeasibilityLevel,
                        )}`}
                      >
                        {threat.AttackFeasibilityLevel.toUpperCase()}
                      </span>
                      <p className="text-gray-300">{threat.Description}</p>

                      <p><span className="text-gray-500">Threat ID:</span> {threat.ThreatID}</p>

                      <div>
                        <span className="text-gray-500">Security Properties:</span>
                        <ul className="list-disc list-inside ml-2">
                          {Object.entries(threat.SecurityProperties || {}).map(([prop, val]) =>
                            val ? <li key={prop}>{prop}</li> : null
                          )}
                        </ul>
                      </div>

                      <div>
                        <span className="text-gray-500">Feasibility Ratings:</span>
                        <ul className="list-disc list-inside ml-2">
                          {Object.entries(threat.FeasibilityRating || {}).map(([key, obj]) => (
                            <li key={key}>
                              <span className="font-medium">{key}:</span> {obj.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {threats.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <p>No threats found for the selected category</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading threat catalog...</p>
          </div>
        )}
      </div>
      <ChatbotPopup />
    </div>
  )
}

