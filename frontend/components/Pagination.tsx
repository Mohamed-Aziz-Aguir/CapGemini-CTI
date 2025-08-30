"use client"

export default function Pagination({
  pagination,
  onPageChange,
}: { pagination: any; onPageChange: (n: number) => void }) {
  const { current_page, total_pages, has_next, has_previous, next_page, previous_page } = pagination
  return (
    <div className="flex gap-2 mt-4 justify-center">
      <button
        className="px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white hover:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        disabled={!has_previous}
        onClick={() => onPageChange(previous_page)}
      >
        Prev
      </button>
      <div className="px-4 py-2 bg-cyan-600/20 border border-cyan-500/50 rounded-lg text-cyan-300">
        Page {current_page} / {total_pages}
      </div>
      <button
        className="px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white hover:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        disabled={!has_next}
        onClick={() => onPageChange(next_page)}
      >
        Next
      </button>
    </div>
  )
}
