# PickPlace FE · API 연동 계약 초안

BE 스펙이 아직 제공되지 않아 작성한 초안입니다. BE 확정 시 `src/lib/api.ts`의 어댑터를 조정합니다. 모든 요청·응답은 JSON이며, 아래 경로는 `VITE_API_BASE_URL` 뒤에 붙습니다. 요청 제한 시간은 30초입니다.

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

## 오류

```json
{ "code": "INSUFFICIENT_DATA", "message": "분석 표본이 부족합니다." }
```

- 422 + `INSUFFICIENT_DATA`: 데이터 부족 안내
- 나머지 4xx/5xx: 오류 + 재시도
- 연결 실패/30초 초과: 네트워크/타임아웃 안내
- 잘못된 응답: 형식 오류 안내
- 이전 요청 취소: 이전 결과가 최신 결과를 덮어쓰지 않음

API 실패 시 예시 데이터로 자동 전환하지 않습니다. 인증 방식·비동기 작업 API·전국 목록 페이지네이션은 BE와 확정 후 추가합니다. API가 별도 도메인이면 FE 도메인에 대한 CORS 허용이 필요합니다. VITE 환경변수는 브라우저에 노출되므로 비밀키를 넣지 않습니다.
