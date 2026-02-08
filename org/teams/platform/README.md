# Platform 팀

## 미션
Cloudflare 인프라 관리 및 대시보드 운영

## 소속 에이전트

| ID | 이름 | Claude Agent | 모델 | 역할 |
|----|------|-------------|------|------|
| A-PLT-001 | 인프라 엔지니어 | executor | Sonnet | CF 인프라 관리 |
| A-PLT-002 | 빌드 수리공 | build-fixer | Sonnet | 빌드/배포 오류 수정 |

## 담당 파이프라인
- **P-006: 플랫폼 운영 파이프라인**

## 주요 업무

### 인프라 엔지니어 (A-PLT-001)
- Workers 배포 및 롤백
- Wrangler 설정 관리
- Pages 프론트엔드 배포
- D1/KV/R2 스키마 마이그레이션
- AI Gateway 설정 변경
- DNS/CDN 설정 관리
- 대시보드 개발 및 업데이트

### 빌드 수리공 (A-PLT-002)
- CI/CD 파이프라인 오류 수정
- TypeScript 타입 오류 해결
- 의존성 충돌 해결
- Wrangler 빌드 실패 디버깅
- 배포 스크립트 최적화

## 관리 대상 Cloudflare 서비스
- **Workers**: AI 에이전트 런타임
- **Containers**: 고객 격리 환경
- **Pages**: 관리자 대시보드
- **D1**: 전사 데이터베이스
- **KV**: 전사 설정/캐시
- **R2**: 전사 파일 스토리지
- **AI Gateway**: Claude API 게이트웨이
- **Workers Logs**: 전사 로그 수집
- **Stream**: 미디어 스트리밍 (선택)
- **Images**: 이미지 최적화 (선택)

## 사용 도구
- **Wrangler**: CLI 배포 도구
- **GitHub Actions**: CI/CD
- **Terraform**: IaC (선택)

## Human Gate 조건

**프로덕션 배포는 반드시 승인 필요**

- Workers 프로덕션 배포
- D1 스키마 변경
- DNS 레코드 변경
- AI Gateway 라우팅 규칙 변경
- KV 글로벌 삭제

스테이징 배포는 자동 실행 가능.

## 관련 매뉴얼
- 매뉴얼 없음 (내부 운영)
- 참고: [Cloudflare Docs](https://developers.cloudflare.com)

## 협업 팀
- **onboarding**: 신규 테넌트 인프라 요청
- **operations**: 장애 대응 협력
- **skill-dev**: 스킬 배포 지원
- 모든 팀: 인프라 이슈 발생 시

## 워크플로우 예시

### 프로덕션 배포

```
코드 변경 사항 발생
  ↓
[A-PLT-002] 빌드 및 테스트
  ↓
빌드 실패 시 오류 수정
  ↓
[A-PLT-001] 스테이징 배포
  ↓
[A-PLT-001] 스모크 테스트
  ↓
[HUMAN GATE] 프로덕션 배포 승인
  ↓
[A-PLT-001] 프로덕션 배포
  ↓
[A-PLT-001] 헬스체크 확인
  ↓
operations 팀에 모니터링 요청
```

### 긴급 롤백

```
프로덕션 장애 감지
  ↓
[A-PLT-001] 즉시 이전 버전으로 롤백
  ↓
[A-PLT-001] 헬스체크 확인
  ↓
operations 팀에 인시던트 리포트
```

## 대시보드 기능
- 테넌트 목록 및 상태
- 리소스 사용량 (Workers CPU, D1 쿼리, R2 스토리지)
- 비용 현황 (팀별, 고객별)
- 배포 이력
- 에러 로그 뷰어
- AI Gateway 호출 통계
- 스킬 사용 현황

## 인프라 체크리스트
- [ ] Workers 헬스체크 통과
- [ ] D1 쿼리 응답 시간 정상
- [ ] KV 읽기/쓰기 가능
- [ ] R2 파일 업로드/다운로드 가능
- [ ] AI Gateway 200 OK
- [ ] Pages 대시보드 접속 가능
- [ ] CI/CD 파이프라인 정상
- [ ] 백업 스크립트 실행 중
