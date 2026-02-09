import { useState, useEffect } from 'react'
import { Loader2, Save, Sparkles, History, AlertCircle, CheckCircle } from 'lucide-react'
import { Header } from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/lib/api'

type TabType = 'survey' | 'editor' | 'versions'
type PreferredTone = 'polite' | 'friendly' | 'formal'

interface Survey {
  industry: string
  business_description?: string
  preferred_tone: PreferredTone
  preferred_language: string
  target_services?: string[]
  custom_instructions?: string
}

interface SoulData {
  version: number
  content: string
  generated_by: 'template' | 'survey' | 'manual'
  created_at: string
}

interface SoulVersion {
  version: number
  generated_by: 'template' | 'survey' | 'manual'
  created_at: string
  content: string
}

function decodeTokenPayload(token: string): { sub?: string; role?: string } {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return {}
  }
}

export function SoulPage() {
  const { token } = useAuth()
  const payload = token ? decodeTokenPayload(token) : {}
  const tenantId = payload.sub || ''

  const [activeTab, setActiveTab] = useState<TabType>('survey')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Survey state
  const [survey, setSurvey] = useState<Survey>({
    industry: 'general',
    business_description: '',
    preferred_tone: 'friendly',
    preferred_language: 'ko',
    target_services: [],
    custom_instructions: '',
  })

  // Editor state
  const [soulContent, setSoulContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')

  // Versions state
  const [versions, setVersions] = useState<SoulVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<SoulVersion | null>(null)

  useEffect(() => {
    if (activeTab === 'survey') {
      loadSurvey()
    } else if (activeTab === 'editor') {
      loadSoul()
    } else if (activeTab === 'versions') {
      loadVersions()
    }
  }, [activeTab, tenantId])

  const loadSurvey = async () => {
    setLoading(true)
    setError(null)
    try {
      const res: ApiResponse<Survey> = await api.get(`/api/tenants/${tenantId}/survey`)
      if (res.success && res.data) {
        setSurvey(res.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load survey')
    } finally {
      setLoading(false)
    }
  }

  const loadSoul = async () => {
    setLoading(true)
    setError(null)
    try {
      const res: ApiResponse<SoulData> = await api.get(`/api/tenants/${tenantId}/soul`)
      if (res.success && res.data) {
        setSoulContent(res.data.content)
        setOriginalContent(res.data.content)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SOUL.md')
    } finally {
      setLoading(false)
    }
  }

  const loadVersions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res: ApiResponse<SoulVersion[]> = await api.get(`/api/tenants/${tenantId}/soul/versions`)
      if (res.success && res.data) {
        setVersions(res.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res: ApiResponse<unknown> = await api.post(`/api/tenants/${tenantId}/survey`, survey)
      if (res.success) {
        setSuccess('Survey saved successfully!')
      } else {
        setError(res.error || 'Failed to save survey')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save survey')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSoul = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res: ApiResponse<SoulData> = await api.post(`/api/tenants/${tenantId}/soul/generate`)
      if (res.success && res.data) {
        setSuccess('SOUL.md generated successfully! Check the Editor tab.')
        setSoulContent(res.data.content)
        setOriginalContent(res.data.content)
      } else {
        setError(res.error || 'Failed to generate SOUL.md')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate SOUL.md')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSoul = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res: ApiResponse<SoulData> = await api.put(`/api/tenants/${tenantId}/soul`, {
        content: soulContent,
      })
      if (res.success) {
        setSuccess('SOUL.md saved successfully!')
        setOriginalContent(soulContent)
      } else {
        setError(res.error || 'Failed to save SOUL.md')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save SOUL.md')
    } finally {
      setLoading(false)
    }
  }

  const hasUnsavedChanges = soulContent !== originalContent

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="SOUL.md" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Alert Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('survey')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'survey'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Survey
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'editor'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setActiveTab('versions')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'versions'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Versions
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'survey' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Onboarding Survey</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Fill out this survey to generate a customized SOUL.md for your AI assistant.
                  </p>

                  <form onSubmit={handleSurveySubmit} className="space-y-6">
                    {/* Industry */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Industry <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={survey.industry}
                        onChange={(e) => setSurvey({ ...survey, industry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="cafe">Cafe</option>
                        <option value="office">Office</option>
                        <option value="shopping">Shopping</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="clinic">Clinic</option>
                        <option value="salon">Salon</option>
                        <option value="general">General</option>
                      </select>
                    </div>

                    {/* Business Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Description
                      </label>
                      <textarea
                        value={survey.business_description || ''}
                        onChange={(e) => setSurvey({ ...survey, business_description: e.target.value })}
                        placeholder="Describe your business, services, and target customers..."
                        rows={4}
                        maxLength={2000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {survey.business_description?.length || 0} / 2000 characters
                      </p>
                    </div>

                    {/* Preferred Tone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Tone <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        {(['polite', 'friendly', 'formal'] as const).map((tone) => (
                          <label key={tone} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="tone"
                              value={tone}
                              checked={survey.preferred_tone === tone}
                              onChange={(e) => setSurvey({ ...survey, preferred_tone: e.target.value as PreferredTone })}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 capitalize">{tone}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Preferred Language */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Language <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={survey.preferred_language}
                        onChange={(e) => setSurvey({ ...survey, preferred_language: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="ko">한국어 (Korean)</option>
                        <option value="en">English</option>
                        <option value="ja">日本語 (Japanese)</option>
                        <option value="zh">中文 (Chinese)</option>
                      </select>
                    </div>

                    {/* Target Services */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Services
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {['kakao', 'telegram', 'slack', 'discord', 'line', 'whatsapp'].map((service) => (
                          <label key={service} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={survey.target_services?.includes(service) || false}
                              onChange={(e) => {
                                const current = survey.target_services || []
                                if (e.target.checked) {
                                  setSurvey({ ...survey, target_services: [...current, service] })
                                } else {
                                  setSurvey({ ...survey, target_services: current.filter((s) => s !== service) })
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 capitalize">{service}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Custom Instructions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom Instructions
                      </label>
                      <textarea
                        value={survey.custom_instructions || ''}
                        onChange={(e) => setSurvey({ ...survey, custom_instructions: e.target.value })}
                        placeholder="Any specific instructions or requirements for your AI assistant..."
                        rows={4}
                        maxLength={5000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {survey.custom_instructions?.length || 0} / 5000 characters
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Survey
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateSoul}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate SOUL.md
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'editor' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">SOUL.md Editor</h3>
                    {hasUnsavedChanges && (
                      <span className="text-sm text-yellow-600">Unsaved changes</span>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      {/* Editor */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Markdown Content
                        </label>
                        <textarea
                          value={soulContent}
                          onChange={(e) => setSoulContent(e.target.value)}
                          placeholder="# SOUL.md&#10;&#10;Write your AI assistant's persona here..."
                          rows={20}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
                      </div>

                      {/* Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Preview
                        </label>
                        <div className="border border-gray-300 rounded-md p-4 bg-gray-50 min-h-[500px] overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                            {soulContent || 'No content yet. Start writing in the editor.'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="mt-6">
                    <button
                      onClick={handleSaveSoul}
                      disabled={loading || !hasUnsavedChanges}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'versions' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Version History</h3>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No versions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {versions.map((version) => (
                        <div
                          key={version.version}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedVersion?.version === version.version
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedVersion(selectedVersion?.version === version.version ? null : version)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-gray-900">
                                Version {version.version}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                version.generated_by === 'template'
                                  ? 'bg-gray-100 text-gray-700'
                                  : version.generated_by === 'survey'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {version.generated_by}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(version.created_at).toLocaleString()}
                            </span>
                          </div>
                          {selectedVersion?.version === version.version && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono bg-white p-3 rounded border border-gray-200 max-h-96 overflow-y-auto">
                                {version.content}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
