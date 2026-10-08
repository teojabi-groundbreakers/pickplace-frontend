# 프로젝트 문서

PickPlace FE에서 진행한 작업, 결정 사항, 기술 사양과 검증 결과를 모아 관리합니다. 모든 이후 작업은 이 폴더에 기록하며, 주요 참조는 저장소 루트의 [AGENTS.md](../AGENTS.md)에도 연결합니다.

## 문서 색인

| 문서                             | 내용                                                            | 확인할 때                               |
| -------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| [TEAM_RULES.md](TEAM_RULES.md)   | 팀 개발 규칙 전문: Git Flow, 이슈·커밋·PR·리뷰·릴리스·완료 기준 | 모든 작업 시작 및 Git 작업              |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 코드 형식, Git 추적·제외, 작업·문서화·검증 규칙                 | 코드·Git 설정 변경, 작업 시작 및 마무리 |
| [FRONTEND.md](FRONTEND.md)       | 현재 구현, 실행, 환경변수, 구조, 테스트, 정적 배포              | 프로젝트 실행 및 FE 구성 변경           |
| [API.md](API.md)                 | BE 연동 계약 초안, 데이터 단위, 응답 검증, 오류                 | BE·AI 연동 및 데이터 모델 변경          |
| [MAPS.md](MAPS.md)               | 지도 우선 흐름, 공급자 선택·설정, 장애 복구                     | 지도 및 지역 선택 변경                  |
| [WORKLOG.md](WORKLOG.md)         | 작업별 요청·변경·결정·검증·남은 사항                            | 진행 이력 및 다음 작업 확인             |

## 현재 기준

- 모든 Git 작업은 [팀 개발 규칙](TEAM_RULES.md)의 Git Flow를 따른다. FE 적용 절차는 [개발 규칙](DEVELOPMENT.md#git-flow-적용)에 있다.
- 2026-10-08 원격 `develop`과 로컬의 기준 커밋이 `5a87a15`로 같음을 확인했다. 깨끗한 작업 트리에서 fetch·pull 후 [이슈 #1](https://github.com/teojabi-groundbreakers/pickplace-frontend/issues/1)의 `feature/1-map-workspace`를 생성했다. 원격 보호 설정·리뷰·병합은 아직 확인하거나 수행하지 않았다.
- 첫 화면은 지도 탐색이다. 지역·업종 선택 후 분석 요청을 실행하면 결과를 표시한다.
- 기본 실행은 데모 모드이며 수치·평가·진단·분석 경계·시설 마커는 예시 데이터다.
- 지도 메인 화면·상단 검색 오버레이·우클릭 행정동 조회는 [Draft PR #3](https://github.com/teojabi-groundbreakers/pickplace-frontend/pull/3), 카카오 미세 이동 후 타임아웃 오탐 수정은 별도 [Draft PR #4](https://github.com/teojabi-groundbreakers/pickplace-frontend/pull/4)에 올렸다. 두 PR 모두 대상은 `develop`이며 실제 연결 검증·리뷰·병합은 대기 중이다. 현재 feature 브랜치에는 별도 fix 코드가 포함되지 않는다.
- 카카오 SDK의 REST API 키 오류를 확인했고 사용자 키 교체 후에는 허용 도메인 불일치가 남아 있다. [연결 오류 확인 순서](MAPS.md#연결-오류-확인-순서)를 따른다. 지도 메인 화면의 데스크톱 배치를 확인했으며 실제 카카오 지도·행정동 조회 성공·모바일 시각 검증·BE 연결·운영 배포는 아직 완료되지 않았다.
- API 문서는 BE와 확정 전인 계약 초안이다.

최신 작업 내용과 검증 시점은 [작업 이력](WORKLOG.md)에서 확인합니다. 구현 상태가 바뀌면 이 문서와 해당 주제 문서를 함께 갱신합니다.
