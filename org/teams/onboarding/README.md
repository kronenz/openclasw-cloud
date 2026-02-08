# Onboarding 팀

## 미션
신규 고객의 테넌트 프로비저닝 및 초기 설정 완료

## 소속 에이전트

| ID | 이름 | Claude Agent | 모델 | 역할 |
|----|------|-------------|------|------|
| A-ONB-001 | 프로비저닝 플래너 | planner | Opus | 온보딩 계획 수립 |
| A-ONB-002 | 프로비저너 | executor | Sonnet | Container/인스턴스 생성 |
| A-ONB-003 | 온보딩 검증자 | qa-tester | Sonnet | 프로비저닝 결과 검증 |

## 담당 파이프라인
- **P-002: 온보딩 파이프라인**

## 주요 업무

### 프로비저닝 플래너 (A-ONB-001)
- sales 팀 인계 사항 분석
- 테넌트 리소스 산정 (Container, D1, KV, R2 용량)
- 온보딩 작업 순서 계획
- 리스크 식별 및 롤백 계획 수립

### 프로비저너 (A-ONB-002)
- Cloudflare Workers 배포
- Container 인스턴스 생성 및 구성
- D1 데이터베이스 초기화
- KV 네임스페이스 생성
- R2 버킷 설정
- AI Gateway 엔드포인트 생성
- 초기 관리자 계정 생성

### 온보딩 검증자 (A-ONB-003)
- 프로비저닝 완료 검증
- 헬스체크 테스트
- 기본 기능 동작 확인
- persona 팀에 인계 문서 작성

## 사용 Cloudflare 서비스
- **Workers**: AI 에이전트 실행 환경
- **Containers**: 고객별 격리 환경
- **D1**: 테넌트 메타데이터 저장
- **KV**: 세션/설정 저장
- **R2**: 파일/로그 저장
- **AI Gateway**: Claude API 라우팅

## Human Gate 조건

**프로덕션 프로비저닝 시작 전 승인 필요**

- 프로비저닝 계획 최종 승인
- 리소스 할당량 확정
- 비용 임계값 설정

## 관련 매뉴얼
- [온보딩 매뉴얼](../../manuals/onboarding-manual.md)

## 협업 팀
- **sales**: 고객 요구사항 인수
- **persona**: 온보딩 완료 후 SOUL 설정 인계
- **platform**: 인프라 이슈 발생 시 협력
- **operations**: 프로비저닝 로그 및 비용 모니터링

## 워크플로우 예시

```
sales 팀에서 인계
  ↓
[A-ONB-001] 프로비저닝 계획 수립
  ↓
[HUMAN GATE] 계획 승인
  ↓
[A-ONB-002] Workers/Container/D1/KV/R2 생성
  ↓
[A-ONB-002] 관리자 계정 생성
  ↓
[A-ONB-003] 헬스체크 및 기능 검증
  ↓
[A-ONB-003] 인계 문서 작성
  ↓
persona 팀에 인계
```

## 프로비저닝 체크리스트
- [ ] Workers 배포 완료
- [ ] Container 인스턴스 실행 중
- [ ] D1 테이블 스키마 생성
- [ ] KV 네임스페이스 바인딩
- [ ] R2 버킷 접근 가능
- [ ] AI Gateway 엔드포인트 응답
- [ ] 관리자 로그인 가능
- [ ] 헬스체크 API 200 OK
