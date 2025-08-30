export default function Navbar() {
  return (
    <nav className="bg-gray-900/80 backdrop-blur-sm border-b border-cyan-500/30 shadow-lg">
      <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
        <div className="font-bold text-xl text-white glow-text">
          <span className="text-cyan-400">CTI</span> Dashboard
        </div>
        <div className="text-sm text-gray-300">
          Connected to backend via <span className="text-cyan-400">NEXT_PUBLIC_API_BASE_URL</span>
        </div>
      </div>
    </nav>
  )
}
