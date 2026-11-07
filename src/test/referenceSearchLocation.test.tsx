import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceSearch } from '../components/ReferenceSearch'
import type { LocationState } from '../components/ReferenceSearch'
import type { MapRegion } from '../types/map'

const point: MapRegion = {
  code: '1156054000',
  name: '대림1동',
  fullName: '서울특별시 영등포구 대림1동',
  center: [37.5, 126.9],
}

function renderSearch(locationState: LocationState, pointRegion: MapRegion | null) {
  const onAnalyze = vi.fn()
  const onRetryLocation = vi.fn()

  render(
    <ReferenceSearch
      provinces={[{ code: '11', name: '서울특별시' }]}
      districts={{
        status: 'success',
        items: [{ districtCode: '11560', districtName: '영등포구' }],
      }}
      dongs={{
        status: 'success',
        items: [
          {
            dongCode: '11560700',
            dongName: '대림1동',
            districtCode: '11560',
            officialCodeStatus: 'CURRENT',
            regionVersion: 'test-version',
          },
        ],
      }}
      businessTypes={{
        status: 'success',
        items: [{ businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: true }],
      }}
      provinceCode="11"
      districtCode="11560"
      dongCode="11560700"
      businessTypeCode="CS100010"
      pointRegion={pointRegion}
      locationState={locationState}
      onRetryLocation={onRetryLocation}
      pending={false}
      onProvinceChange={() => {}}
      onDistrictChange={() => {}}
      onDongChange={() => {}}
      onBusinessTypeChange={() => {}}
      onAnalyze={onAnalyze}
      onRetryDistricts={() => {}}
      onRetryDongs={() => {}}
      onRetryBusinessTypes={() => {}}
    />,
  )

  return { onAnalyze, onRetryLocation }
}

describe('선택 지역 위치 확인', () => {
  it('위치 확인 중에는 분석을 요청하지 않는다', async () => {
    const user = userEvent.setup()
    const { onAnalyze } = renderSearch({ status: 'loading' }, point)
    expect(screen.getByRole('status')).toHaveTextContent('위치를 찾고 있어요')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(onAnalyze).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('위치를 확인하고 있어요')
  })

  it('검증된 위치의 H10과 선택 업종으로 분석하며 기술 코드를 노출하지 않는다', async () => {
    const user = userEvent.setup()
    const { onAnalyze } = renderSearch({ status: 'success' }, point)
    await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
    expect(screen.queryByText(/원천 코드|지역 기준|CURRENT|test-version/)).not.toBeInTheDocument()
    expect(screen.queryByText(/지도는 이동하지 않아요/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(onAnalyze).toHaveBeenCalledWith(point, 'CS100010')
  })

  it.each(['empty', 'error'] as const)(
    '위치 %s 상태에서 이전 좌표로 분석하지 않고 재시도할 수 있다',
    async (status) => {
      const user = userEvent.setup()
      const { onAnalyze, onRetryLocation } = renderSearch(
        { status, message: '위치를 확인하지 못했어요.' },
        point,
      )
      expect(screen.getByRole('alert')).toHaveTextContent('위치를 확인하지 못했어요')
      await user.click(screen.getByRole('button', { name: '위치 다시 찾기' }))
      expect(onRetryLocation).toHaveBeenCalledOnce()
      await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
      expect(onAnalyze).not.toHaveBeenCalled()
    },
  )
})
