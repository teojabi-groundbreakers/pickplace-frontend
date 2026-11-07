# 연구용 분기 성장률 연동 계약 초안

FE는 메인 Spring Boot의 `/analyses`만 호출한다. 별도 FastAPI 주소와 내부 인증키는 브라우저에 제공하지 않는다. 이 문서는 FE와 로컬 AI 구현을 맞추기 위한 초안이며 실제 Spring Boot 연동·팀 계약 승인을 뜻하지 않는다.

## 응답과 표시

기존 `Analysis`의 네 점수는 각각 `Score` 또는 `null`이다. 근거 없는 0점·등급을 만들지 않는다. `trends`가 없으면 빈 배열로 전달하고, 월별 값이 부분적으로 없으면 그 항목을 `null`로 전달한다. FE는 0을 실제 0으로, `null`을 미제공으로 구분하고 없는 달이나 값을 선으로 잇지 않는다. `period`는 기존 `YYYY.MM` 또는 분기 `YYYYQn`을 지원한다.

월별 그래프는 여전히 계약상 점포당 월평균 매출(만원), 일평균 유동인구, 점포 수를 뜻한다. 서울 AI의 기관 제공 분기 집계를 근거 없이 월평균·점포당 값으로 바꾸지 않는다. 월별 자료를 확인하지 못했다면 `trends: []`로 전달한다. 성장률은 따로 연구용 카드에 표시한다.

`researchForecast`는 없거나 null일 수 있다. 있을 때 BE가 AI 응답을 다음과 같이 매핑한다. 두 분기는 별도 API 요청이며, 같은 모델·기준 시점의 결과만 묶는다.

| FE 필드                                  | AI 응답 또는 BE 설정                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`                                   | `mode`, 현재 `experimental_research_only`                                                                                                              |
| `method`                                 | 동적 추론이면 `model_inference`                                                                                                                        |
| `basePeriod`                             | `base_period`, 현재 `2026Q2`                                                                                                                           |
| `dataAsOf`                               | `snapshot_available_at` (데이터 확보일)                                                                                                                |
| `modelVersion`                           | `model_sha256` 등 추적 가능한 모델 식별자                                                                                                              |
| `inputValuesVerified`                    | `input_values_verified` 그대로                                                                                                                         |
| `regionScopeVerified`                    | `region_scope_verified` 그대로                                                                                                                         |
| `predictions[].targetPeriod`             | `target_period`                                                                                                                                        |
| `predictions[].status`, `reason`         | `status`, `reason` 그대로                                                                                                                              |
| `predictions[].estimatedYoYGrowth`       | `estimated_yoy_growth` 비율 그대로. `0.05`는 FE에 `+5.0%`로 표시                                                                                       |
| `predictions[].estimateKind`, `warnings` | `estimate_kind`, `warnings` 그대로                                                                                                                     |
| 선택 `predictions[].retrospectiveTest`   | `retrospective_test`의 `target_period`, `rows`, `mae_pp`, `median_absolute_error_pp`를 `targetPeriod`, `rows`, `maePp`, `medianAbsoluteErrorPp`로 변환 |

`retrospectiveTest`는 과거 후향 시험의 평균·중앙 절대오차(퍼센트포인트)이며 미래 신뢰구간이나 정확도가 아니다. AI의 `scope_seen_in_training`은 모델 학습에 해당 조합이 있었는지에 관한 사실일 뿐 코드 대응·지역 적용성 검증이 아니다. `regionScopeVerified=false`, `inputValuesVerified=false`를 임의로 true로 바꾸지 않는다.

`status=unavailable`이면 성장률은 null이고 사유가 있어야 한다. 성공이면 유한한 성장률과 null 사유가 필요하다. 예측 분기 중복, 불가능한 날짜, -100% 미만 성장률은 FE가 거부한다. AI HTTP 200의 `unavailable`은 유효한 부분 결과이며, 401/422/503·네트워크 장애를 0이나 데모로 바꾸지 않는다. 최종 결과의 `source`는 BE가 제공한 출처를 유지하며 연구용 여부는 별도 `mode`로 판단한다.

## 아직 필요한 BE 작업

- 카카오 H10과 서울 `seoul-adstrd` 8자리의 공식 대응·기준일을 확인한다. 코드 자르기와 이름 추정을 사용하지 않는다.
- AI에 동일 지역·업종의 `2025Q2~2026Q2` 연속 5분기 이력과 실제 데이터 취득일을 전달한다. AI 서버는 현재 기준 분기·지원 대상이 고정되어 있다.
- PR #18의 실제 API 모드에서는 BE의 자치구·행정동·지원 업종 개별 API를 사용한다. `CS...` 업종은 데모의 `coffee` 등 별칭과 다르며, 목록의 8자리와 H10의 공식 대응 및 지도 이동은 별도 확인이 필요하다.
- AI 연결 실패와 데이터 부족, 부분 결과, 형식 오류를 구분하고 모델키는 BE 환경에서만 보관한다. FE·BE·AI 실제 연결, 인수 테스트와 운영 배포는 아직 수행하지 않았다.
