import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceSearch } from '../components/ReferenceSearch'

type Props = Parameters<typeof ReferenceSearch>[0]

function createProps(): Props {
  return {
    districts: {
      status: 'success',
      items: [{ districtCode: '11560', districtName: '영등포구' }],
    },
    dongs: { status: 'idle' },
    businessTypes: {
      status: 'success',
      items: [{ businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: true }],
    },
    districtCode: '',
    dongCode: '',
    businessTypeCode: 'CS100010',
    locationState: { status: 'idle' },
    pending: false,
    searchDongs: [
      {
        district: { districtCode: '11560', districtName: '영등포구' },
        dong: {
          dongCode: '11560700',
          dongName: '대림1동',
          districtCode: '11560',
          officialCodeStatus: 'CURRENT',
          regionVersion: 'test-version',
        },
      },
    ],
    searchStatus: 'success',
    onRetryLocation: vi.fn(),
    onDistrictChange: vi.fn(),
    onDongChange: vi.fn(),
    onBusinessTypeChange: vi.fn(),
    onAnalyze: vi.fn(),
    onRetryDistricts: vi.fn(),
    onRetryDongs: vi.fn(),
    onRetryBusinessTypes: vi.fn(),
  }
}

describe('서버 지역 검색 구성 요소', () => {
  it('행정동 검색 결과 선택 시 자치구와 원천 동 코드를 전달한다', async () => {
    const user = userEvent.setup()
    const props = createProps()
    render(<ReferenceSearch {...props} />)

    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), '대림1동')
    await user.click(screen.getByRole('button', { name: '영등포구 대림1동' }))

    expect(props.onDistrictChange).toHaveBeenCalledWith('11560')
    expect(props.onDongChange).toHaveBeenCalledWith('11560700')
  })

  it('선택 지역의 검증된 위치가 없으면 분석 요청을 보내지 않는다', async () => {
    const user = userEvent.setup()
    const props = createProps()
    render(<ReferenceSearch {...props} />)

    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))

    expect(screen.getByText('지역의 위치를 확인한 뒤 분석해 주세요.')).toBeInTheDocument()
    expect(props.onAnalyze).not.toHaveBeenCalled()
  })
})
