import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Mail, Lock, LogIn, Shield, Key } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [mode, setMode] = useState<'form' | 'token'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // For now, just demonstrate token login since we don't have email/password endpoint
    setError('Email/password login not yet implemented. Use Token Login instead.')
    setLoading(false)
  }

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token.trim()) {
      setError('Please enter a token')
      return
    }

    setLoading(true)
    try {
      login(token)
      navigate('/dashboard')
    } catch (err) {
      setError('Invalid token')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">OpenClaw Cloud</h1>
          <p className="text-sm text-gray-500 mt-1">AI Agent Operations Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('form')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'form'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Email Login
            </button>
            <button
              onClick={() => setMode('token')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'token'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Token Login
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {mode === 'form' ? (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sign in to your account</h2>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-10 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <a href="#" className="text-xs text-blue-600 hover:text-blue-700">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full h-10 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                  Remember me
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sign in with JWT Token</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  JWT Token
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full h-10 pl-10 pr-4 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Paste your JWT authentication token
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Signing in...' : 'Sign in with Token'}
              </button>
            </form>
          )}

          {mode === 'form' && (
            <>
              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">or continue with</span>
                </div>
              </div>

              {/* SSO / Cloudflare Access */}
              <button className="w-full h-10 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" />
                Cloudflare Zero Trust SSO
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          By signing in, you agree to our{' '}
          <a href="#" className="text-gray-500 hover:text-gray-700 underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="text-gray-500 hover:text-gray-700 underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  )
}
