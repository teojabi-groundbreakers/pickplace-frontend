import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchForm } from '../components/SearchForm'
import { defaultRequest, demoCatalog } from '../data/demo'

describe('지역·업종 선택', () => {
  it('선택한 행정동과 세부 업종 코드만 제출한다', async () => {
    const submit = vi.fn()
    const user = userEvent.setup()
    render(
      <SearchForm
        catalog={demoCatalog}
        initial={defaultRequest}
        pending={false}
        onSubmit={submit}
      />,
    )
    await user.selectOptions(screen.getByLabelText('시·군·구'), '11440')
    expect(screen.getByLabelText('행정동')).toHaveValue('')
    expect(screen.queryByRole('option', { name: '성수2가1동' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('행정동'), '11440600')
    await user.selectOptions(screen.getByLabelText('업종 대분류'), 'service')
    expect(screen.getByLabelText('세부 업종')).toHaveValue('')
    await user.selectOptions(screen.getByLabelText('세부 업종'), 'beauty')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(submit).toHaveBeenCalledWith({ regionCode: '11440600', industryCode: 'beauty' })
  })

  it('시·도 변경 시 구와 행정동을 모두 초기화하고 미선택 제출을 차단한다', async () => {
    const submit = vi.fn()
    const user = userEvent.setup()
    render(
      <SearchForm
        catalog={demoCatalog}
        initial={defaultRequest}
        pending={false}
        onSubmit={submit}
      />,
    )
    await user.selectOptions(screen.getByLabelText('시·도'), '26')
    expect(screen.getByLabelText('시·군·구')).toHaveValue('')
    expect(screen.getByLabelText('행정동')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: '상권 분석하기' }))
    expect(submit).not.toHaveBeenCalled()
  })

  it('분석 중 중복 요청과 조건 변경을 막는다', () => {
    render(
      <SearchForm
        catalog={demoCatalog}
        initial={defaultRequest}
        pending
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '분석 중' })).toBeDisabled()
    expect(screen.getByLabelText('행정동')).toBeDisabled()
  })
})
