import type { Analysis, AnalysisRequest, Catalog } from '../types/analysis'

export const demoCatalog: Catalog = {
  cities: [
    {
      code: '11',
      name: '서울특별시',
      districts: [
        {
          code: '11200',
          name: '성동구',
          neighborhoods: [
            { code: '11200690', name: '성수2가1동', center: [37.5396, 127.0555] },
            { code: '11200650', name: '성수1가1동', center: [37.542, 127.0444] },
            { code: '11200590', name: '왕십리도선동', center: [37.5678, 127.0255] },
          ],
        },
        {
          code: '11680',
          name: '강남구',
          neighborhoods: [
            { code: '11680640', name: '역삼1동', center: [37.501, 127.037] },
            { code: '11680521', name: '논현1동', center: [37.5115, 127.0285] },
          ],
        },
        {
          code: '11440',
          name: '마포구',
          neighborhoods: [
            { code: '11440660', name: '서교동', center: [37.5535, 126.9205] },
            { code: '11440600', name: '합정동', center: [37.5496, 126.9138] },
            { code: '11440590', name: '연남동', center: [37.5645, 126.922] },
          ],
        },
      ],
    },
    {
      code: '26',
      name: '부산광역시',
      districts: [
        {
          code: '26350',
          name: '해운대구',
          neighborhoods: [
            { code: '26350510', name: '우1동', center: [35.163, 129.159] },
            { code: '26350540', name: '중1동', center: [35.1635, 129.175] },
          ],
        },
      ],
    },
  ],
  categories: [
    {
      code: 'food',
      name: '음식',
      industries: [
        { code: 'coffee', name: '카페 / 커피전문점' },
        { code: 'korean', name: '한식 음식점' },
        { code: 'bakery', name: '베이커리' },
        { code: 'western', name: '양식 음식점' },
      ],
    },
    {
      code: 'retail',
      name: '소매',
      industries: [
        { code: 'convenience', name: '편의점' },
        { code: 'fashion', name: '의류 / 패션' },
        { code: 'flowers', name: '꽃 / 식물' },
      ],
    },
    {
      code: 'service',
      name: '생활 서비스',
      industries: [
        { code: 'beauty', name: '미용실' },
        { code: 'fitness', name: '피트니스' },
      ],
    },
  ],
}

export const defaultRequest: AnalysisRequest = { regionCode: '11200690', industryCode: 'coffee' }

export function createDemoAnalysis(request: AnalysisRequest): Analysis {
  const district = demoCatalog.cities
    .flatMap((city) => city.districts)
    .find((item) => item.neighborhoods.some((region) => region.code === request.regionCode))
  const region = district?.neighborhoods.find((item) => item.code === request.regionCode)
  const industry = demoCatalog.categories
    .flatMap((category) => category.industries)
    .find((item) => item.code === request.industryCode)
  if (!region || !industry) throw new Error('지원하지 않는 데모 검색 조건입니다.')
  const center = region.center
  const offset =
    request.regionCode === defaultRequest.regionCode && request.industryCode === 'coffee'
      ? 0
      : ([...request.regionCode, ...request.industryCode].reduce(
          (sum, char) => sum + char.charCodeAt(0),
          0,
        ) %
          13) -
        6
  const overall = 82 + offset
  const sales = [2980, 3120, 2870, 3060, 3280, 3190, 3360, 3520, 3410, 3780, 3650, 3980]
  const population = [3240, 3380, 3100, 3450, 3570, 3480, 3620, 3780, 3860, 3970, 4140, 4260]
  return {
    id: `demo-${request.regionCode}-${request.industryCode}`,
    request: { ...request },
    regionName: `${district?.name} ${region.name}`,
    industryName: industry.name,
    period: '2026.09',
    analyzedAt: '2026-09-30T09:00:00+09:00',
    source: 'demo',
    scores: {
      overall: {
        value: overall,
        grade: overall >= 80 ? 'A' : 'B',
        description: '새로운 시작이 기대되는 상권이에요',
      },
      growth: {
        value: 87 + offset,
        grade: '성장',
        description: '방문 수요와 매출이 함께 늘고 있어요.',
      },
      risk: { value: 32 - offset, grade: '보통', description: '동종 점포와의 경쟁을 살펴보세요.' },
      fit: {
        value: 91 + offset,
        grade: '매우 적합',
        description: '상권의 주요 소비층과 잘 맞아요.',
      },
    },
    factors: [
      {
        name: '유동인구 증가',
        description: '주요 소비층의 방문이 꾸준히 늘고 있어요',
        contribution: 18.5,
      },
      {
        name: '매출 성장세',
        description: '동종 업종의 월평균 매출이 상승하고 있어요',
        contribution: 14.2,
      },
      {
        name: '교통 접근성',
        description: '대중교통과 가까워 방문하기 편리해요',
        contribution: 9.8,
      },
      {
        name: '높은 경쟁 밀도',
        description: '주변 동종 점포와의 차별화가 필요해요',
        contribution: -12.4,
      },
    ],
    trends: sales.map((value, index) => ({
      month: `${index < 3 ? 2025 : 2026}-${String(((index + 9) % 12) + 1).padStart(2, '0')}`,
      sales: value + offset * 35,
      population: population[index] + offset * 40,
      stores: 98 + index * 2 + (index % 3),
      openings: [5, 8, 4, 6, 9, 7, 8, 6, 10, 7, 8, 9][index],
      closures: [3, 4, 5, 2, 3, 4, 3, 4, 2, 3, 4, 3][index],
      averageSales: 2700 + index * 55,
    })),
    competition: [
      { name: '동종 점포 수', local: 122, average: 94, unit: '개' },
      { name: '점포당 월 매출', local: 3980 + offset * 35, average: 3305, unit: '만원' },
      { name: '폐업률', local: 4.2, average: 6.8, unit: '%' },
    ],
    map: {
      center,
      boundary: [
        [center[0] + 0.003, center[1] - 0.0035],
        [center[0] + 0.0025, center[1] + 0.003],
        [center[0] - 0.0027, center[1] + 0.004],
        [center[0] - 0.0034, center[1] - 0.002],
      ],
      places: [
        {
          id: '1',
          name: '동종 점포 A (예시)',
          type: 'competitor',
          position: [center[0] + 0.001, center[1] - 0.002],
        },
        {
          id: '2',
          name: '동종 점포 B (예시)',
          type: 'competitor',
          position: [center[0] - 0.001, center[1] + 0.001],
        },
        {
          id: '3',
          name: '동종 점포 C (예시)',
          type: 'competitor',
          position: [center[0] + 0.0016, center[1] + 0.0015],
        },
        {
          id: '4',
          name: '인근 지하철역 (예시)',
          type: 'transport',
          position: [center[0] + 0.0028, center[1] + 0.0002],
        },
        {
          id: '5',
          name: '문화·편의시설 (예시)',
          type: 'facility',
          position: [center[0] - 0.0015, center[1] - 0.0022],
        },
      ],
    },
    summary: `${region.name}은 유동인구와 매출이 함께 성장하며 ${industry.name} 업종에 좋은 가능성을 보여주는 상권입니다. 다만 동종 점포의 밀도가 높은 편이므로, 주요 방문객을 고려한 차별화된 콘셉트가 중요합니다.`,
    recommendations: [
      '주요 소비층에 맞는 메뉴와 가격대를 설계해 보세요.',
      '주말 방문객을 끌어올 수 있는 공간과 경험을 준비해 보세요.',
      '출점 전 임대료와 주변 점포의 운영 현황을 함께 확인하세요.',
    ],
  }
}
