"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import TopNavigation from "../../components/TopNavigation"
import ChatbotPopup from "../../components/ChatbotPopup"

type IOCResult = {
  indicator: string
  type: string
  analysis: any
  timestamp: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"

export default function IOCAnalyzer() {
  const [input, setInput] = useState("")
  const [results, setResults] = useState<IOCResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({})

  const handleAnalyze = async () => {
    if (!input.trim() || loading) return

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/ioc/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          value: input.trim()
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      const newResult: IOCResult = {
        indicator: input.trim(),
        type: detectIOCType(input.trim()),
        analysis: data,
        timestamp: new Date().toISOString(),
      }
      setResults((prev) => [newResult, ...prev])
      setInput("")
      
      setActiveTabs(prev => ({
        ...prev,
        [newResult.timestamp]: "overview"
      }))
    } catch (error) {
      console.error("IOC analysis error:", error)
      const errorResult: IOCResult = {
        indicator: input.trim(),
        type: detectIOCType(input.trim()),
        analysis: { error: "Failed to analyze IOC. Make sure your backend is running." },
        timestamp: new Date().toISOString(),
      }
      setResults((prev) => [errorResult, ...prev])
    } finally {
      setLoading(false)
    }
  }

  const detectIOCType = (value: string): string => {
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return "IP Address"
    if (/^[a-fA-F0-9]{32}$/.test(value)) return "MD5 Hash"
    if (/^[a-fA-F0-9]{40}$/.test(value)) return "SHA1 Hash"
    if (/^[a-fA-F0-9]{64}$/.test(value)) return "SHA256 Hash"
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return "Domain"
    return "Unknown"
  }

  const setActiveTab = (resultTimestamp: string, tab: string) => {
    setActiveTabs(prev => ({
      ...prev,
      [resultTimestamp]: tab
    }))
  }

  const renderAnalysisResult = (result: IOCResult) => {
    const { analysis } = result
    const activeTab = activeTabs[result.timestamp] || "overview"
    
    if (analysis.error) {
      return (
        <div className="text-red-400 p-4 bg-red-900/20 rounded-lg">
          <p>Error: {analysis.error}</p>
          <p className="text-sm mt-2">Make sure your backend server is running at {API_BASE}</p>
        </div>
      )
    }

    // Extract data from the response structure
    const virustotalData = analysis.virustotal?.data || analysis.virustotal
    const otxData = analysis.otx

    return (
      <div className="space-y-6">
        <div className="flex space-x-2 mb-4 border-b border-gray-700">
          <button 
            className={`px-4 py-2 text-sm border-b-2 ${activeTab === "overview" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-400 hover:text-white"}`}
            onClick={() => setActiveTab(result.timestamp, "overview")}
          >
            Overview
          </button>
          <button 
            className={`px-4 py-2 text-sm border-b-2 ${activeTab === "otx" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-400 hover:text-white"}`}
            onClick={() => setActiveTab(result.timestamp, "otx")}
          >
            OTX Details
          </button>
          <button 
            className={`px-4 py-2 text-sm border-b-2 ${activeTab === "virustotal" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-400 hover:text-white"}`}
            onClick={() => setActiveTab(result.timestamp, "virustotal")}
          >
            VirusTotal Details
          </button>
          <button 
            className={`px-4 py-2 text-sm border-b-2 ${activeTab === "raw" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-400 hover:text-white"}`}
            onClick={() => setActiveTab(result.timestamp, "raw")}
          >
            Raw Data
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-cyan-400 font-semibold mb-2">Indicator Details</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-400">Type:</span> {result.type}</p>
                  <p><span className="text-gray-400">Indicator:</span> {result.indicator}</p>
                  {otxData?.type_title && (
                    <p><span className="text-gray-400">OTX Type:</span> {otxData.type_title}</p>
                  )}
                  {otxData?.asn && (
                    <p><span className="text-gray-400">ASN:</span> {otxData.asn}</p>
                  )}
                  {virustotalData?.as_owner && (
                    <p><span className="text-gray-400">AS Owner:</span> {virustotalData.as_owner}</p>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-cyan-400 font-semibold mb-2">Reputation Score</h4>
                {virustotalData?.attributes?.reputation !== undefined ? (
                  <div className={`text-2xl font-bold ${
                    virustotalData.attributes.reputation > 0 ? 'text-green-400' : 
                    virustotalData.attributes.reputation < 0 ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {virustotalData.attributes.reputation}
                  </div>
                ) : otxData?.reputation !== undefined ? (
                  <div className={`text-2xl font-bold ${
                    otxData.reputation > 0 ? 'text-green-400' : 
                    otxData.reputation < 0 ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {otxData.reputation}
                  </div>
                ) : (
                  <p className="text-gray-400">No reputation data available</p>
                )}
                
                {virustotalData?.attributes?.last_analysis_stats && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-green-400">Harmless: {virustotalData.attributes.last_analysis_stats.harmless}</div>
                    <div className="text-red-400">Malicious: {virustotalData.attributes.last_analysis_stats.malicious}</div>
                    <div className="text-yellow-400">Suspicious: {virustotalData.attributes.last_analysis_stats.suspicious}</div>
                    <div className="text-gray-400">Undetected: {virustotalData.attributes.last_analysis_stats.undetected}</div>
                  </div>
                )}
              </div>
            </div>

            {/* VirusTotal Analysis */}
            {virustotalData && (
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-cyan-400 font-semibold mb-2">VirusTotal Analysis</h4>
                
                <div className="space-y-4">
                  {/* Network Information */}
                  {virustotalData.attributes?.network && (
                    <div>
                      <h5 className="text-gray-400 font-medium mb-1">Network Information</h5>
                      <div className="text-sm">
                        <p><span className="text-gray-400">Network:</span> {virustotalData.attributes.network}</p>
                        {virustotalData.attributes.asn && (
                          <p><span className="text-gray-400">ASN:</span> {virustotalData.attributes.asn}</p>
                        )}
                        {virustotalData.attributes.regional_internet_registry && (
                          <p><span className="text-gray-400">RIR:</span> {virustotalData.attributes.regional_internet_registry}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Popularity Ranks */}
                  {virustotalData.attributes?.popularity_ranks && (
                    <div>
                      <h5 className="text-gray-400 font-medium mb-1">Popularity Ranks</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {Object.entries(virustotalData.attributes.popularity_ranks).map(([source, data]: [string, any]) => (
                          <div key={source} className="bg-gray-800/50 p-2 rounded">
                            <div className="text-cyan-400">{source}</div>
                            <div className="text-white">Rank: {data.rank}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Last Analysis Results Summary */}
                  {virustotalData.attributes?.last_analysis_stats && (
                    <div>
                      <h5 className="text-gray-400 font-medium mb-1">Analysis Summary</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-green-500/20 rounded-lg">
                          <div className="text-2xl font-bold text-green-400">{virustotalData.attributes.last_analysis_stats.harmless}</div>
                          <div className="text-sm text-green-300">Harmless</div>
                        </div>
                        <div className="text-center p-3 bg-red-500/20 rounded-lg">
                          <div className="text-2xl font-bold text-red-400">{virustotalData.attributes.last_analysis_stats.malicious}</div>
                          <div className="text-sm text-red-300">Malicious</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-500/20 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-400">{virustotalData.attributes.last_analysis_stats.suspicious}</div>
                          <div className="text-sm text-yellow-300">Suspicious</div>
                        </div>
                        <div className="text-center p-3 bg-gray-500/20 rounded-lg">
                          <div className="text-2xl font-bold text-gray-400">{virustotalData.attributes.last_analysis_stats.undetected}</div>
                          <div className="text-sm text-gray-300">Undetected</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OTX Analysis */}
            {otxData && (
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-cyan-400 font-semibold mb-2">AlienVault OTX Analysis</h4>
                
                {otxData.pulse_info && otxData.pulse_info.count > 0 ? (
                  <div className="space-y-2">
                    <p className="text-red-400 font-medium">Found in {otxData.pulse_info.count} threat intelligence pulses</p>
                    <div className="flex flex-wrap gap-2">
                      {otxData.pulse_info.pulses.slice(0, 5).map((pulse: any, idx: number) => (
                        <span key={idx} className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                          {pulse.name}
                        </span>
                      ))}
                      {otxData.pulse_info.count > 5 && (
                        <span className="bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs">
                          +{otxData.pulse_info.count - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-green-400">No known threats detected in OTX</p>
                )}
                
                {otxData.validation && otxData.validation.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-gray-400 font-medium mb-1">Validation</h5>
                    <div className="flex flex-wrap gap-2">
                      {otxData.validation.map((validation: any, idx: number) => (
                        <span key={idx} className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                          {validation.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {otxData.false_positive && otxData.false_positive.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-gray-400 font-medium mb-1">False Positives</h5>
                    <div className="text-sm text-yellow-400">
                      {otxData.false_positive.length} false positive reports
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WHOIS Information */}
            {virustotalData?.attributes?.whois && (
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-cyan-400 font-semibold mb-2">WHOIS Information</h4>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                  {virustotalData.attributes.whois}
                </pre>
              </div>
            )}

            {/* SSL Certificate Information */}
            {virustotalData?.attributes?.last_https_certificate && (
              <div className="bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-cyan-400 font-semibold mb-2">SSL Certificate</h4>
                <div className="text-sm space-y-2">
                  <p><span className="text-gray-400">Subject:</span> {virustotalData.attributes.last_https_certificate.subject.CN}</p>
                  <p><span className="text-gray-400">Issuer:</span> {virustotalData.attributes.last_https_certificate.issuer.O}</p>
                  <p><span className="text-gray-400">Valid From:</span> {virustotalData.attributes.last_https_certificate.validity.not_before}</p>
                  <p><span className="text-gray-400">Valid Until:</span> {virustotalData.attributes.last_https_certificate.validity.not_after}</p>
                  <p><span className="text-gray-400">Serial Number:</span> {virustotalData.attributes.last_https_certificate.serial_number}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "otx" && (
          <div className="bg-gray-900/50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <h4 className="text-cyan-400 font-semibold mb-2">OTX Raw Data</h4>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(otxData, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === "virustotal" && (
          <div className="bg-gray-900/50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <h4 className="text-cyan-400 font-semibold mb-2">VirusTotal Raw Data</h4>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(virustotalData, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === "raw" && (
          <div className="bg-gray-900/50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <h4 className="text-cyan-400 font-semibold mb-2">Complete Raw Data</h4>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <TopNavigation />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">IOC Analyzer</h1>
          <p className="text-gray-400">Analyze Indicators of Compromise using OTX and VirusTotal</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-8 border border-cyan-500/20"
        >
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="Enter IP address, domain, or hash..."
              className="flex-1 bg-gray-900/50 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !input.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>Analyze</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        <div className="space-y-6">
          {results.map((result, index) => (
            <motion.div
              key={`${result.indicator}-${result.timestamp}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-cyan-500/20"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-cyan-400">{result.indicator}</h3>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-gray-400 text-sm">{result.type}</span>
                    <span className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {result.analysis.virustotal?.data?.attributes?.reputation > 0 && (
                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">Good Reputation</span>
                  )}
                  {result.analysis.virustotal?.data?.attributes?.reputation < 0 && (
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">Poor Reputation</span>
                  )}
                  {result.analysis.otx?.pulse_info?.count > 0 && (
                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                      {result.analysis.otx.pulse_info.count} Threat Pulses
                    </span>
                  )}
                </div>
              </div>

              {renderAnalysisResult(result)}
            </motion.div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">🔍</div>
            <p>Enter an IOC above to start analyzing</p>
            <p className="text-sm mt-2">Make sure your backend server is running at {API_BASE}</p>
          </motion.div>
        )}
      </div>

      <ChatbotPopup />
    </div>
  )
}
