# 작업 이력

날짜는 Asia/Seoul 기준입니다. 현재 사양은 주제 문서에서 관리하며, 이 파일에는 요청과 결정·검증을 작업별로 남깁니다.

## 2026-10-08 · 004 · 지도 작업 브랜치 공유 및 Draft PR 준비

- 요청/범위: 지도 화면과 카카오 점검 작업을 팀 Git Flow에 따라 검토 가능한 상태로 정리.
- Git Flow: 지도 구현 커밋 `c4cefa9`를 `feature/1-map-workspace`에 푸시하고 [Draft PR #3](https://github.com/teojabi-groundbreakers/pickplace-frontend/pull/3)을 생성. 별도 수정 커밋 `2e9059d`의 `fix/2-kakao-tile-timeout`도 푸시하고 [Draft PR #4](https://github.com/teojabi-groundbreakers/pickplace-frontend/pull/4)를 생성. UI와 공개 GitHub API로 두 PR의 Draft 상태·대상 `develop`·작업 브랜치를 확인.
- 주요 결정: 실제 카카오 연결과 시각 검증이 남아 있으므로 Draft로 유지. 현재 작업 디렉터리는 feature 브랜치이고 카카오 타임아웃 수정은 별도 worktree에 있음. `git merge-tree --write-tree`에서 두 브랜치의 충돌 없음만 확인했으며 실제 병합이나 병합 결과 테스트는 수행하지 않음.
- 연결 재확인: 두 개발 출처의 공식 SDK 응답은 여전히 HTTP 401·도메인 불일치. REST API 키 종류 오류는 없음. 키 값을 출력·기록하지 않고 `.env` 제외를 유지.
- 검증: 구현 단계의 feature 43개·fix 33개 테스트 및 각 포맷·린트·빌드 통과 결과를 PR에 명시. 변경 파일 25개에 실제 설정 키가 없음을 확인했고 문서 링크·경로와 `git diff --check`를 확인. 후속 변경은 문서 상태 정리만이므로 앱 검증을 불필요하게 반복하지 않음.
- 남은 사항: 사용자 허용 도메인 등록 후 실제 지도·우클릭 행정동 조회·미세 이동 검증, 모바일·태블릿 시각 검증, 최소 1명 리뷰 승인과 `develop` squash merge, 병합 후 이슈·브랜치 정리. `main`·`develop` 직접 커밋/푸시·운영 배포는 하지 않음.

## 2026-10-08 · 002 · 지도 메인 화면·검색 오버레이·행정동 조회 구현

- 요청/범위: 이슈 #1의 지도 중심 첫 화면, 상단 검색창, 우클릭 행정구역 조회. 카카오 오류 원인 점검 후 도메인 설정 확인과 독립적으로 구현 가능한 작업을 진행.
- 변경: 홈페이지 내비게이션을 간결한 레일로 조정하고 지도를 화면 높이로 확장. `MapSearch` 지역 자동완성·키보드 선택과 기존 지역/업종 조건을 동기화. 결과를 오른쪽/하단 패널로 제공하고 닫기·다시 열기·저장·다운로드·오류/부족/로딩 처리를 유지. 가이드와 `.env.example`도 실제 흐름에 맞게 갱신.
- 위치 조회: 카카오 `rightclick`, Leaflet `contextmenu`, 중심 위치 버튼으로 받은 좌표를 공식 `coord2RegionCode`에 전달. 행정동 H만 사용하고 목록의 유일한 코드 일치 후 사용자가 확인해 선택. 8자리 코드의 `00` 정규화, 미지원 지역 안내, 미설정·서비스 누락·오류·빈 결과·10초 타임아웃·취소·오래된 응답 무시를 구현. 배경 공급자와 조회 서비스를 분리하고 BE API 계약은 변경하지 않음.
- 관련 구현: `src/components/MapSearch.tsx`, `AreaMap.tsx`, `KakaoMap.tsx`, `LeafletMap.tsx`, `Layout.tsx`, `SearchForm.tsx`, `src/pages/Dashboard.tsx`, `Guide.tsx`, `src/lib/catalogRegions.ts`, `regionLookup.ts`, `kakaoMaps.ts`, `src/types/map.ts`, `src/styles/map-workspace.css`, 관련 테스트.
- 별도 결함: 카카오 정상 타일 로드 후 미세 이동 → 13초 경과 시 실패 콜백이 호출되는 기존 오탐을 회귀 테스트로 재현. 공식 문서상 해당 이동에는 `tilesloaded`가 발생하지 않을 수 있음. [이슈 #2](https://github.com/teojabi-groundbreakers/pickplace-frontend/issues/2)로 분리했으며 이 feature 브랜치에는 오탐 수정을 포함하지 않음. 실패 재현 테스트는 별도 fix 작업에서 적용하며, 정상 흐름 테스트를 삭제해 오류를 숨긴 것으로 처리하지 않음.
- 검증: 동일 스크립트의 `npm run format`, `npm run format:check`, 전체 10개 파일·43개 테스트, `npm run lint`, `npm run build` 통과. 빌드 중 테스트 클래스의 parameter property가 `erasableSyntaxOnly`와 맞지 않아 명시적 필드 초기화로 수정 후 빌드를 다시 확인. 검색·조회·결과 패널·타입·이벤트 정리와 포맷 후 변경 코드를 직접 확인.
- 시각 검증: Chrome에서 넓은 지도·상단 검색창·간결한 내비게이션·카카오 실패 후 기본 위치도 전환을 확인. 기본 위치도 배경과 확대/축소 컨트롤의 배치 문제를 수정. 이후 브라우저 캡처 오류가 반복되어 모바일·태블릿 및 변경 후 전체 시각 검증은 미완료.
- 문서: `docs/MAPS.md`, `FRONTEND.md`, `README.md`, `WORKLOG.md`, `AGENTS.md`의 흐름·조회 규칙·연결 점검·제한 사항 갱신.
- 남은 사항: 카카오 허용 도메인 등록 후 실제 지도·우클릭 조회 성공 확인, 이슈 #2 수정, 모바일·태블릿 시각 검증, 팀 리뷰·병합. 별도 worktree의 `fix/2-kakao-tile-timeout`에서 이슈 #2 수정을 구현하고 테스트 33개·포맷·린트·빌드 통과를 확인했으며 이 feature 브랜치에는 아직 포함하지 않음. 실서비스 검증 전이므로 이슈 완료·운영 배포 완료로 기록하지 않음.

## 2026-10-08 · 001 · 지도 개편 사전 점검 및 카카오 연결 오류 확인

- 요청/범위: 지도가 메인인 첫 화면, 상단 검색 오버레이, 우클릭 행정구역 조회. 진행 전 카카오맵 미작동 원인 확인 요청을 추가로 반영.
- Git Flow: GitHub 기존 이슈가 없음을 확인한 뒤 [이슈 #1](https://github.com/teojabi-groundbreakers/pickplace-frontend/issues/1)을 생성하고 `etfactory`에 배정. 깨끗한 `develop`에서 `git fetch origin --prune`, `git pull --rebase origin develop`을 실행하고 기준 커밋 `5a87a15`에서 `feature/1-map-workspace`를 생성. 이전 문서의 `develop` 부재 상태를 현재 확인 결과로 갱신.
- 카카오 진단: `VITE_MAP_PROVIDER=auto`, 키 설정 및 개발 서버 반영 여부를 값 노출 없이 확인. 두 로컬 출처의 공식 SDK 요청에서 HTTP 401·`appKeyType is REST_API_KEY`를 확인. 사용자가 JavaScript 키로 교체한 뒤 키 종류 오류는 사라졌고 HTTP 401·`domain mismatched!`로 바뀜. `http://localhost:5173`, `http://127.0.0.1:5173`의 허용 도메인 등록을 요청했으며 확인 대기 중.
- 주요 결정: 지도 HTTP 응답과 실제 렌더링 검증을 구분. 행정동은 실제 좌표 조회의 H 결과를 사용하고 가까운 중심 마커로 추정하지 않는 구현 방향을 이슈와 [지도 문서](MAPS.md)에 기록. 설정·키 값은 문서와 이슈에 포함하지 않음.
- 검증: `npm run test -- src/test/kakaoMaps.test.ts src/test/maps.test.tsx`로 2개 파일·9개 테스트 통과. 현재 셸에서 `pnpm`을 찾을 수 없어 동일한 저장소 스크립트를 npm으로 실행했으며 의존성·잠금 파일은 변경하지 않음. `git check-ignore -v .env`로 제외 확인, `git ls-files -ci --exclude-standard` 출력 없음.
- 변경: `docs/MAPS.md`, `docs/README.md`, `docs/FRONTEND.md`, `AGENTS.md`, 이 작업 이력. 앱 소스는 아직 변경하지 않음.
- 남은 사항/제약: 허용 도메인 등록 후 SDK·실제 지도 재검증, 지도 메인 화면과 행정동 조회 구현·검증. 지도 `bounds_changed` 후 타일 로드 이벤트가 발생하지 않을 때의 오탐 가능성은 추가 검토 대상이며 재현·수정 완료로 기록하지 않음. 앱 시각 검증·실제 BE 연결·운영 배포·리뷰·병합은 미완료.

## 2026-10-07 · 001 · FE 기본 구성 및 분석 화면 구현

- 요청/범위: 사용자가 제시한 FE 업무 목록을 바탕으로 프로그램 기본 사항 구현.
- 변경: React·TypeScript·Vite 초기 화면을 공통 레이아웃과 상권 분석 화면으로 구성. 지역·업종 계층 선택, 입력 검증, HTTP 클라이언트·환경변수, 점수 카드, 영향 요인, 진단 요약, 추이·경쟁 차트, 지도, 상태 처리를 추가.
- 추가 기능: 브라우저 내 분석 저장 및 재열기, 텍스트 보고서 다운로드, 이용 가이드.
- 주요 결정: BE 계약 확정 전에는 타입과 계약 초안을 먼저 준비하고 데모 데이터를 명시적으로 구분. 실제 API 실패를 데모 데이터로 대체하지 않음. 위험도는 높을수록 위험함을 표시.
- 관련 구현: `src/components/`, `src/pages/`, `src/lib/`, `src/data/`, `src/types/`, `src/test/`.
- 관련 문서: [현재 FE 구성](FRONTEND.md), [API 계약 초안](API.md).
- 당시 검증: 테스트 19개, 린트, 프로덕션 빌드 통과. 로컬 서버 HTTP 200 응답 확인.
- 당시 제한: 실제 BE·AI 결과 연동 및 운영 배포 미수행. 내장 브라우저 연결 문제로 시각 검증 미완료.

## 2026-10-07 · 002 · 지도 우선 흐름 및 지도 대안 마련

- 요청/범위: 지도가 가장 먼저 나오도록 흐름 변경, OpenStreetMap 사용 시 발생할 수 있는 문제의 대안 준비.
- 변경: 지도 탐색 → 지역·업종 선택 → 분석 요청 → 결과 확인 순서로 변경. 첫 진입 시 결과를 자동 생성하지 않음. 지도와 검색 폼의 행정동 선택을 동기화. 조건 변경 시 이전 결과임을 안내하고 기존 지도 분석 레이어를 숨김.
- 지도 대안: 카카오지도 Web SDK, 별도 XYZ 타일 서버, OSM, 외부 배경 요청 없는 기본 위치도 선택을 지원. 공급자 장애·무응답 시 다른 설정된 공급자 또는 기본 위치도로 복구.
- 주요 결정: 다른 지도 공급자의 장애를 OSM으로 암묵 전환하지 않음. 기본 위치도는 실제 도로지도와 구분. 임의 클릭 좌표를 근거 없이 행정동으로 판별하지 않음.
- 관련 구현: `src/components/AreaMap.tsx`, `src/components/LeafletMap.tsx`, `src/components/KakaoMap.tsx`, `src/lib/mapProviders.ts`, `src/lib/kakaoMaps.ts`, `src/lib/selection.ts`, `src/pages/Dashboard.tsx`.
- 관련 문서: [지도 흐름·설정·장애 대응](MAPS.md).
- 검증: 전체 테스트 29개, 린트, 프로덕션 빌드 통과. 후속 테스트 경고 수정 후 지도 관련 테스트 6개와 린트 재확인.
- 제한: 실제 카카오지도 연결은 JavaScript 앱 키 및 서비스 URL 등록 후 검증 필요. 내장 브라우저 연결 문제로 시각 검증 미완료. 실제 BE 연결과 운영 배포는 여전히 미완료.

## 2026-10-07 · 003 · docs 중심 문서화 규칙 확립

- 요청/범위: 앞으로 진행하는 모든 사안을 `docs/`에 정리하고 주요 참조를 `AGENTS.md`에 추가.
- 변경: 루트 [AGENTS.md](../AGENTS.md)에 지속적인 문서화 규칙, 주요 문서 링크와 유지할 결정을 추가. [문서 색인](README.md), [작업 규칙](DEVELOPMENT.md), 이 작업 이력을 작성.
- 정리: 기존 루트 README의 상세 구성·실행·검증·배포 안내를 [FRONTEND.md](FRONTEND.md)로 옮기고 현재 구현 및 남은 연계 작업을 추가. 루트 README는 소개와 문서 진입 링크로 정리. 기존 API·지도 문서는 해당 주제의 원본으로 유지.
- 주요 결정: 현재 사양과 작업 이력을 분리하고, 매 작업마다 관련 문서와 이력을 갱신. 주요 참조는 AGENTS에도 연결. 완료·미수행·미검증 상태를 구분하고 검증 결과를 실제 실행 시점에 맞게 기록.
- 검증: 문서 내부 링크 대상과 로컬 파일 참조, 주요 명령·환경변수의 일치 여부 및 `git diff --check` 확인. 앱 소스 변경이 없는 문서 작업이므로 앱 테스트·린트·빌드는 재실행하지 않음.
- 남은 사항: 이 문서화 요청 자체의 미완료 사항 없음. FE 실연동·배포·시각 검증은 [현재 남은 연계 작업](FRONTEND.md#남은-연계-작업)을 따름.

## 2026-10-07 · 004 · 검토하기 쉬운 줄바꿈 및 포맷 기준 적용

- 요청/범위: 코드를 계속 확인할 수 있도록 줄바꿈과 가독성을 유지.
- 변경: 기존 TypeScript·TSX·CSS·HTML 및 설정 파일을 Prettier로 정리. 압축된 JSX 중첩·속성, CSS 선언, 조건·콜백을 여러 줄로 펼침. CSS 규칙 사이와 지도·검색·API 처리의 논리 단위에 빈 줄을 추가하고 긴 조건문의 블록을 명시.
- 설정: Prettier 개발 의존성, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `pnpm format` 및 `pnpm format:check` 추가. 공백 2칸, LF, 기준 너비 100자, JSX 여러 속성의 개별 줄바꿈을 적용. 기존 pnpm 저장소를 지정해 설치.
- 주요 결정: 자동 포맷 후에도 변경 코드를 직접 확인. 향후 코드 변경 검증에 포맷 검사를 포함. 작성 기준은 [개발 규칙](DEVELOPMENT.md#코드-작성-형식), 핵심 준수 사항은 [AGENTS.md](../AGENTS.md)에 기록. 기능 변경 없이 읽기 쉬운 코드 형식을 유지하는 작업.
- 관련 문서: [문서 색인](README.md), [실행·검증 안내](FRONTEND.md).
- 검증: `pnpm format:check`, 전체 테스트 7개 파일·29개 테스트, `pnpm lint`, `pnpm build` 통과. 지도·검색·API·응답 검증 코드의 줄바꿈과 처리 흐름을 직접 확인. 문서 로컬 링크·설정 파일·명령 참조와 `git diff --check` 확인.
- 남은 사항/제약: 코드 형식 요청의 미완료 사항 없음. 이번 작업에서는 브라우저 시각 검증을 수행하지 않음. 실제 외부 연결·배포 관련 기존 제한은 유지.

## 2026-10-07 · 005 · .gitignore 점검 및 누락 보완

- 요청/범위: `.gitignore`의 현재 규칙과 Git 추적 상태 점검.
- 확인 사항: `*.local`만으로는 `.env`·`.env.production` 등 환경변수 파일을 제외하지 못함. `coverage/`, `.nyc_output/`, `.vite/`, `*.tsbuildinfo`도 제외 규칙이 없었음. 의존성·빌드 결과·로그·편집기 임시 파일에 대한 기존 규칙은 동작 중.
- 변경: 환경변수 파일과 테스트 산출물·캐시·TypeScript 빌드 정보의 제외 규칙을 추가. `.env.*` 뒤에 `!.env.example`을 두어 비밀값 없는 공유 템플릿을 유지. 기존 로컬 설정·VS Code 확장 목록 예외는 유지.
- 주요 결정: `pnpm-lock.yaml`, 소스·테스트·문서, `AGENTS.md`, 공유 개발 설정은 Git에 포함. `.prettierignore`와 Git 제외 규칙은 용도가 다르므로 분리 관리. 추적 파일을 삭제하거나 인덱스에서 제거하는 작업은 수행하지 않음.
- 관련 문서: [Git 추적 및 제외 기준](DEVELOPMENT.md#git-추적-및-제외-기준), [AGENTS.md](../AGENTS.md), [문서 색인](README.md).
- 검증: `git check-ignore --no-index`로 제외 대상 26개와 유지 대상 20개, 총 46개 경로의 기대 동작 확인. `git ls-files -ci --exclude-standard` 결과 현재 추적 파일 중 제외 규칙에 해당하는 파일 없음. 문서 링크, `pnpm format:check`, `git diff --check` 확인. 앱 소스·실행 설정 변경이 없어 앱 테스트·린트·빌드는 재실행하지 않음.
- 남은 사항/제약: 이번 점검의 미완료 사항 없음. 현재 작업 트리·인덱스를 대상으로 점검했으며 과거 커밋의 비밀값 유출 여부를 조사한 작업은 아님.

## 2026-10-07 · 006 · 사용자 제공 팀 규칙 및 Git Flow 작업 지침 반영

- 요청/범위: 모든 Git 작업을 Git Flow 기반으로 진행하고 첨부한 PickPlace 팀 개발 규칙 적용.
- 변경: 첨부 전문을 [TEAM_RULES.md](TEAM_RULES.md)에 저장. 규칙 내용은 유지하고 저장소 포맷만 적용. [AGENTS.md](../AGENTS.md)에 전문 참조와 이슈·브랜치·커밋·PR·리뷰·병합·릴리스 규칙을 추가. [FE 개발 규칙](DEVELOPMENT.md#git-flow-적용)에 적용 절차와 저장소 준비 기준을 정리하고 루트 README·문서 색인에 연결.
- 주요 결정: Git 작업의 기준은 사용자 제공 팀 규칙이며 팀 합의·PR 없이 임의로 수정하지 않음. 팀 브랜치 접두사와 실제 이슈 번호를 사용. `main`·`develop` 직접 커밋·푸시 금지, Conventional Commits, 최소 1명 리뷰 승인, 기능·수정 squash merge 및 릴리스·핫픽스 merge commit 방식을 작업 지침에 반영.
- 현황 확인: 로컬에는 `main`만 있으며 기존 FE 변경은 미커밋 상태. `git ls-remote --heads origin main develop master`로 원격에도 `main`만 있음을 확인. 기준 커밋은 `e9c936c`. 원격 보호 설정은 아직 검증하지 않음.
- 검증: 첨부 원문을 동일한 Prettier 설정으로 포맷한 결과와 저장한 전문의 전체 일치 확인. 문서 로컬 링크·헤더, `pnpm format:check`, `git diff --check` 확인. 문서만 변경하여 앱 테스트·린트·빌드는 재실행하지 않음.
- 남은 사항/제약: 문서는 로컬 작업 트리에 반영한 상태이며 이슈·작업 브랜치 생성, 커밋·푸시·PR·리뷰·병합은 수행하지 않음. Git Flow 저장소 전환에는 관리자·팀 절차에 따른 `develop` 준비, 보호 설정 확인, 기존 미커밋 작업의 목적별 이슈·작업 브랜치 연결이 필요. 기존 FE 변경은 보존했으며 팀 완료 기준까지 충족한 상태로 기록하지 않음.
