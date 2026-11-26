# PickPlace FE · API 연동 계약 초안

## 전국 H10 목록 연계 준비

2026-11-08 최신 BE 합의에 따라 시·도, 그룹, 읍·면·행정동 목록 클라이언트와 선택 상태는 H10을 사용한다. 공개 `regionVersion`·`selectionRegionVersion`과 버전 충돌에 따른 강제 재선택은 도입을 보류했다. 전국 모드에서는 기존 검색 조건의 3단계 선택 화면을 사용한다. 현황·분석 연동은 별도 계약으로 다룬다.

- `GET /regions/provinces`에는 쿼리를 보내지 않는다. API 기본 URL의 `/api`는 별도로 붙는다.
- `GET /regions/groups?provinceCode=...`과 `GET /regions/localities?groupCode=...`에는 각 부모의 10자리 H10 원본만 전달한다.
- 세 목록은 `data.items`와 `meta.requestId`, `meta.codeSystem=MOIS_H10`, `meta.sourceReferenceOn`, `meta.sourceFileVersion`을 반환한다. 기준일은 날짜 문자열 또는 `null`이다. 출처 정보는 응답에서 보존한다. 항목의 H10·선택 단계·부모·중복을 검증하고 서버 순서를 유지한다.
- `autoSelect=true`인 그룹만 자동 적용한다. 지역을 바꾸면 하위 선택을 초기화하고 진행 중인 하위 조회를 취소한다. 404 `REGION_NOT_FOUND`이면 유효하지 않은 선택을 해제하고 부모 목록을 다시 확인한다. 503의 준비 중·서비스 장애와 200 빈 목록을 구분한다.

BE는 현재 게시 자료로 코드의 존재·역할·소속·상태를 검증한다. 보조 필드와 오류 문구의 세부 정책, 현황·분석과 과거 지역 API는 각각의 계약으로 관리한다.

기존 서울 실제 API 모드의 기준정보 목록과 AI 분석 호출은 아래 개별 API와 `POST /ai/analyses` 계약을 사용합니다. 전국 모드(`VITE_NATIONWIDE_REGIONS_ENABLED=true`)는 전국 목록 조회와 지도 이동을 지원하며 새 분석은 준비 중으로 표시합니다. 기존 `POST /analyses`와 독립 경계 응답은 별도 초안입니다. 모든 경로는 `VITE_API_BASE_URL` 뒤에 붙으며 요청 제한 시간은 30초입니다.

백엔드 개발의 우선순위·산출물·현재 FE 제약·인수 시나리오는 [백엔드 인계 문서](BACKEND_HANDOFF.md)에 있습니다. 이 문서는 요청·응답 상세 계약의 원본으로 유지합니다.

2026-11-04 추가된 분기별 연구용 성장률과 부분 결과의 상세 매핑은 [연구용 계약 초안](RESEARCH_FORECAST_CONTRACT.md)을 참고합니다. 해당 문서는 당시 설계와 현재 로컬 연구 경로를 함께 기록합니다.

## 현재 BE 기준정보 API

전국 H10 선택 화면을 끈 실제 API 모드의 서울 지역 목록은 `GET /districts`와 `GET /districts/{districtCode}/administrative-dongs`로 조회합니다. 지원 업종 목록은 서울·전국 선택 화면에서 모두 `GET /business-types`를 사용합니다. 성공의 `data.items`와 `meta.requestId`, 오류의 `error.code`·`meta.requestId`를 검증합니다. 정상 빈 목록과 오류는 분리하고 목록마다 재시도합니다. 서버가 반환한 5자리 구 코드, 8자리 원천 행정동 코드, 공식 대응 상태·기준 버전 및 업종 원본 코드를 보존합니다. 현재 실제 업종 API는 `Ixxxxx` 형식의 소진공 소분류를 제공하며 예전 정적 `CS...` 참고 자료와 구분합니다. `LEGACY`는 과거 코드로 표시합니다.

기존 지도 상단 검색창·조건 선택 UI에 목록을 표시합니다. 서울 목록에서 이름 검색을 시작할 때 구별 동 목록을 최대 4건 병렬로 조회하고 성공 결과를 캐시하며, 일부 조회 실패와 재시도를 표시합니다. 목록에 좌표가 없으므로 카카오에서 확인된 장소로 이동합니다. 분석에는 확인된 H10과 서버의 지원 업종 원본 코드를 전달합니다. 실제 모드의 분석 요청이 실패하면 오류를 표시합니다. 8자리와 H10을 임의 절삭·접미사 또는 이름 추정으로 변환하지 않습니다.

## GET /catalog (기존 계약 초안)

아래는 기존 FE 카탈로그 초안과 데모 자료의 형식입니다. 현재 BE는 이 경로를 제공하지 않으며 실제 API 모드의 목록 조회에는 사용하지 않습니다. `src/types/analysis.ts`의 `Catalog` 형식을 따릅니다.

```json
{
  "cities": [
    {
      "code": "11",
      "name": "서울특별시",
      "districts": [
        {
          "code": "11200",
          "name": "성동구",
          "neighborhoods": [
            {
              "code": "11200690",
              "name": "성수2가1동",
              "center": [37.5396, 127.0555]
            }
          ]
        }
      ]
    }
  ],
  "categories": [
    {
      "code": "food",
      "name": "음식",
      "industries": [{ "code": "coffee", "name": "카페 / 커피전문점" }]
    }
  ]
}
```

코드는 문자열입니다. 데모 코드는 UI 확인용이며 실제 행정동 및 업종 코드는 BE 제공 목록을 사용합니다. 목록의 각 계층은 한 개 이상의 항목이 필요합니다.

지역코드의 출처·2/5/8자리 데모 계층·10자리 지도 조회·행정동/법정동 구분과 검증 제한은 [지역코드 기준](REGION_CODES.md)에 정리했습니다. 위 JSON의 `11200690`은 현재 데모 예시이며 공식 검증을 마친 운영 코드가 아닙니다.

지역 목록은 검색·계층 선택을 위한 편의 데이터이며 분석 가능한 지역의 허용 목록이 아닙니다. 지도에서 실제 조회한 행정동은 이 목록에 없어도 분석을 요청합니다. 업종 드롭다운은 API 모드에서 서버의 지원 업종 목록을 사용하며 업종 목록 조회 실패 시 분석을 비활성화합니다. 위치 조회·둘러보기는 계속 사용할 수 있습니다.

## GET /regions/{H10}/boundary

우클릭·중심 위치 조회로 얻은 행정동 또는 현재 선택한 원본 10자리 H 코드의 경계를 **분석 전에 독립 조회**합니다. 예를 들어 기준 URL이 `/api`이면 `/api/regions/1120067000/boundary`를 호출합니다. 카카오 SDK에서 경계를 받는 기능이 아니라 BE가 제공할 경계 API이며, FE 타입·검증·요청 상태·카카오 표시는 준비했습니다. **실제 BE endpoint·공식 경계 데이터 확보·팀 계약 확정·실서버 연결은 아직 완료하지 않았습니다.**

요청 본문·업종·기간은 없으며 `regionCode`는 숫자 10자리 원본 문자열입니다. FE가 8자리 카탈로그/데모 코드를 자르거나 `00`을 붙여 요청하지 않습니다. H 코드의 실제 유효성·공식 경계 코드 대응은 BE가 판별합니다. 데모 모드에서는 HTTP를 호출하지 않고 경계 없음 안내를 표시하며 합성 경계를 대신 반환하지 않습니다.

200 응답은 [RegionBoundary 타입](../src/types/boundary.ts)의 객체 자체를 반환합니다. `{ "data": ... }`·GeoJSON `Feature/FeatureCollection` 래퍼는 현재 받지 못합니다. 다음 예제는 **코드·이름·좌표·대표점·출처·기준일을 모두 형식 확인용으로 작성한 합성 테스트 fixture**입니다. `9999999999`는 실재 행정동을 확인한 코드가 아니며 영점 부근 사각형도 실제 행정동 경계가 아닙니다. 운영 데이터로 복사하지 않습니다.

```json
{
  "regionCode": "9999999999",
  "regionType": "H",
  "regionName": "합성 테스트 영역 · 실제 행정동 아님",
  "coordinateSystem": "EPSG:4326",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0]
      ]
    ]
  },
  "labelPosition": [0.5, 0.5],
  "boundaryDate": "2025-06-30",
  "source": {
    "name": "합성 테스트 자료 · 공식 출처 아님",
    "url": "https://example.com/synthetic-boundary"
  }
}
```

| 필드               | 현재 FE 요구                                                    |
| ------------------ | --------------------------------------------------------------- |
| `regionCode`       | 숫자 10자리 문자열. 요청한 원본 코드와 완전히 일치해야 함       |
| `regionType`       | `H`만 허용. 법정동 `B`를 대신 제공하지 않음                     |
| `regionName`       | 비어 있지 않은 문자열. 지도 라벨에 표시                         |
| `coordinateSystem` | `EPSG:4326` 고정. BE가 원본 CRS 확인 후 실제 좌표 변환          |
| `geometry`         | GeoJSON geometry `Polygon` 또는 `MultiPolygon`                  |
| `labelPosition`    | WGS84 `[경도, 위도]` 숫자 2개. 지도 라벨 대표점                 |
| `boundaryDate`     | 실제 존재하는 날짜 `YYYY-MM-DD`. 분석 시각과 구분한 경계 기준일 |
| `source.name`      | 비어 있지 않은 공식 자료·출처 이름                              |
| `source.url`       | 유효한 `http://` 또는 `https://` URL. 출처 링크로 표시          |

`geometry.coordinates`와 `labelPosition`은 **WGS84 `[경도, 위도]`**입니다. 위도 ±90·경도 ±180 안의 유한 숫자 2개만 허용하며 숫자 문자열·고도 등 세 번째 값은 받지 못합니다. 카카오 표시 직전에 `[위도, 경도]`로 변환합니다. 아래 기존 분석 API의 `map.center/boundary/places.position`과 좌표 순서가 다릅니다.

- `Polygon.coordinates`는 `[외곽 링, 내부 구멍 링, ...]`입니다. 링이 최소 1개 있어야 합니다.
- `MultiPolygon.coordinates`는 `[폴리곤, 폴리곤, ...]`입니다. 최소 1개 폴리곤이 필요하며 각 폴리곤의 모든 링을 보존합니다.
- 링은 최소 4개 좌표이고 첫 점과 끝 점이 같아야 합니다. 폐합 점을 제외한 서로 다른 좌표가 최소 3개 필요합니다. 빈 geometry·폴리곤·링은 받지 못합니다.
- 검증은 구조·범위·폐합 조건입니다. 자기 교차·면적·링 방향·구멍 포함 관계·대표점의 경계 내부 여부·실제 행정동 일치는 검사하지 않습니다. BE가 원본 도형과 대표점을 검증하며 복수 영역을 임의로 평탄화하지 않습니다.

경계 없음은 다음 상태·코드를 함께 반환합니다.

```http
HTTP/1.1 404 Not Found
Content-Type: application/json
```

```json
{ "code": "BOUNDARY_NOT_AVAILABLE", "message": "제공 가능한 행정동 경계가 없습니다." }
```

**404 + `BOUNDARY_NOT_AVAILABLE`만** FE의 경계 없음 상태로 처리합니다. 다른 404·503·타임아웃·잘못된 JSON·다른 지역 코드의 응답은 오류와 재시도로 처리합니다. 204·빈 본문·200의 `null`/빈 geometry도 경계 없음으로 숨기지 않고 응답 오류로 처리합니다. 경계 조회에는 분석의 `INSUFFICIENT_DATA` 분기를 적용하지 않습니다.

요청 제한은 30초이며 대상 코드 변경/해제·재시도·언마운트 시 이전 요청을 취소하고 늦은 응답을 무시합니다. 독립 조회가 진행 중이거나 실패/없음이면 기존 분석 경계나 데모 사각형으로 대체하지 않습니다. 지도·지역명·분석·둘러보기는 유지하며 경계 오류를 SDK/타일 오류와 구분합니다. 독립 조회 대상이 없는 기존 분석 흐름에서는 기존 단일 링 경계를 유지합니다.

출처·사용 조건·H 코드 매핑·경계 기준일·원본 CRS·갱신/캐시 정책은 BE가 관리합니다. 서비스 Secret을 FE에 전달하지 않습니다. 구현은 [경계 클라이언트와 검증](../src/lib/regionBoundary.ts), [요청 상태](../src/lib/useRegionBoundary.ts), [지도 흐름](MAPS.md)을 참조합니다. SGIS 연계는 사용자 최신 요청에 따라 [후순위 검토사항](SGIS.md)으로 보류했으며 현재 필수 구현/배포 조건이 아닙니다. 이 계약은 기존 FE 연계 준비를 설명하는 초안으로 유지하며 SGIS 도입이나 실연결 완료를 뜻하지 않습니다.

## GET /regions/{H10}/summary (게시 현황)

실제 모드에서 분석 결과를 받으면 같은 H10과 소진공 소분류 코드로 `GET /regions/{H10}/summary?businessTypeCode=…`를 호출한다. 분석 응답과 현황의 지역·업종이 같은지 확인한다. 현황의 `meta.referenceMonth`는 서버가 게시한 DEFAULT 묶음의 기준월이다. FE는 월·분기 파라미터를 보내지 않는다.

등록인구와 선택 업종 수록 업소 수는 별도 카드로 표시한다. 각 카드와 보고서의 기준월은 지표 자체의 `source.referenceOn`에서 읽으며 공통 `meta.referenceMonth`를 그 자리에 사용하지 않는다. 저장본에는 원래 응답을 보관하고 보고서에는 정확한 기준일도 표시한다. `AVAILABLE`의 실제 0과 `NO_DATA`·`UNAVAILABLE`의 null 및 사유를 구분한다. 현황 조회가 실패해도 기존 AI 결과를 표시한다. 단월 현황은 월별 추이에 추가하지 않는다.

현재 API는 인구·업소를 묶어 게시한 동일 월의 자료를 반환한다. 조회 시점에 외부 최신 자료를 수집하지 않는다. 지표별 최신 게시 API를 검토할 경우 [BE 인계 범위](BACKEND_HANDOFF.md#지표별-최신-현황-조회-검토)를 참조한다.

## POST /ai/analyses (현재 실제 모드)

기존 서울 실제 API 모드에서 `VITE_API_BASE_URL=/api`일 때 실제 요청 경로는 `/api/ai/analyses`입니다. 카카오 지도에서 확인한 H10과 `GET /business-types`가 반환한 지원 업종 코드를 원본 그대로 보냅니다. 서버에서 제공되는 업종은 현재 `I21201`과 같은 소진공 소분류 코드이며 FE는 임의 변환하지 않습니다. 지역명·업종 표시명·카카오에서 선택한 좌표는 **화면 표시용**으로만 사용하고 요청 본문에는 넣지 않습니다.

```json
{ "regionCode": "1111051500", "industryCode": "I21201" }
```

정상 HTTP 응답은 `{ "data": {...}, "meta": { "requestId": "..." } }` 봉투를 사용합니다. `data`에는 원본 `request`, `asOf`, 달력상 최근 완료 분기인 `basePeriod`, `statistics: {version, metrics}`, `ai: {state, reason, transportStatus, result}`가 들어갑니다. 각 통계 항목은 `{value, status, reasonCode}`입니다. 사용 가능 상태만 숫자를 제공하고, 그 외에는 `value: null`과 사유를 보존합니다. 통계 항목이 비어 있거나 아직 확정되지 않았으면 점수·매출 추이·비교 값·행정동 경계를 합성하지 않습니다.

`ai.state`가 `AVAILABLE`일 때만 `ai.result`를 받아 성장률의 `estimated_yoy_growth`와 `target_period`·`comparison_period`, 위험·적합도 초안 지수와 경고를 표시합니다. 성장률은 비율이고 위험·적합도는 규칙 기반 초안 지수이므로 기존 `Analysis.scores`로 옮기지 않습니다. 성장률 자체가 `unavailable`이면 `null`과 그 사유를 표시합니다. `SKIPPED` 또는 `FAILED`에서는 `result: null`과 한국어 사유를 표시하며 통계의 개별 상태는 유지합니다. `basePeriod`는 실제 관측 매출 분기나 모델 학습 최신 분기가 아닙니다.

FE는 봉투·요청 코드 일치·날짜·분기·상태·수치 범위를 검증합니다. 이전 원본 `Analysis` JSON을 성공 응답으로 받지 않습니다. 오류 응답은 BE 공통 `error.code`·`meta.requestId`를 사용하고 요청 ID를 오류 안내에 보여줍니다.

기존 로컬 BE의 일반 분석에서 청운효자동·카페의 게시 현황과 AI 요청 보류(`mapping_unverified`)를 확인했습니다. 별도 로컬 `/__ai-flow-test/`에서는 가상 지역·업종 대응과 이력, 고정 분석일 2026-02-15를 사용해 브라우저에서 격리 Spring을 거쳐 FastAPI `/predict`를 호출하고 결과 카드를 확인했습니다. 일반 경로에서 승인된 입력으로 FastAPI까지 연결하는 검증은 남아 있습니다.

### 지표별 기준 분기 응답 초안

2026-11-16 [BE 이슈 #36 합의](https://github.com/teojabi-groundbreakers/pickplace-backend/issues/36#issuecomment-6910272203)를 바탕으로 FE 파서가 지표별 기간이 담긴 `schemaVersion: "2.0"`을 지원한다. 기존 단일 분기 응답은 `schemaVersion`이 없거나 `"1.0"`일 때 계속 받는다. 두 형식의 요청 본문은 동일하다.

현재 FE의 기본 호출은 `POST /api/ai/analyses`를 사용한다. BE `develop`의 지표별 응답은 별도 `POST /api/ai/analyses/v2`에 구현되어 있다. 서로 다른 지표 기준 분기는 모의 응답에서 확인했고, v2 형식은 로컬 Spring 연결에서도 확인했다. FE 기본 호출 경로의 전환과 공유 환경에서의 실제 자료 가용성은 별도 확인이 필요하다. [BE PR #44](https://github.com/teojabi-groundbreakers/pickplace-backend/pull/44)

| 위치                | 초안                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`              | `schemaVersion: "2.0"`, `request`, `asOf`, `statistics`, `ai`. 공통 `basePeriod`는 생략한다.                                                                                                                                                                   |
| `ai`                | `state`, `reason`, `transportStatus`, `warnings`, `metrics: {growth, risk, fit}`. 전체 요청 상태와 별도로 각 지표를 표시한다.                                                                                                                                  |
| `ai.analysisScope`  | 선택 필드. `AVAILABLE`에서만 객체를 제공할 수 있다. 서울 원천의 8자리 `sourceRegionCode`, `CS`와 숫자 6자리의 `sourceIndustryCode`, `sourceIndustryName`, `industryMatch`, `referenceOnly`를 보존한다. `EXACT`는 `referenceOnly: false`, `PARTIAL`은 `true`다. |
| 각 지표             | `basePeriod`는 `YYYYQn` 또는 `null`. `status: "available"`이면 기준 분기와 유한한 `value`, `reason: null`이 필요하다. `"unavailable"`이면 `value: null`과 `reason`이 필요하다.                                                                                 |
| `ai.metrics.growth` | `targetPeriod`와 `comparisonPeriod`를 함께 제공한다. 기간을 정할 수 없는 미제공 결과는 두 값을 `null`로 둔다. 기간이 있으면 기준 분기의 다음 분기와 전년 동기를 검증한다. 예측값을 제공하려면 대상 분기 종료일이 `asOf`보다 이후여야 한다.                     |

예를 들어 `asOf`가 `2026-11-16`이면 승인 자료를 가정한 모의 응답에서 Q2 기준 성장의 Q3 대상은 `target_not_future`로 보류하고, Q2 위험도와 Q3 적합도를 함께 제공할 수 있다. 각 카드와 PDF 보고서에 해당 지표의 기간과 사유를 표시한다. 부분 대응으로 제공된 경우에는 서울 원천 업종과 참고 범위도 표시한다. 통계는 별도 상태와 값을 보존하며 여러 지표를 묶은 종합점수는 만들지 않는다. 기준 분기 선택과 자료 승인 검증은 BE 책임이다. 오래된 자료 허용 범위·사유 코드와 지표별 출처·사용 가능일 필드는 후속 계약에서 확정한다.

저장소 키 `pickplace.reports.v1`에서 기존 단일 분기 결과와 지표별 분기 결과를 모두 읽는다. 기존 결과에 관측 분기를 새로 추정하지 않는다. 새 형식은 저장 시 `Analysis.period: null`을 사용하며 `ai.metrics`의 개별 기준 분기를 보존한다. 공유 개발·운영 환경에서 응답 형식·데이터 승인·지표별 가용 범위와 FE → BE → FastAPI 호출을 확인해야 한다.

## 분석 결과 화면 후속 연동

현재 분석 응답으로 옮길 수 있는 문구는 성장률의 연구용 여부와 기준·대상 분기, 위험 지수의 기준 분기·원천 업종, 적합도 비교값과 기준일이다. 아래 항목은 자료 형태나 응답 연결을 정한 뒤 구현한다. 종합 상권 점수는 지표별 기준 시점과 단위를 합칠 검증된 산식이 마련될 때까지 보류한다. [로컬 참고 결과 계약](RESEARCH_FORECAST_CONTRACT.md#상권-분석-화면의-로컬-참고-결과)

### 분기별 상권 추이

- **2026-11-25 로컬 확인** — 청운효자동의 H10은 `1111051500`이며 카페 `I21201`과 일부 대응하는 서울 원천 업종은 커피 전문점 `CS100010`이다. 서울 원본에는 2021Q1~2026Q2의 추정매출·점포 관측이 있다. 2026Q2의 추정매출 원본은 4,403,365,282원이고 전체 점포는 124곳이다. 소진공의 2026년 9월 수록 업소 80곳은 집계 범위와 시점이 다르다.
- **게시 통계 경로** — Spring `GET /api/regions/{H10}/trends`에 `datasetCode=SALES` 또는 `STORE`, `industryCode=CS100010`, `fromQuarter=20252`, `toQuarter=20262`를 전달한다. 한 번에 최대 8분기를 요청한다. `LISTED_STORE`는 소진공 `businessTypeCode=I21201`로 따로 조회한다. 로컬에서는 서울 매출·점포 요청이 500, 수록 업소 요청이 조회 범위 전체 `NOT_PUBLISHED`였다. T32 시험 데이터가 `definition_json={}`로 게시되어 `TrendQueryRepository`의 `JSON_EXTRACT(..., '$.metrics')`가 SQL null을 반환하고, `TrendService.definitions()`의 `readTree(null)` 호출에서 실패했다. 시험 배치에 실제 적재 정의와 일치하는 `metrics` 배열을 넣고 다시 조회한다. [Spring 추이 API](../../pickplace-backend/docs/api/trend-api.md)
- **로컬 연구 자료 경로** — 배치 게시가 준비되지 않은 환경에서는 FastAPI 내부 `GET /research/seoul/indicators`를 로컬 통합 서버에서 중계할 수 있다. H10과 서울 원천 행정동 코드의 승인된 대응을 사용하고, 조회 필드마다 상태와 사유를 보존한다. [서울 현황 연구 API](../../pickplace-ai/docs/SEOUL_INDICATORS_API.md)
- **화면 적용·검증** — 분기 DTO와 그래프를 사용한다. 매출액은 원 단위 원천값이며 집계 정의가 미확인된 값은 그 상태를 표시한다. 서울 점포 집계는 해당 기간 폐업 점포도 포함한다. 길단위인구는 행정동의 원천 총량, 주민등록인구는 게시 기준월 자료로 각각 표시한다. 분기 관측을 월평균 매출이나 일평균 유동인구로 환산하는 작업은 자료 정의 확인 후 검토한다. 실제 0, 미게시, 누락을 구분하고 빈 구간은 그래프에서 끊어 표시한다. 청운효자동에서 같은 범위로 2025Q2~2026Q2를 조회해 분기·단위·원천 업종을 대조한다.

### 위험 지수 산정 요인

FastAPI `/predict`는 `risk_indicators`에 관측값과 사유를, `risk.components`에 초안 지수의 기여점수를 반환한다. Spring의 `PerIndicatorAnalysisService`는 현재 지표별 상태·기준 분기·대표값·사유를 전달한다. 요인 패널을 연결할 때는 위험 지수를 계산한 **같은 요청 응답**에서 다음 값을 함께 전달한다.

| 2026Q2 청운효자동·커피 전문점 예시 | 관측값                                                       | 위험 지수 기여 |
| ---------------------------------- | ------------------------------------------------------------ | -------------- |
| 전년 동기 대비 추정매출 변화       | 2025Q2 4,603,714,789원에서 2026Q2 4,403,365,282원으로 −4.35% | 8.70점         |
| 해당 분기 집계 점포 대비 폐업 부담 | 7곳 ÷ 124곳 = 5.65%                                          | 18.82점        |

- BE는 `sales_yoy_change`, `closure_burden`별 상태·기준 분기·비교 분기·원천 업종과 사유를 노출할 응답 위치를 정한다. 기여점수는 `risk.components`의 초안 정책 정보와 함께 전달한다. [위험 지수 산식](../../pickplace-ai/src/pickplace_ai/scoring.py)
- FE는 제목을 **위험 지수 산정 요인**으로 표시하고 관측값·기여점수의 단위를 구분한다. 폐업 부담은 해당 분기 점포 수 대비 폐업 수로 표기한다. 값이 없으면 개별 사유를 표시한다. 실제 요청에서 두 기여점수의 합을 위험 지수 27.52점과 대조하고 누락 사례와 지원 범위 밖 업종을 검증한다.

### 주변 비교 범위

현재 적합도 응답은 2026-06-30 기준 서울의 동일 원천 업종 비교 대상과 백분위를 반환한다. 청운효자동 커피 전문점은 121개 행정동 중 점포당 주민 수 백분위 5.0, 점포 밀집도 백분위 46.67이다. 비교 범위를 지도상 인접 지역으로 확장하려면 BE에서 반경 또는 경계 인접 기준, 동일 시점·업종과 최소 표본을 정하고 집계값을 제공한다. 화면에서는 비교 집단의 이름·기준일·표본 수를 값과 함께 표시한다.

## POST /analyses (기존 미적용 계약 초안)

```json
{ "regionCode": "11200690", "industryCode": "coffee" }
```

우클릭 카드의 ‘이 지역 분석’도 같은 경로·요청 필드·결과 처리 흐름을 사용합니다. 예를 들어 카카오 좌표 조회가 아래 행정동을 반환하면 원본 **10자리 H 코드**를 그대로 전달합니다.

```json
{ "regionCode": "1117065000", "industryCode": "coffee" }
```

FE 목록 매칭으로 지역을 차단하거나 이름·거리로 다른 코드에 연결하지 않습니다. H 코드를 임의로 8자리로 자르지 않으며 `industryCode`는 드롭다운의 선택값입니다. BE는 이 코드의 유효성·분석 지원·표본 부족 여부를 판별하고 응답 `request`에는 요청 코드를 그대로 보존해야 합니다. 8자리 목록 코드와 10자리 조회 코드의 내부 변환이 필요하면 BE 어댑터에서 처리하거나 계약을 합의해 조정합니다. **10자리 H 코드 수용·실제 서버 연결은 아직 BE와 검증하지 않은 초안**입니다. 요청 필드 추가·지표별 분석 API는 이번 변경에 포함하지 않습니다.

드롭다운의 ‘데이터’는 현재 기존 계약의 분석 업종으로 해석했습니다. 매출·유동인구 등 지표별 선택을 뜻하는 경우 별도 계약 확정이 필요합니다.

200 응답은 `src/types/analysis.ts`의 `Analysis` 전체 구조를 반환합니다. 실행 가능한 전체 예시는 `src/data/demo.ts`의 `createDemoAnalysis()`에 있습니다.

| 필드                                 | 의미 / 단위                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| id, request                          | 분석 식별자 및 요청 조건                                                                                                        |
| regionName, industryName             | 화면용 지역·업종 명칭                                                                                                           |
| period                               | `YYYY.MM` 기준 월 또는 `YYYYQn` 기준 분기                                                                                       |
| analyzedAt                           | 시간대가 포함된 ISO 8601 시각                                                                                                   |
| source                               | `api` 또는 `demo`, API 응답의 값을 유지                                                                                         |
| scores.overall / growth / risk / fit | `{value: 0~100, grade: string, description: string}` 또는 null                                                                  |
| factors                              | `{name, description, contribution}` · 기여도는 부호 있는 점수                                                                   |
| trends                               | 월 오름차순, 빈 배열 허용. 각 수치는 null 허용. `{month: YYYY-MM, sales, population, stores, openings, closures, averageSales}` |
| trends.sales / averageSales          | 점포당 월평균 매출, 만원                                                                                                        |
| trends.population                    | 일평균 유동인구, 명                                                                                                             |
| trends.stores / openings / closures  | 점포·개업·폐업 수, 개                                                                                                           |
| competition                          | `{name, local, average, unit}` · 선택 지역과 상위 비교 지역의 같은 단위 지표                                                    |
| map                                  | `{center: [위도, 경도], boundary: [위도, 경도][], places: [...]}`                                                               |
| map.places                           | `{id, name, type: competitor\|transport\|facility, position: [위도, 경도]}`                                                     |
| summary / recommendations            | AI 진단 문장 / 권장 확인 사항 배열                                                                                              |
| researchForecast                     | 선택적 연구용 분기 성장률과 기준일·모델·경고. [상세 계약](RESEARCH_FORECAST_CONTRACT.md)                                        |

위험도는 **높을수록 위험**, 나머지 점수는 높을수록 긍정적입니다. 등급·문구는 BE/AI 값을 그대로 표시합니다. 선택 지역의 상위 비교 지역을 매출 차트의 지역 평균으로 사용합니다. 경계는 빈 배열일 수 있으며, 이때 중심점을 표시합니다. 시설 목록 및 요인·비교·추천 목록도 빈 배열을 허용합니다. 점수/수치/좌표 범위와 필수 필드는 런타임에 검증하며 요청 조건과 다른 결과는 거부합니다.

기존 분석 응답의 `map.boundary`는 **WGS84 `[위도, 경도][]` 단일 링**이며 GeoJSON `Polygon/MultiPolygon` 객체·복수 경계·구멍으로 변경하지 않았습니다. 분석 결과·저장 데이터 형식도 유지합니다. 분석 전 조회와 복수 폴리곤·구멍 표시는 위 독립 경계 DTO를 사용합니다. 독립 조회 대상이 있으면 기존 분석 경계로 실패를 대체하지 않으며, 독립 조회가 없는 기존 분석 경로에서만 기존 경계 표시를 유지합니다. 경계는 카카오 공개 API에서 자동 수신하지 않습니다. 데이터 후보·출처·H 코드 대응·좌표계 확인은 [행정동 경계 조사](MAPS.md#행정동-경계-데이터와-자체-표기)를 따릅니다.

## 오류

아래는 분석 API의 오류 처리입니다. 독립 경계 조회의 404 조합과 오류 처리는 위 `GET /regions/{H10}/boundary` 계약을 따릅니다.

```json
{ "code": "INSUFFICIENT_DATA", "message": "분석 표본이 부족합니다." }
```

BE 공통 오류 래퍼의 `error.code`와 `meta.requestId`도 처리합니다. 기존 최상위 `code` 형식은 유지하며 래퍼와 최상위 코드가 모두 있으면 래퍼를 우선합니다. 요청 ID가 본문에 없으면 읽을 수 있는 `X-Request-Id` 응답 헤더를 사용하고, 분석 오류 안내에 표시합니다. 서버의 상세 메시지는 그대로 노출하지 않습니다. 이 오류 처리는 분석 성공 응답 계약의 변경이나 실제 분석 API 연결을 뜻하지 않습니다.

- 422 + `INSUFFICIENT_DATA`: 데이터 부족 안내
- 나머지 4xx/5xx: 오류 + 재시도
- 연결 실패/30초 초과: 네트워크/타임아웃 안내
- 잘못된 응답: 형식 오류 안내
- 이전 요청 취소: 이전 결과가 최신 결과를 덮어쓰지 않음

위 상태/코드 조합은 계약 초안입니다. 현재 FE는 비정상 HTTP 응답의 `code === 'INSUFFICIENT_DATA'` 여부로 데이터 부족 화면을 구분하므로, 422만으로는 부족하며 다른 비정상 상태에 같은 코드가 있어도 부족 화면이 됩니다. 서버 `message`는 현재 직접 표시하지 않고 FE 고정 안내문을 사용합니다. 그 외 오류의 세분화는 BE/FE 합의 후 추가합니다.

API 실패 시 예시 데이터로 자동 전환하지 않습니다. 인증 방식·비동기 작업 API·전국 목록 페이지네이션은 BE와 확정 후 추가합니다. API가 별도 도메인이면 FE 도메인에 대한 CORS 허용이 필요합니다. VITE 환경변수는 브라우저에 노출되므로 비밀키를 넣지 않습니다.
