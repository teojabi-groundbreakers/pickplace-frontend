import {
  ArrowRight,
  ChartNoAxesCombined,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { Link } from 'react-router'
import { ServiceApiPreview } from '../components/ServiceApiPreview'
import { config } from '../lib/config'

export function Guide() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY, A BETTER START</span>
          <h1>
            가능성을 읽는 방법<span className="title-period">.</span>
          </h1>
          <p>상권 데이터가 처음이어도 괜찮아요. 하나씩 살펴보세요.</p>
        </div>
      </div>
      <section className="guide-intro panel">
        <span className="guide-icon">
          <MapPin size={30} />
        </span>
        <div>
          <h2>좋은 자리를 찾는 세 가지 단계</h2>
          <p>먼저 지도를 둘러보고, 지역과 업종을 골라 상권의 가능성을 확인하세요.</p>
        </div>
        <Link
          to="/"
          className="button button-primary"
        >
          분석 시작하기
          <ArrowRight size={16} />
        </Link>
      </section>
      <div className="guide-steps">
        {[
          {
            icon: MapPin,
            title: '지도에서 지역 선택',
            text: '지도 상단에서 지역을 검색하거나 행정동 표시를 눌러 선택하세요. 우클릭 또는 중심 위치 조회로 해당 위치의 행정동을 확인할 수도 있어요.',
          },
          {
            icon: Search,
            title: '업종 선택',
            text: '검색창의 조건 버튼에서 대분류와 세부 업종을 고른 뒤 상권 분석하기를 눌러 주세요.',
          },
          {
            icon: ChartNoAxesCombined,
            title: '가능성 확인',
            text: '결과 패널에서 점수, 추이와 영향 요인을 살펴보세요. 패널을 닫아 지도를 넓게 보거나 분석 결과 보기로 다시 열 수 있어요.',
          },
        ].map((step, index) => (
          <article
            className="panel"
            key={step.title}
          >
            <span className="step-number">0{index + 1}</span>
            <step.icon size={22} />
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
      <section className="panel guide-metrics">
        <h2>각 점수는 무엇을 의미하나요?</h2>
        {[
          {
            icon: Sparkles,
            title: '종합 상권 점수',
            text: '성장성, 위험도, 업종 적합도 등 여러 지표를 종합한 100점 만점 점수입니다. 등급과 평가 문구를 함께 확인하세요.',
          },
          {
            icon: ChartNoAxesCombined,
            title: '성장 가능성',
            text: '상권의 향후 성장 가능성을 나타냅니다. 높을수록 긍정적이며 매출 및 방문 수요의 변화를 함께 확인하세요.',
          },
          {
            icon: ShieldCheck,
            title: '위험도',
            text: '경쟁, 폐업, 매출 감소 등의 위험을 나타냅니다. 높을수록 위험이 크며, 다른 점수와 달리 낮을수록 안정적입니다.',
          },
          {
            icon: Target,
            title: '업종 적합도',
            text: '지역의 소비 특성과 선택한 업종이 얼마나 잘 맞는지 나타냅니다. 높을수록 적합합니다.',
          },
        ].map((metric) => (
          <div key={metric.title}>
            <span className="guide-metric-icon">
              <metric.icon size={20} />
            </span>
            <section>
              <h3>{metric.title}</h3>
              <p>{metric.text}</p>
            </section>
          </div>
        ))}
      </section>
      <section className="panel guide-data">
        <h2>데이터 이용 및 저장 안내</h2>
        <section>
          <h3>분석 데이터</h3>
          <p>
            상권 분석 결과는 지역과 업종을 이해하기 위한 참고 자료입니다. 데이터의 기준 시점과 제공
            범위를 확인하고, 창업이나 투자 결정 시에는 현장 조사와 다른 자료도 함께 살펴봐 주세요.
          </p>
        </section>
        <section>
          <h3>지도와 지역 조회</h3>
          <p>
            지도에서 선택한 지점이나 지도 화면의 중심을 기준으로 해당 위치의 행정동을 확인합니다.
            지도 표시와 지역 조회에는 카카오맵 기능을 사용합니다.
          </p>
        </section>
        <section>
          <h3>분석 결과 저장</h3>
          <p>
            저장한 분석 결과는 현재 사용 중인 브라우저에 보관됩니다. 다른 브라우저나 기기에서는
            확인할 수 없으며, 해당 사이트의 브라우저 데이터를 삭제하면 저장한 결과도 삭제됩니다.
          </p>
        </section>
      </section>
      {config.serviceApiPreview && <ServiceApiPreview />}
      {config.demoMode && (
        <section className="panel guide-data">
          <h2>화면 상태 확인</h2>
          <p>예시 요청으로 정상 결과, 데이터 부족, 서버 오류 화면을 확인할 수 있습니다.</p>
          <div className="scenario-links">
            <Link to="/?scenario=success">
              정상 분석 <ArrowRight size={14} />
            </Link>
            <Link to="/?scenario=empty">
              데이터 부족 <ArrowRight size={14} />
            </Link>
            <Link to="/?scenario=error">
              서버 오류 <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}
    </>
  )
}
