import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Plus, Trash2, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

const MAX_MESSAGE_LENGTH = 4000

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface Session {
  session_id: string
  last_message_at: string
  message_count: number
}

interface ChatHistoryResponse {
  sessions?: Session[]
  messages?: Message[]
  session_id?: string
}

interface ChatResponse {
  session_id: string
  response: string
  message_id: string
}

export function ChatPage() {
  const { token } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Decode JWT to get tenantId
  const tenantId = token ? JSON.parse(atob(token.split('.')[1])).sub : null

  // Load sessions on mount
  useEffect(() => {
    if (tenantId) {
      loadSessions()
    }
  }, [tenantId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadSessions = async () => {
    if (!tenantId) return

    setIsLoadingSessions(true)
    const response = await api.get<ChatHistoryResponse>(`/api/chat/${tenantId}/history`)

    if (response.success && response.data?.sessions) {
      setSessions(response.data.sessions)
    }
    setIsLoadingSessions(false)
  }

  const loadMessages = async (sessionId: string) => {
    if (!tenantId) return

    setIsLoadingMessages(true)
    const response = await api.get<ChatHistoryResponse>(
      `/api/chat/${tenantId}/history?session_id=${sessionId}&limit=50`
    )

    if (response.success && response.data?.messages) {
      setMessages(response.data.messages)
    }
    setIsLoadingMessages(false)
  }

  const handleSessionClick = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    loadMessages(sessionId)
  }

  const handleNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setInputMessage('')
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!tenantId) return
    if (!confirm('Delete this conversation? This cannot be undone.')) return

    const response = await api.delete(`/api/chat/${tenantId}/history/${sessionId}`)

    if (response.success) {
      setSessions(sessions.filter(s => s.session_id !== sessionId))
      if (currentSessionId === sessionId) {
        handleNewChat()
      }
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputMessage.trim() || isSending || !tenantId) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsSending(true)

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await api.post<ChatResponse>(
        `/api/chat/${tenantId}`,
        {
          message: userMessage,
          session_id: currentSessionId || undefined,
        }
      )

      if (response.success && response.data) {
        const { session_id, response: aiResponse, message_id } = response.data

        // Update session ID if new session
        if (!currentSessionId) {
          setCurrentSessionId(session_id)
          loadSessions() // Refresh session list
        }

        // Add AI response
        const aiMessage: Message = {
          id: message_id,
          role: 'assistant',
          content: aiResponse,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
        alert(response.error || 'Failed to send message')
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
      alert('Network error. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const characterCount = inputMessage.length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Chat">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">AI Assistant</span>
        </div>
      </Header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Session List */}
        <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`group relative px-3 py-3 cursor-pointer transition-colors ${
                      currentSessionId === session.session_id
                        ? 'bg-blue-50 border-l-2 border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleSessionClick(session.session_id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {session.session_id.slice(0, 8)}...
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {session.message_count} msg{session.message_count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {getRelativeTime(session.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session.session_id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a conversation</h3>
                  <p className="text-sm text-gray-500">
                    Ask me anything. I'm here to help with your questions and tasks.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-2xl px-4 py-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                      title={formatTimestamp(message.created_at)}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-2xl px-4 py-3 rounded-lg bg-white border border-gray-200">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                        <span className="text-sm text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white p-4">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  disabled={isSending}
                  className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  style={{
                    minHeight: '52px',
                    maxHeight: '120px',
                    height: 'auto',
                  }}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                  }}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-2">
                  {characterCount > MAX_MESSAGE_LENGTH * 0.8 && (
                    <span
                      className={`text-xs ${
                        characterCount > MAX_MESSAGE_LENGTH ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {characterCount}/{MAX_MESSAGE_LENGTH}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={
                      !inputMessage.trim() ||
                      isSending ||
                      characterCount > MAX_MESSAGE_LENGTH
                    }
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    title="Send message (Enter)"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
