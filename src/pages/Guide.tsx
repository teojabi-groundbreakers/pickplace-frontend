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
        <h2>데이터와 저장 안내</h2>
        <p>
          {config.demoMode
            ? '현재는 데모 모드입니다. 지역별 점수, 통계, 영향 요인, 지도 경계·시설 마커와 AI 진단은 기능 확인을 위한 가상 예시입니다. 지역 목록은 일부 지역만 제공합니다.'
            : '현재는 API 연동 모드입니다. 분석 기준 기간과 제공된 지표는 각 분석 결과에서 확인할 수 있습니다. 데이터가 부족한 지역은 분석을 제공하지 않습니다.'}
        </p>
        <p>
          차트의 지표와 조회 기간을 바꿔 추이를 확인하고, ‘데이터 보기’에서 수치를 볼 수 있습니다.
          분석 후 지도 하단의 시설 종류를 누르면 마커를 켜고 끌 수 있어요.
        </p>
        <p>
          지도 상단에서 사용할 배경 지도를 바꿀 수 있어요. 지도 서비스 연결이 원활하지 않으면 다른
          지도나 기본 위치도로 전환합니다. 기본 위치도는 실제 도로를 표시하지 않지만 행정동 선택과
          분석을 계속할 수 있습니다.
        </p>
        <p>
          카카오지도는 왼쪽 버튼을 누른 채 드래그하면 이동하고, 마우스 휠로 확대·축소하거나
          더블클릭으로 확대할 수 있어요. 오른쪽 버튼 클릭은 해당 위치의 행정동 조회에 사용합니다.
          모바일에서는 한 손가락으로 이동하고 두 손가락으로 확대·축소할 수 있어요.
        </p>
        <p>
          위치 조회 결과에서 ‘이 지역 선택’을 누르면 분석 조건에 반영됩니다. 조회된 행정동이 현재
          분석 목록에서 지원되지 않으면 지역을 선택할 수 없습니다. 조회 연결에 실패하면 상단 지역
          검색과 조건 목록을 이용해 주세요.
        </p>
        <p>
          저장한 분석은 현재 브라우저에 보관됩니다. 브라우저 데이터를 삭제하면 저장 내용도
          사라집니다. 보고서는 텍스트 파일로 내려받을 수 있습니다.
        </p>
        <p>
          영향 요인의 기여도는 전체 점수에 대한 영향입니다. 표시된 요인 외의 기준도 반영될 수 있어
          기여도의 합이 종합점수와 같지는 않습니다.
        </p>
      </section>
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
