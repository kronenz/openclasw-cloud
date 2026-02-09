import { useState, useEffect } from 'react'
import {
  MessageCircle,
  Hash,
  Gamepad2,
  MessageSquare,
  Phone,
  Globe,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'
import { api } from '@/lib/api'

interface Integration {
  platform: string
  status: string
}

interface IntegrationPlatform {
  id: string
  name: string
  icon: typeof MessageCircle
  color: string
  description: string
  fields: Array<{
    name: string
    label: string
    type: string
    placeholder: string
    required: boolean
  }>
}

const platforms: IntegrationPlatform[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: MessageCircle,
    color: 'text-blue-500',
    description: 'Connect your Telegram bot to receive messages',
    fields: [
      {
        name: 'bot_token',
        label: 'Bot Token',
        type: 'text',
        placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
        required: true,
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: Hash,
    color: 'text-purple-500',
    description: 'Integrate with Slack workspace',
    fields: [
      {
        name: 'bot_token',
        label: 'Bot Token',
        type: 'text',
        placeholder: 'xoxb-...',
        required: true,
      },
      {
        name: 'signing_secret',
        label: 'Signing Secret (Optional)',
        type: 'text',
        placeholder: 'abc123...',
        required: false,
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: Gamepad2,
    color: 'text-indigo-500',
    description: 'Connect your Discord bot',
    fields: [
      {
        name: 'bot_token',
        label: 'Bot Token',
        type: 'text',
        placeholder: 'MTk4NjIyNDgzNDcxOTI1MjQ4.G...',
        required: true,
      },
      {
        name: 'application_id',
        label: 'Application ID',
        type: 'text',
        placeholder: '1234567890123456789',
        required: true,
      },
    ],
  },
  {
    id: 'kakaotalk',
    name: 'KakaoTalk',
    icon: MessageSquare,
    color: 'text-yellow-600',
    description: '카카오톡 비즈니스 채널 연동',
    fields: [
      {
        name: 'api_key',
        label: 'API Key',
        type: 'text',
        placeholder: 'Your KakaoTalk API key',
        required: true,
      },
      {
        name: 'bot_id',
        label: 'Bot ID (Optional)',
        type: 'text',
        placeholder: 'Bot identifier',
        required: false,
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: Phone,
    color: 'text-green-500',
    description: 'WhatsApp Business API integration',
    fields: [
      {
        name: 'phone_number_id',
        label: 'Phone Number ID',
        type: 'text',
        placeholder: '1234567890',
        required: true,
      },
      {
        name: 'access_token',
        label: 'Access Token',
        type: 'text',
        placeholder: 'EAABsb...',
        required: true,
      },
    ],
  },
  {
    id: 'webchat',
    name: 'Web Chat',
    icon: Globe,
    color: 'text-gray-600',
    description: 'Embed chat widget on your website',
    fields: [],
  },
]

function decodeTokenPayload(token: string): { sub?: string } {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return {}
  }
}

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<IntegrationPlatform | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null)

  const token = localStorage.getItem('auth_token')
  const payload = token ? decodeTokenPayload(token) : {}
  const tenantId = payload.sub

  useEffect(() => {
    fetchIntegrations()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const fetchIntegrations = async () => {
    if (!tenantId) return

    setLoading(true)
    try {
      const res = await api.get<{ integrations: Integration[] }>(
        `/api/tenants/${tenantId}/integrations`
      )
      if (res.success && res.data) {
        setIntegrations(res.data.integrations)
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const isConnected = (platformId: string) => {
    return integrations.some((int) => int.platform === platformId && int.status === 'active')
  }

  const handleConnect = (platform: IntegrationPlatform) => {
    setSelectedPlatform(platform)
    setFormData({})
  }

  const handleDisconnect = (platformId: string) => {
    setConfirmDisconnect(platformId)
  }

  const confirmDisconnectAction = async () => {
    if (!tenantId || !confirmDisconnect) return

    setSubmitting(true)
    try {
      const res = await api.delete(`/api/tenants/${tenantId}/integrations/${confirmDisconnect}`)
      if (res.success) {
        setToast({ type: 'success', message: `${confirmDisconnect} disconnected successfully` })
        fetchIntegrations()
      } else {
        setToast({ type: 'error', message: res.error || 'Failed to disconnect' })
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Network error occurred' })
    } finally {
      setSubmitting(false)
      setConfirmDisconnect(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !selectedPlatform) return

    setSubmitting(true)
    try {
      const res = await api.put(
        `/api/tenants/${tenantId}/integrations/${selectedPlatform.id}`,
        formData
      )
      if (res.success) {
        setToast({ type: 'success', message: `${selectedPlatform.name} connected successfully` })
        setSelectedPlatform(null)
        setFormData({})
        fetchIntegrations()
      } else {
        setToast({ type: 'error', message: res.error || 'Failed to connect' })
      }
    } catch (error) {
      setToast({ type: 'error', message: 'Network error occurred' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Integrations" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-gray-600 mb-6">메신저 플랫폼을 연결하여 AI 비서를 활성화하세요</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platforms.map((platform) => {
              const connected = isConnected(platform.id)
              const Icon = platform.icon

              return (
                <div
                  key={platform.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center">
                        <Icon className={`w-6 h-6 ${platform.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{platform.name}</h3>
                        <StatusBadge
                          status={connected ? 'Connected' : 'Not connected'}
                          variant={connected ? 'success' : 'neutral'}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{platform.description}</p>

                  <div className="flex gap-2">
                    {connected ? (
                      <button
                        onClick={() => handleDisconnect(platform.id)}
                        className="flex-1 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform)}
                        disabled={platform.id === 'webchat'}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {platform.id === 'webchat' ? 'Coming Soon' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Connection Modal */}
      {selectedPlatform && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Connect {selectedPlatform.name}
              </h2>
              <button
                onClick={() => setSelectedPlatform(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {selectedPlatform.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.name]: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedPlatform(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Confirm Disconnect</h2>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to disconnect {confirmDisconnect}? Your bot will stop
              receiving messages from this platform.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDisconnect(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnectAction}
                disabled={submitting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <p
              className={`text-sm font-medium ${
                toast.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {toast.message}
            </p>
            <button
              onClick={() => setToast(null)}
              className={`ml-2 ${
                toast.type === 'success' ? 'text-green-600' : 'text-red-600'
              } hover:opacity-75`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
