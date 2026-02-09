import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  MessageSquare,
  Users,
  BarChart3,
  Zap,
  Shield,
  Check,
  ChevronDown,
  ArrowRight,
  Sparkles
} from 'lucide-react'

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">OpenClaw</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">기능</a>
              <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900">사용 방법</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">요금제</a>
              <a href="#faq" className="text-sm text-gray-600 hover:text-gray-900">FAQ</a>
            </nav>
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              로그인
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>AI 기반 비즈니스 자동화</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI 비서로<br />비즈니스를 자동화하세요
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              카카오톡, 텔레그램, 슬랙, 디스코드에서 동작하는 맞춤형 AI 비서로<br />
              고객 응대, 업무 처리, 데이터 분석을 자동화하세요
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 text-base font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                사용 방법 보기
              </a>
            </div>
            <p className="text-sm text-gray-500 mt-6">
              신용카드 없이 시작 가능 · 5분 안에 설정 완료
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              OpenClaw의 핵심 기능
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              비즈니스 자동화를 위한 모든 것을 갖춘 플랫폼
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                멀티 메신저 통합
              </h3>
              <p className="text-gray-600">
                카카오톡, 텔레그램, 슬랙, 디스코드에서 하나의 AI 비서로 고객과 소통하세요
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100">
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI 맞춤 페르소나
              </h3>
              <p className="text-gray-600">
                SOUL.md로 브랜드 어조, 업무 프로세스, 지식 베이스를 정의하세요
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl border border-green-100">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                실시간 모니터링
              </h3>
              <p className="text-gray-600">
                대화 품질, 응답 속도, 고객 만족도를 실시간으로 추적하세요
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl border border-orange-100">
              <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                합리적인 요금제
              </h3>
              <p className="text-gray-600">
                사용한 만큼만 지불하고, 언제든 플랜을 변경할 수 있습니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              3단계로 시작하세요
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              복잡한 설정 없이 5분 안에 AI 비서를 운영하세요
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-2xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  가입 및 조직 생성
                </h3>
                <p className="text-gray-600">
                  이메일로 가입하고 조직을 생성하세요. 무료 플랜으로 바로 시작할 수 있습니다
                </p>
              </div>
              {/* Arrow for desktop */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="w-8 h-8 text-gray-300" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-2xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  SOUL.md 작성
                </h3>
                <p className="text-gray-600">
                  AI 비서의 성격, 지식, 업무 프로세스를 정의하세요. 템플릿을 제공합니다
                </p>
              </div>
              {/* Arrow for desktop */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="w-8 h-8 text-gray-300" />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-2xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  메신저 연동
                </h3>
                <p className="text-gray-600">
                  카카오톡, 텔레그램, 슬랙, 디스코드에 봇을 연결하고 고객과 대화를 시작하세요
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              합리적인 요금제
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              비즈니스 규모에 맞는 플랜을 선택하세요
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">무료</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">월 1,000 메시지</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">1개 메신저 연동</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">기본 SOUL.md 템플릿</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">커뮤니티 지원</span>
                </li>
              </ul>
              <Link
                to="/login"
                className="block w-full py-3 text-center bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                무료로 시작하기
              </Link>
            </div>

            {/* Growth Plan */}
            <div className="bg-blue-600 text-white rounded-2xl p-8 shadow-xl transform scale-105 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  인기
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Growth</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">₩49,000</span>
                <span className="text-blue-100">/월</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                  <span>월 50,000 메시지</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                  <span>무제한 메신저 연동</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                  <span>고급 SOUL.md 에디터</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                  <span>실시간 대시보드</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                  <span>우선 이메일 지원</span>
                </li>
              </ul>
              <Link
                to="/login"
                className="block w-full py-3 text-center bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
              >
                시작하기
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">문의</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">무제한 메시지</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">전용 인프라</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">커스텀 통합</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">전담 매니저</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">SLA 보장</span>
                </li>
              </ul>
              <button className="block w-full py-3 text-center bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
                영업팀 문의
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              자주 묻는 질문
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'OpenClaw는 어떤 메신저를 지원하나요?',
                a: '카카오톡, 텔레그램, 슬랙, 디스코드를 지원합니다. 각 메신저에서 동일한 AI 비서를 운영할 수 있으며, 통합 대시보드에서 모든 대화를 관리할 수 있습니다.'
              },
              {
                q: 'SOUL.md는 무엇인가요?',
                a: 'SOUL.md는 AI 비서의 페르소나를 정의하는 문서입니다. 브랜드 어조, 업무 프로세스, 지식 베이스, 응답 가이드라인을 작성하면 AI가 이를 학습하여 일관된 응대를 제공합니다.'
              },
              {
                q: '무료 플랜으로 얼마나 사용할 수 있나요?',
                a: 'Starter 플랜은 월 1,000개의 메시지와 1개의 메신저 연동을 무료로 제공합니다. 신용카드 등록 없이 바로 시작할 수 있습니다.'
              },
              {
                q: '데이터는 안전하게 보관되나요?',
                a: 'OpenClaw는 Cloudflare 인프라 위에 구축되어 있으며, 모든 데이터는 암호화되어 저장됩니다. 고객별로 완전히 격리된 환경에서 운영되며, GDPR 및 KISA 가이드라인을 준수합니다.'
              },
              {
                q: '플랜은 언제든 변경할 수 있나요?',
                a: '네, 언제든 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경 사항은 다음 결제 주기부터 적용되며, 일할 계산으로 환불 또는 추가 청구됩니다.'
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      openFaq === index ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-gray-600">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            5분 안에 설정을 완료하고 AI 비서로 비즈니스를 자동화하세요
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 text-base font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            무료로 시작하기
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">OpenClaw</span>
              </div>
              <p className="text-sm">
                AI 비서로 비즈니스를 자동화하는<br />차세대 플랫폼
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold mb-3">제품</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">기능</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">요금제</a></li>
                <li><a href="#" className="hover:text-white transition-colors">통합</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-semibold mb-3">회사</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">소개</a></li>
                <li><a href="#" className="hover:text-white transition-colors">블로그</a></li>
                <li><a href="#" className="hover:text-white transition-colors">채용</a></li>
                <li><a href="#" className="hover:text-white transition-colors">문의</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold mb-3">법적 고지</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">이용약관</a></li>
                <li><a href="#" className="hover:text-white transition-colors">개인정보처리방침</a></li>
                <li><a href="#" className="hover:text-white transition-colors">보안</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">
              © 2026 OpenClaw. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm">Powered by Cloudflare</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
