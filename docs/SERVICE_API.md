# 서비스 상태와 서울 자치구 API 연동

2026-11-04 FE 반영 · [이슈 #12](https://github.com/teojabi-groundbreakers/pickplace-frontend/issues/12). 기준은 사용자가 제공한 **2026-11-01 BE 코드 인계**입니다. 브랜치에서 지원한다는 설명은 실제 공유 서버 배포·DB 적재·연결 확인을 뜻하지 않습니다.

| 기능        | BE 경로                 | 정상 데이터         | BE develop `3a96caa` | BE main `0de61ea` |
| ----------- | ----------------------- | ------------------- | -------------------- | ----------------- |
| 서버 생존   | `GET /api/health`       | `data.status: "UP"` | 구현                 | 구현              |
| DB 준비     | `GET /api/health/ready` | `data.status: "UP"` | 구현                 | 구현              |
| 서울 자치구 | `GET /api/districts`    | `data.items`        | 구현                 | 미반영            |

요청 본문·파라미터·로그인·FE 인증키가 필요하지 않습니다. 서버 생존은 실행 중인 프로세스의 상태이고, DB 준비는 `SELECT 1` 성공 여부입니다. 생존 성공만으로 DB 준비나 자치구 기준정보 적재를 판정하지 않습니다. 최초 서버 기동에는 DB/Flyway 초기화가 필요합니다.

## 로컬 연결과 화면 확인

자치구를 제공하는 BE 개발 서버가 `http://localhost:8080`에서 실행 중이라면 FE의 `.env.local`에 설정합니다.

```dotenv
VITE_API_BASE_URL=/api
VITE_DEMO_MODE=true
VITE_SERVICE_API_PREVIEW=true
PICKPLACE_API_PROXY_TARGET=http://localhost:8080
```

1. `pnpm dev`로 개발 서버를 재시작합니다. **이용 가이드 → 서비스 API 연결 확인** 영역의 **서비스 연결 확인** 버튼을 누릅니다.
2. 서버 생존·DB 준비·자치구 목록 결과를 각각 확인합니다. 정상 빈 목록은 등록된 목록이 없다는 뜻이며, 503이나 연결 오류와 구분합니다.
3. 공유 환경은 BE 담당자가 전달한 실제 주소·실행 커밋·DB 적재를 먼저 확인합니다. 같은 출처 운영 프록시를 쓰거나 별도 출처의 `VITE_API_BASE_URL=https://<api-host>/api`와 허용 CORS를 설정합니다.

프록시 대상은 경로 없는 HTTP(S) 서버 주소입니다. 개발 프록시는 `/api` 경로를 그대로 보내며 운영에는 별도 설정이 필요합니다. FE 요청 함수에는 `/health`, `/health/ready`, `/districts`만 전달하여 `/api`를 두 번 붙이지 않습니다. `X-Request-Id`를 별도 출처 응답 헤더에서 읽으려면 서버의 노출 헤더 설정이 필요합니다. 정상 래퍼에서는 본문 `meta.requestId`를 사용합니다.

## 응답과 상태 구분

```json
{
  "data": {
    "items": [{ "districtCode": "11110", "districtName": "종로구" }]
  },
  "meta": { "requestId": "example-districts" }
}
```

- `districtCode`는 5자리 문자열, `districtName`은 이름입니다. FE는 코드·이름으로 매핑하고 서버의 코드순을 유지합니다. 전체 적재 시 25개라는 인계 내용은 응답 검증 조건이 아닙니다. 부분 목록과 `200 + data.items: []`를 정상으로 수용합니다.
- 비정상 HTTP 응답은 `error.code`와 HTTP 상태를 보존하고 가능한 경우 `meta.requestId`를 안내합니다. 서버의 상세 오류나 내부 예외는 사용자 안내에 그대로 출력하지 않습니다.
- `404 NOT_FOUND`는 경로·실행 브랜치를 확인할 상태입니다. `503 DATA_SERVICE_UNAVAILABLE`은 서버의 DB 조회 장애입니다. 타임아웃·네트워크·CORS로 HTTP 응답이 없으면 서버 코드가 없을 수 있습니다. 준비 확인의 쿼리 제한 2초와 연결 대기는 별개여서 FE의 30초 제한이 먼저 도달할 수 있습니다.
- `405 METHOD_NOT_ALLOWED`는 HTTP 메서드와 `Allow` 헤더를 확인합니다. `500 INTERNAL_ERROR`는 요청 ID와 함께 서버 담당자가 확인합니다. 그 외 프레임워크 입력 오류는 실제 4xx와 `INVALID_REQUEST`를 구분합니다.
- 오류의 `error.details`는 없을 때 빈 배열이며 항목은 `field`·`reason`입니다. FE는 별도 요청 ID를 만들거나 보내지 않습니다. 인계에 따르면 클라이언트 ID를 보낼 경우 영문·숫자·`-`·`_` 1~64자만 유지되고, 그 외에는 서버가 발급합니다.
- API 성공은 `data + meta`, 오류는 `error + meta`입니다. Swagger·Actuator는 이 래퍼를 사용하지 않습니다. 개발 BE의 `/swagger-ui.html`, `/v3/api-docs`, `/actuator/health`에는 `/api`를 추가하지 않습니다.

## 기존 기능과 공동 검수

검수 영역은 명시적으로 켰을 때만 보이며, 자치구 목록으로 기존 `Catalog`를 만들지 않습니다. 행정동·업종·현황·AI는 이번 BE 지원 범위 밖입니다. 기존 데모 분석과 `/catalog`·`/analyses` 계약 초안은 그대로 두며, 서비스 목록 오류를 데모 목록으로 바꾸지 않습니다. SGIS 경계 실연동은 후순위입니다.

| 예정 경로 또는 범위 (모두 `/api` 기준)                                      | 첨부 인계 상태                 |
| --------------------------------------------------------------------------- | ------------------------------ |
| `GET /catalog`, `POST /analyses`                                            | 기존 FE 초안, BE 미구현        |
| `GET /districts/{districtCode}/administrative-dongs`, `GET /business-types` | 개별 목록 초안, 미구현         |
| `GET /administrative-dongs/{dongCode}/data-availability`                    | 분리 필요 여부 검토, 미구현    |
| `GET /administrative-dongs/{dongCode}/summary`, `/trends`, `/map`           | 현황 초안·후속 계획, 미구현    |
| `GET /regions/{H10}/boundary`                                               | FE 준비 초안, BE 미구현·후순위 |

미구현 경로의 404는 분석 자료 없음이나 정상 빈 목록으로 해석하지 않습니다.

- [ ] BE 실행 커밋·기준 URL·프록시/CORS·개발 DB 적재 확인
- [ ] 브라우저에서 생존·준비·자치구 조회, 정상 빈 목록과 오류·재시도 확인
- [ ] 공유 서버 연결·운영 배포 확인

공유 BE 주소·배포 상태·기준정보 적재는 아직 확인하지 않았습니다. FE 구현과 검증 기록은 [작업 이력](WORKLOG.md), 미구현 분석의 응답은 [기존 계약 초안](API.md)을 확인합니다.
