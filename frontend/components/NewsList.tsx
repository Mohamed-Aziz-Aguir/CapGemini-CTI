export default function NewsList({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <div className="text-gray-400">No news found.</div>
  return (
    <div className="space-y-3">
      {items.map((n, idx) => (
        <article
          key={n.id || n._id || idx}
          className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 hover:border-cyan-500/30 transition-all duration-300"
        >
          <a href={n.link || n.url || "#"} target="_blank" rel="noreferrer" className="block">
            <h4 className="font-medium text-sm text-white hover:text-cyan-400 transition-colors">
              {n.title || n.headline || n.name}
            </h4>
            <div className="text-xs text-gray-400 mt-1">{n.pubDate || n.published || n.date || ""}</div>
            <div
              className="text-sm text-gray-300 mt-2 line-clamp-3"
              dangerouslySetInnerHTML={{ __html: n.summary || n.description || "" }}
            />
          </a>
        </article>
      ))}
    </div>
  )
}
