import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceSearch } from '../components/ReferenceSearch'

type Props = Parameters<typeof ReferenceSearch>[0]

function createProps(): Props {
  return {
    provinces: [{ code: '11', name: '서울특별시' }],
    districts: {
      status: 'success',
      items: [{ districtCode: '11560', districtName: '영등포구' }],
    },
    dongs: { status: 'idle' },
    businessTypes: {
      status: 'success',
      items: [{ businessTypeCode: 'CS100010', businessTypeName: '커피·음료', supported: true }],
    },
    provinceCode: '11',
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
          officialCodeStatus: 'CURRENT',
        },
      },
    ],
    searchStatus: 'success',
    onRetryLocation: vi.fn(),
    onProvinceChange: vi.fn(),
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
  it('전달받은 시도 목록을 표시하고 선택한 코드를 전달한다', async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.provinces = [
      { code: '11', name: '서울특별시' },
      { code: '41', name: '경기도' },
    ]
    render(<ReferenceSearch {...props} />)

    await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
    await user.selectOptions(screen.getByLabelText('시·도'), '41')

    expect(props.onProvinceChange).toHaveBeenCalledWith('41')
  })

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

  it('전국 시·도 목록의 오류와 재시도를 표시하고 로딩 중 선택을 막는다', async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.nationwide = true
    props.provinces = []
    props.provinceState = { status: 'loading' }
    props.onRetryProvinces = vi.fn()
    const { rerender } = render(<ReferenceSearch {...props} />)

    await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
    expect(screen.getByLabelText('시·도')).toBeDisabled()
    expect(screen.getByText('시·도 목록을 불러오고 있어요.')).toBeInTheDocument()

    rerender(
      <ReferenceSearch
        {...props}
        provinceState={{ status: 'error', message: '목록 조회 오류', requestId: 'region-id' }}
      />,
    )
    expect(screen.getByText('목록 조회 오류')).toBeInTheDocument()
    expect(screen.getByText('요청 ID: region-id')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '시·도 다시 불러오기' }))
    expect(props.onRetryProvinces).toHaveBeenCalledTimes(1)
  })

  it('전국 지역 코드를 바꾸지 않고 표시 순서를 보존해 선택한다', async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.nationwide = true
    props.provinces = [{ code: '4100000000', name: '경기도' }]
    props.provinceCode = '4100000000'
    props.provinceState = { status: 'success', items: props.provinces }
    props.districts = {
      status: 'success',
      items: [
        { districtCode: '4111500000', districtName: '수원시 장안구' },
        { districtCode: '4111100000', districtName: '수원시 팔달구' },
      ],
    }
    props.districtCode = '4111500000'
    props.dongs = {
      status: 'success',
      items: [
        {
          dongCode: '4111553000',
          dongName: '파장동',
          officialCodeStatus: 'CURRENT',
        },
      ],
    }
    props.searchDongs = undefined
    props.searchStatus = 'idle'
    render(<ReferenceSearch {...props} />)

    await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
    const groups = screen.getByLabelText('시·군·구')
    expect(
      within(groups)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['시·군·구 선택', '수원시 장안구', '수원시 팔달구'])
    await user.selectOptions(screen.getByLabelText('읍·면·행정동'), '4111553000')
    expect(props.onDongChange).toHaveBeenCalledWith('4111553000')

    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), '파장동')
    await user.click(screen.getByRole('button', { name: '수원시 장안구 파장동' }))
    expect(props.onDongChange).toHaveBeenCalledWith('4111553000')
  })

  it('분석 계약이 준비되지 않은 지역은 안내를 표시하고 분석 요청을 막는다', async () => {
    const user = userEvent.setup()
    const props = createProps()
    props.nationwide = true
    props.analysisUnavailableMessage = '이 지역의 분석은 준비 중이에요.'
    props.pointRegion = {
      code: '4111553000',
      name: '파장동',
      fullName: '경기도 수원시 장안구 파장동',
      center: [37.3, 127],
    }
    props.locationState = { status: 'success' }
    render(<ReferenceSearch {...props} />)

    expect(screen.getByText('이 지역의 분석은 준비 중이에요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '상권 분석하기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '업종·지역 조건' }))
    expect(screen.getByRole('button', { name: '상권 분석하기' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form', { name: '상권 분석 조건' }))
    expect(props.onAnalyze).not.toHaveBeenCalled()
  })
})
