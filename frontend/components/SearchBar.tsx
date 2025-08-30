"use client"

import { useState } from "react"

export default function SearchBar({
  onSearch,
  defaultValue = "",
}: { onSearch: (q: string) => void; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search CVE or keyword"
        className="cyber-input"
      />
      <button className="cyber-button" onClick={() => onSearch(value)}>
        Search
      </button>
    </div>
  )
}
