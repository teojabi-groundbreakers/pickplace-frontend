import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { config } from '../lib/config'
import { createDemoAnalysis, defaultRequest } from '../data/demo'
import type { AnalysisRequest } from '../types/analysis'
import type { MapRendererProps } from '../types/map'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('../lib/regionLookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionLookup')>()),
  lookupAdministrativeRegion: lookup,
}))
vi.mock('../lib/regionBoundary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/regionBoundary')>()),
  getRegionBoundary: vi.fn().mockResolvedValue(null),
}))
vi.mock('../components/KakaoMap', () => ({
  KakaoMap: ({ onPointSelect, exploreRegion }: MapRendererProps) => (
    <section aria-label="위치 분석 테스트 지도">
      <button onClick={() => onPointSelect?.([37.53213, 126.99267])}>지도 우클릭</button>
      <output aria-label="둘러보기 위치">{JSON.stringify(exploreRegion || null)}</output>
    </section>
  ),
}))

const fetchMock = vi.fn()
const location = {
  region_type: 'H',
  code: '1117065000',
  address_name: '서울특별시 용산구 이태원1동',
  region_1depth_name: '서울특별시',
  region_2depth_name: '용산구',
  region_3depth_name: '이태원1동',
}

function response(request: AnalysisRequest) {
  const example = createDemoAnalysis(defaultRequest)
  return new Response(
    JSON.stringify({
      ...example,
      request,
      regionName: location.address_name,
      industryName: '커피·음료',
      source: 'api',
      map: { center: [37.53213, 126.99267], boundary: [], places: [] },
    }),
  )
}

beforeEach(() => {
  config.demoMode = false
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  lookup.mockReset().mockResolvedValue(location)
  fetchMock.mockReset().mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Promise.resolve(response(JSON.parse(String(init.body))))
    if (url.endsWith('/districts')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: { items: [{ districtCode: '11110', districtName: '종로구' }] },
            meta: { requestId: 'district-test' },
          }),
        ),
      )
    }
    if (url.endsWith('/business-types')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              items: [
                { businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: true },
              ],
            },
            meta: { requestId: 'industry-test' },
          }),
        ),
      )
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  config.demoMode = true
  vi.unstubAllGlobals()
})

async function query() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: '지도 우클릭' }))
  await screen.findByText(location.address_name)
  return user
}

describe('조회 위치의 백엔드 분석과 둘러보기', () => {
  it('목록에 없는 행정동 H 코드와 선택 업종을 POST하고 재분석·저장 후 재열기에도 유지한다', async () => {
    const user = await query()
    await user.selectOptions(screen.getByLabelText('분석할 업종'), 'CS100010')
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    await screen.findByRole('heading', { name: /이태원1동/ })
    const request = { regionCode: location.code, industryCode: 'CS100010' }
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/analyses',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request),
      }),
    )
    expect(screen.queryByText(/아래는 이전 조건의 결과/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '분석 저장' }))
    await user.click(screen.getByRole('link', { name: /저장한 분석/ }))
    await user.click(screen.getByRole('button', { name: '분석 다시 보기' }))
    await screen.findByRole('heading', { name: /이태원1동/ })
    await user.click(await screen.findByRole('button', { name: '지도 우클릭' }))
    await user.selectOptions(await screen.findByLabelText('분석할 업종'), 'CS100010')
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    await screen.findByRole('heading', { name: /이태원1동/ })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/analyses',
      expect.objectContaining({
        body: JSON.stringify(request),
      }),
    )
  })

  it('둘러보기는 분석을 요청하지 않고 클릭 좌표와 행정동을 지도에 전달한다', async () => {
    const user = await query()
    await user.click(screen.getByRole('button', { name: '이 지역 둘러보기' }))
    expect(JSON.parse(screen.getByLabelText('둘러보기 위치').textContent || '')).toMatchObject({
      code: location.code,
      center: [37.53213, 126.99267],
    })
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    expect(screen.queryByRole('region', { name: '행정구역 조회' })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: '분석 결과 패널' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '지도 우클릭' }))
    await user.selectOptions(await screen.findByLabelText('분석할 업종'), 'CS100010')
    expect(screen.getByLabelText('둘러보기 위치')).toHaveTextContent(location.code)
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    await screen.findByRole('heading', { name: /이태원1동/ })
    expect(screen.getByLabelText('둘러보기 위치')).toHaveTextContent('null')
  })

  it('지역 지원·데이터 부족 여부를 서버 응답으로 처리하며 오류 재시도는 같은 코드로 요청한다', async () => {
    const user = await query()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'INSUFFICIENT_DATA' }), { status: 422 }),
    )
    await user.selectOptions(screen.getByLabelText('분석할 업종'), 'CS100010')
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    await screen.findByText('아직 데이터가 충분하지 않아요')
    await user.click(screen.getByRole('button', { name: '지도 우클릭' }))
    await screen.findByRole('region', { name: '행정구역 조회' })
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 503 }))
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    await screen.findByText('분석을 완료하지 못했어요')
    await user.click(screen.getByRole('button', { name: '다시 시도하기' }))
    await screen.findByRole('heading', { name: /이태원1동/ })
    const requests = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(requests).toHaveLength(3)
    expect(requests.every(([, init]) => JSON.parse(init.body).regionCode === location.code)).toBe(
      true,
    )
  })

  it('검색 목록 연결 실패 중에도 실제 위치 조회와 둘러보기를 유지한다', async () => {
    const original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url.endsWith('/business-types')
        ? Promise.resolve(new Response('error', { status: 503 }))
        : original!(url, init),
    )
    const user = await query()
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '이 지역 둘러보기' }))
    expect(
      within(screen.getByRole('region', { name: '위치 분석 테스트 지도' })).getByLabelText(
        '둘러보기 위치',
      ),
    ).toHaveTextContent(location.code)
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })
})
