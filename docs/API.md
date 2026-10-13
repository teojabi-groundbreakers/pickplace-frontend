# PickPlace FE · API 연동 계약 초안

BE 스펙이 아직 제공되지 않아 작성한 초안입니다. BE 확정 시 `src/lib/api.ts`와 독립 경계의 `src/lib/regionBoundary.ts` 어댑터를 조정합니다. 모든 요청·응답은 JSON이며, 아래 경로는 `VITE_API_BASE_URL` 뒤에 붙습니다. 요청 제한 시간은 30초입니다.

백엔드 개발의 우선순위·산출물·현재 FE 제약·인수 시나리오는 [백엔드 인계 문서](BACKEND_HANDOFF.md)에 있습니다. 이 문서는 요청·응답 상세 계약의 원본으로 유지합니다.

## GET /catalog

시·도 → 시·군·구 → 행정동, 업종 대분류 → 세부 업종 목록을 반환합니다. `src/types/analysis.ts`의 `Catalog` 형식을 따릅니다.

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

지역 목록은 검색·계층 선택을 위한 편의 데이터이며 분석 가능한 지역의 허용 목록이 아닙니다. 지도에서 실제 조회한 행정동은 이 목록에 없어도 분석을 요청합니다. 업종 드롭다운은 API 모드에서 서버가 제공한 `categories[].industries`를 사용하며 업종 목록 조회 실패 시 분석을 비활성화합니다. 위치 조회·둘러보기는 계속 사용할 수 있습니다.

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

출처·사용 조건·H 코드 매핑·경계 기준일·원본 CRS·갱신/캐시 정책은 BE가 관리합니다. 서비스 Secret을 FE에 전달하지 않습니다. 구현은 [경계 클라이언트와 검증](../src/lib/regionBoundary.ts), [요청 상태](../src/lib/useRegionBoundary.ts), [지도 흐름](MAPS.md)을 참조합니다.

## POST /analyses

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

| 필드                                 | 의미 / 단위                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| id, request                          | 분석 식별자 및 요청 조건                                                                               |
| regionName, industryName             | 화면용 지역·업종 명칭                                                                                  |
| period                               | `YYYY.MM` 기준 월                                                                                      |
| analyzedAt                           | 시간대가 포함된 ISO 8601 시각                                                                          |
| source                               | `api` (FE는 API 응답을 항상 api로 표기)                                                                |
| scores.overall / growth / risk / fit | `{value: 0~100, grade: string, description: string}`                                                   |
| factors                              | `{name, description, contribution}` · 기여도는 부호 있는 점수                                          |
| trends                               | 월 오름차순, 최소 1개. `{month: YYYY-MM, sales, population, stores, openings, closures, averageSales}` |
| trends.sales / averageSales          | 점포당 월평균 매출, 만원                                                                               |
| trends.population                    | 일평균 유동인구, 명                                                                                    |
| trends.stores / openings / closures  | 점포·개업·폐업 수, 개                                                                                  |
| competition                          | `{name, local, average, unit}` · 선택 지역과 상위 비교 지역의 같은 단위 지표                           |
| map                                  | `{center: [위도, 경도], boundary: [위도, 경도][], places: [...]}`                                      |
| map.places                           | `{id, name, type: competitor\|transport\|facility, position: [위도, 경도]}`                            |
| summary / recommendations            | AI 진단 문장 / 권장 확인 사항 배열                                                                     |

위험도는 **높을수록 위험**, 나머지 점수는 높을수록 긍정적입니다. 등급·문구는 BE/AI 값을 그대로 표시합니다. 선택 지역의 상위 비교 지역을 매출 차트의 지역 평균으로 사용합니다. 경계는 빈 배열일 수 있으며, 이때 중심점을 표시합니다. 시설 목록 및 요인·비교·추천 목록도 빈 배열을 허용합니다. 점수/수치/좌표 범위와 필수 필드는 런타임에 검증하며 요청 조건과 다른 결과는 거부합니다.

기존 분석 응답의 `map.boundary`는 **WGS84 `[위도, 경도][]` 단일 링**이며 GeoJSON `Polygon/MultiPolygon` 객체·복수 경계·구멍으로 변경하지 않았습니다. 분석 결과·저장 데이터 형식도 유지합니다. 분석 전 조회와 복수 폴리곤·구멍 표시는 위 독립 경계 DTO를 사용합니다. 독립 조회 대상이 있으면 기존 분석 경계로 실패를 대체하지 않으며, 독립 조회가 없는 기존 분석 경로에서만 기존 경계 표시를 유지합니다. 경계는 카카오 공개 API에서 자동 수신하지 않습니다. 데이터 후보·출처·H 코드 대응·좌표계 확인은 [행정동 경계 조사](MAPS.md#행정동-경계-데이터와-자체-표기)를 따릅니다.

## 오류

아래는 분석 API의 오류 처리입니다. 독립 경계 조회의 404 조합과 오류 처리는 위 `GET /regions/{H10}/boundary` 계약을 따릅니다.

```json
{ "code": "INSUFFICIENT_DATA", "message": "분석 표본이 부족합니다." }
```

- 422 + `INSUFFICIENT_DATA`: 데이터 부족 안내
- 나머지 4xx/5xx: 오류 + 재시도
- 연결 실패/30초 초과: 네트워크/타임아웃 안내
- 잘못된 응답: 형식 오류 안내
- 이전 요청 취소: 이전 결과가 최신 결과를 덮어쓰지 않음

위 상태/코드 조합은 계약 초안입니다. 현재 FE는 비정상 HTTP 응답의 `code === 'INSUFFICIENT_DATA'` 여부로 데이터 부족 화면을 구분하므로, 422만으로는 부족하며 다른 비정상 상태에 같은 코드가 있어도 부족 화면이 됩니다. 서버 `message`는 현재 직접 표시하지 않고 FE 고정 안내문을 사용합니다. 그 외 오류의 세분화는 BE/FE 합의 후 추가합니다.

API 실패 시 예시 데이터로 자동 전환하지 않습니다. 인증 방식·비동기 작업 API·전국 목록 페이지네이션은 BE와 확정 후 추가합니다. API가 별도 도메인이면 FE 도메인에 대한 CORS 허용이 필요합니다. VITE 환경변수는 브라우저에 노출되므로 비밀키를 넣지 않습니다.
