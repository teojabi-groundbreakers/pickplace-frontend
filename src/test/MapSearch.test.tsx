import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MapSearch } from '../components/MapSearch'
import { demoCatalog, defaultRequest } from '../data/demo'
import { catalogRegions } from '../lib/catalogRegions'
import { selectionFromRequest } from '../lib/selection'

describe('지도 상단 지역 검색', () => {
  it('키보드로 검색 지역을 선택하고 업종을 유지한 채 분석한다', async () => {
    const submit = vi.fn()
    function Harness() {
      const [selection, setSelection] = useState(selectionFromRequest(demoCatalog, defaultRequest))
      return (
        <MapSearch
          catalog={demoCatalog}
          regions={catalogRegions(demoCatalog)}
          selection={selection}
          initial={defaultRequest}
          pending={false}
          onChange={setSelection}
          onRegionSelect={(regionCode) =>
            setSelection(
              selectionFromRequest(demoCatalog, {
                regionCode,
                industryCode: selection.industryCode,
              }),
            )
          }
          onSubmit={submit}
        />
      )
    }
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), '합정')
    expect(screen.getByRole('option')).toHaveTextContent('마포구 합정동')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByRole('combobox', { name: '지역 검색' })).toHaveAttribute(
      'placeholder',
      expect.stringContaining('합정동'),
    )
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(submit).toHaveBeenCalledWith({
      regionCode: '11440600',
      industryCode: defaultRequest.industryCode,
    })
  })

  it('검색 결과가 없는 위치를 임의 지역으로 선택하지 않는다', async () => {
    const select = vi.fn()
    const user = userEvent.setup()
    render(
      <MapSearch
        catalog={demoCatalog}
        regions={catalogRegions(demoCatalog)}
        selection={selectionFromRequest(demoCatalog, defaultRequest)}
        initial={defaultRequest}
        pending={false}
        onChange={vi.fn()}
        onRegionSelect={select}
        onSubmit={vi.fn()}
      />,
    )
    await user.type(screen.getByRole('combobox', { name: '지역 검색' }), '지원하지않는지역')
    expect(screen.getByText('분석 가능한 지역이 없어요.')).toBeInTheDocument()
    await user.keyboard('{Enter}{Escape}')
    expect(select).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
