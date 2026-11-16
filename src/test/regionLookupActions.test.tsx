import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegionLookupActions } from '../components/RegionLookupActions'
import type { MapRegion, RegionAnalysisOptions } from '../types/map'

const region: MapRegion = {
  code: '4111553000',
  name: '파장동',
  fullName: '경기도 수원시 장안구 파장동',
  center: [37.31, 126.99],
}

function setup() {
  const onAnalyze = vi.fn()
  const onExplore = vi.fn()
  const analysis: RegionAnalysisOptions = {
    categories: [
      {
        code: 'supported',
        name: '지원 업종',
        industries: [{ code: 'CS100010', name: '커피·음료' }],
      },
    ],
    industryCode: 'CS100010',
    onIndustryChange: vi.fn(),
    onAnalyze,
  }
  return { analysis, onAnalyze, onExplore }
}

describe('지도 조회 지역의 분석 준비 상태', () => {
  it('분석을 막아도 직접 submit으로 요청하지 않고 둘러보기는 선택한 좌표로 실행한다', async () => {
    const user = userEvent.setup()
    const { analysis, onAnalyze, onExplore } = setup()
    render(
      <RegionLookupActions
        region={region}
        analysis={analysis}
        onExplore={onExplore}
        analysisUnavailableMessage="이 지역의 분석은 준비 중이에요."
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('이 지역의 분석은 준비 중이에요.')
    expect(screen.getByRole('button', { name: '이 지역 분석' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: '조회 지역 분석 조건' }))
    expect(onAnalyze).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '이 지역 둘러보기' }))
    expect(onExplore).toHaveBeenCalledOnce()
    expect(onExplore).toHaveBeenCalledWith(region)
  })

  it('분석 제한이 해제되면 선택한 지역과 업종으로 요청한다', async () => {
    const user = userEvent.setup()
    const { analysis, onAnalyze, onExplore } = setup()
    const { rerender } = render(
      <RegionLookupActions
        region={region}
        analysis={analysis}
        onExplore={onExplore}
        analysisUnavailableMessage="이 지역의 분석은 준비 중이에요."
      />,
    )

    rerender(
      <RegionLookupActions
        region={region}
        analysis={analysis}
        onExplore={onExplore}
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이 지역 분석' }))
    expect(onAnalyze).toHaveBeenCalledOnce()
    expect(onAnalyze).toHaveBeenCalledWith(region, 'CS100010')
    expect(onExplore).not.toHaveBeenCalled()
  })
})
