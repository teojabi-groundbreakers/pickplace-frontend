import { ArrowRight, ChartNoAxesCombined, MapPin, ShieldCheck, Target } from 'lucide-react'
import { Link } from 'react-router'
import { config } from '../lib/config'
import '../styles/about.css'

const values = [
  {
    icon: ChartNoAxesCombined,
    title: '성장 가능성',
    description: '매출과 유동인구의 추이를 함께 살펴보며 지역 수요의 변화를 이해해요.',
  },
  {
    icon: ShieldCheck,
    title: '위험도',
    description: '경쟁과 폐업, 매출 감소 등 시작하기 전에 살펴볼 위험 요인을 확인해요.',
  },
  {
    icon: Target,
    title: '업종 적합도',
    description: '지역의 소비 특성과 선택한 업종이 얼마나 잘 맞는지 살펴봐요.',
  },
]

const steps = [
  { title: '지도 탐색', description: '관심 있는 동네와 주변을 둘러봐요.' },
  { title: '지역·업종 선택', description: '알아보고 싶은 지역과 업종을 골라요.' },
  { title: '분석 결과 확인', description: '점수와 추이, 주요 영향 요인을 함께 살펴봐요.' },
]

export function About() {
  return (
    <div className="about-page">
      <section
        className="about-intro panel"
        aria-labelledby="about-heading"
      >
        <span
          className="about-mark"
          aria-hidden="true"
        >
          <MapPin size={30} />
        </span>
        <div className="page-heading about-heading">
          <div>
            <span className="eyebrow">ABOUT PICKPLACE</span>
            <h1 id="about-heading">좋은 시작을 위한 좋은 자리</h1>
            <p>
              PickPlace는 관심 있는 지역의 상권을 이해하고, 내 업종에 맞는 자리를 고민할 수 있도록
              돕는 서비스예요. 지도에서 시작해 성장 가능성과 위험 요인, 업종 적합도를 함께
              살펴보세요.
            </p>
          </div>
        </div>
        <div className="about-actions">
          <Link
            to="/"
            className="button button-primary"
          >
            지도에서 시작하기
            <ArrowRight
              size={16}
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/guide"
            className="button button-ghost"
          >
            이용 방법 보기
            <ArrowRight
              size={16}
              aria-hidden="true"
            />
          </Link>
        </div>
      </section>

      <section
        className="about-values"
        aria-labelledby="about-values-heading"
      >
        <div className="about-section-heading">
          <h2 id="about-values-heading">상권의 가능성을 여러 방향에서</h2>
          <p>종합점수부터 변화의 흐름과 영향 요인까지, 판단에 필요한 단서를 함께 확인해요.</p>
        </div>
        <div className="about-value-grid">
          {values.map((value) => (
            <article
              className="about-value panel"
              key={value.title}
            >
              <span
                className="about-value-icon"
                aria-hidden="true"
              >
                <value.icon size={22} />
              </span>
              <h3>{value.title}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="about-flow panel"
        aria-labelledby="about-flow-heading"
      >
        <div className="about-section-heading">
          <h2 id="about-flow-heading">지도를 둘러보는 것부터 시작해요</h2>
          <p>관심 있는 곳을 찾았다면 지역과 업종을 골라 분석을 요청해 보세요.</p>
        </div>
        <ol className="about-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span
                className="about-step-number"
                aria-hidden="true"
              >
                0{index + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="about-data-note">
          {config.demoMode
            ? '현재는 데모 모드예요. 분석 점수·통계·영향 요인·AI 진단·분석 지도 경계와 시설 마커는 기능 확인을 위한 가상 예시이며, 실제 행정동 경계는 제공하지 않아요.'
            : '분석 기준 기간과 제공된 지표는 각 결과에서 확인해 주세요. 데이터가 부족한 지역은 분석을 제공하지 않아요.'}
        </p>
      </section>
    </div>
  )
}
