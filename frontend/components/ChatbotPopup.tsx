"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { streamChatLilly, clearLilly } from "../lib/lillyApi";

type ChatMessage = {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
};

/** Generate collision-safe IDs in browser */
function makeId(prefix = "m") {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return `${prefix}-${(crypto as any).randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Lightweight client-side token cleaning similar to server heuristics */
function cleanTokenForStream(token: string, prevText: string): string {
  if (!token) return "";

  token = token.replace(/\r/g, " ").replace(/\n/g, " ");
  token = token.replace(/\s+/g, " ");

  const hasLeadingSpace = token.startsWith(" ");
  const tokenStripped = token.replace(/^\s+/, "");
  if (tokenStripped === "") return hasLeadingSpace ? " " : "";

  const prevLast = prevText ? prevText.slice(-1) : "";
  const firstChar = tokenStripped[0];
  const noSpaceBefore = new Set([",", ".", "!", "?", ":", ";", "%", ")", "]", "}", "’", "'"]);

  if (noSpaceBefore.has(firstChar)) return tokenStripped;

  if (prevLast) {
    if (/\s/.test(prevLast)) return tokenStripped;
    if (prevLast === "'" || prevLast === "’") return tokenStripped;
    if (/[A-Za-z0-9]/.test(prevLast) && /[A-Za-z]/.test(firstChar)) {
      return " " + tokenStripped;
    }
    if (/[a-z]/.test(prevLast) && /[a-z]/.test(firstChar)) return tokenStripped;
    if (/[a-z]/.test(prevLast) && /[A-Z]/.test(firstChar)) return " " + tokenStripped;
    return tokenStripped;
  } else {
    return hasLeadingSpace ? " " + tokenStripped : tokenStripped;
  }
}

export default function ChatbotPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addMessageLocal = (content: string, type: "user" | "bot", id?: string) => {
    const newMessage: ChatMessage = {
      id: id ?? makeId(type === "user" ? "user" : "bot"),
      type,
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    // user bubble (unique id)
    const userId = makeId("user");
    setMessages((prev) => [
      ...prev,
      { id: userId, type: "user", content: userMessage, timestamp: new Date() },
    ]);

    // assistant placeholder (unique id)
    const assistantId = makeId("assistant");
    setMessages((prev) => [
      ...prev,
      { id: assistantId, type: "bot", content: "", timestamp: new Date() },
    ]);

    setLoading(true);

    try {
      // stream tokens into assistant placeholder only
      await streamChatLilly(userMessage, (token: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: (m.content || "") + cleanTokenForStream(token, m.content || "") }
              : m
          )
        );
      });
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: "Sorry, I encountered an error. Please try again." } : m))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    // clear local UI first
    setMessages([]);
    // clear server chat memory too
    try {
      await clearLilly();
    } catch (err) {
      console.error("Failed to clear Lilly server chat:", err);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow-lg z-50 flex items-center justify-center transition-all duration-200"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isOpen ? "✕" : "💬"}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-80 h-96 bg-gray-900 border border-cyan-500/20 rounded-lg shadow-2xl z-40 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-cyan-400 font-semibold">🤖 Lilly AI</span>
              </div>
              <button onClick={handleClear} className="text-gray-400 hover:text-white text-xs">
                Clear
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-gray-500 text-sm text-center">
                  Ask me anything about cybersecurity!
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      message.type === "user" ? "bg-cyan-500 text-white" : "bg-gray-700 text-gray-100"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 text-gray-100 px-3 py-2 rounded-lg text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask me anything about cybersecurity..."
                  className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}	
