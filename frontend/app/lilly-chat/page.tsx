// pages/lilly/page.tsx
// Full file — drop into /pages/lilly/page.tsx (keeps UI/CSS intact; fixes streaming + id collisions)
"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import TopNavigation from "../../components/TopNavigation";
import ChatbotPopup from "../../components/ChatbotPopup";
import { streamChatLilly, clearLilly } from "../../lib/lillyApi";

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

/** Client-side token cleaning */
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

export default function LillyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    // push user bubble (unique id)
    const userId = makeId("user");
    setMessages((prev) => [...prev, { id: userId, type: "user", content: userMessage, timestamp: new Date() }]);

    // assistant placeholder with unique id
    const assistantId = makeId("assistant");
    setMessages((prev) => [...prev, { id: assistantId, type: "bot", content: "", timestamp: new Date() }]);

    setLoading(true);

    try {
      await streamChatLilly(userMessage, (token: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: (m.content || "") + cleanTokenForStream(token, m.content || "") } : m
          )
        );
        scrollToBottom();
      });
    } catch (error) {
      console.error("Chat streaming error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Sorry, I encountered an error. Please try again." } : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const clearChatHandler = async () => {
    try {
      await clearLilly();
    } catch (err) {
      console.error("Clear chat server error:", err);
    } finally {
      setMessages([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      <TopNavigation />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">Lilly AI Assistant</h1>
          <p className="text-gray-400">Your cybersecurity AI companion for threat analysis and insights</p>
        </motion.div>

        {/* Chat Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-cyan-500/20 flex flex-col"
        >
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-cyan-400 font-semibold">Lilly AI Online</span>
            </div>
            <button
              onClick={clearChatHandler}
              className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              Clear Chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-lg mb-2">Hello! I'm Lilly, your cybersecurity AI assistant.</p>
                <p className="text-sm">Ask me about threats, vulnerabilities, or any cybersecurity topic!</p>
              </div>
            )}

            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-3xl px-4 py-3 rounded-lg ${
                    message.type === "user" ? "bg-cyan-500 text-white" : "bg-gray-700 text-gray-100"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className={`text-xs mt-2 ${message.type === "user" ? "text-cyan-100" : "text-gray-400"}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-100 px-4 py-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <span className="text-sm text-gray-400 ml-2">Lilly is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask Lilly about cybersecurity..."
                className="flex-1 bg-gray-900/50 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <ChatbotPopup />
    </div>
  );
}

