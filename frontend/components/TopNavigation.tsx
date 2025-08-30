"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"

const navItems = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/ioc-analyzer", label: "IOC Analyzer", icon: "🔍" },
  { href: "/zero-day", label: "Zero-Day Tracker", icon: "⚡" },
  { href: "/threat-catalog", label: "Threat Catalog", icon: "📊" },
  { href: "/lilly-chat", label: "Lilly AI", icon: "🤖" },
]

export default function TopNavigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-gray-900/95 backdrop-blur-sm border-b border-cyan-500/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-cyan-400">CTI Dashboard</h1>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "text-cyan-400 bg-cyan-400/10"
                          : "text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50"
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"
                          initial={false}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
