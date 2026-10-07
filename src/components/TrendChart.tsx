import { useId, useState } from 'react'
import { ArrowUpRight, Table2 } from 'lucide-react'
import type { TrendPoint } from '../types/analysis'

const number = new Intl.NumberFormat('ko-KR')
type Metric = 'sales' | 'population' | 'stores'
const metadata = {
  sales: {
    label: '매출 추이',
    unit: '만원',
    title: '점포당 월평균 매출',
    legend: '선택 상권',
    other: '지역 평균',
  },
  population: {
    label: '유동인구',
    unit: '명',
    title: '일평균 유동인구',
    legend: '유동인구',
    other: '',
  },
  stores: { label: '점포 변화', unit: '개', title: '전체 점포 수', legend: '개업', other: '폐업' },
}

function coordinates(values: number[], max: number) {
  return values.map((value, index) => [
    48 + (index * 570) / Math.max(values.length - 1, 1),
    152 - (value / max) * 128,
  ])
}

export function TrendChart({ trends }: { trends: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>('sales')
  const [range, setRange] = useState(6)
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const gradientId = useId().replace(/:/g, '')
  const data = trends.slice(-range)
  const info = metadata[metric]
  const last = data[data.length - 1]
  const previous = data[0]
  const delta = previous[metric] ? ((last[metric] - previous[metric]) / previous[metric]) * 100 : 0
  const max =
    metric === 'stores'
      ? Math.max(...data.flatMap((point) => [point.openings, point.closures]), 1) * 1.25
      : Math.max(
          ...data.map((point) =>
            metric === 'sales' ? Math.max(point.sales, point.averageSales) : point.population,
          ),
          1,
        ) * 1.18
  const mainPoints = coordinates(
    data.map((point) => point[metric]),
    max,
  )
  const storeMax = Math.max(...data.map((point) => point.stores), 1) * 1.18
  const storePoints = coordinates(
    data.map((point) => point.stores),
    storeMax,
  ).map(([, y], pointIndex) => [48 + ((pointIndex + 0.5) * 570) / data.length, y])
  const averagePoints = coordinates(
    data.map((point) => point.averageSales),
    max,
  )
  const line = mainPoints.map((point) => point.join(',')).join(' ')
  const index = active === null ? data.length - 1 : active

  return (
    <section
      className="panel trend-panel"
      aria-label="상권 추이 차트"
    >
      <div className="panel-header">
        <h2>상권 데이터 한눈에</h2>
        <div
          className="segmented"
          aria-label="조회 기간"
        >
          {[6, 12].map((months) => (
            <button
              key={months}
              aria-pressed={range === months}
              onClick={() => {
                setRange(months)
                setActive(null)
              }}
            >
              {months}개월
            </button>
          ))}
        </div>
      </div>
      <div
        className="chart-tabs"
        role="tablist"
        aria-label="조회 지표"
      >
        {(Object.keys(metadata) as Metric[]).map((key) => (
          <button
            role="tab"
            aria-selected={metric === key}
            aria-controls="trend-content"
            id={`tab-${key}`}
            key={key}
            onClick={() => {
              setMetric(key)
              setActive(null)
            }}
          >
            {metadata[key].label}
          </button>
        ))}
      </div>
      <div
        id="trend-content"
        role="tabpanel"
        aria-labelledby={`tab-${metric}`}
      >
        <div className="chart-summary">
          <div>
            <span>{info.title}</span>
            <strong>
              {number.format(data[index][metric])}
              <small>{info.unit}</small>
            </strong>
          </div>
          <span className={`change-label ${delta < 0 ? 'negative' : ''}`}>
            <ArrowUpRight size={14} />
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%<small>기간 내 변화</small>
          </span>
          <div className="chart-legend">
            <span>
              <i />
              {info.legend}
            </span>
            {info.other && (
              <span>
                <i className="legend-other" />
                {info.other}
              </span>
            )}
            {metric === 'stores' && (
              <span>
                <i className="legend-total" />
                전체 점포
              </span>
            )}
          </div>
        </div>
        <svg
          className="trend-svg"
          viewBox={`0 0 ${metric === 'stores' ? 670 : 640} 190`}
          role="img"
          aria-label={`${info.label}, ${data[0].month}부터 ${last.month}까지. ${metric === 'stores' ? '왼쪽 축은 개업·폐업 수, 오른쪽 축은 전체 점포 수입니다. ' : ''}아래 데이터 보기에서 모든 수치를 확인할 수 있습니다.`}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#6d927a"
                stopOpacity=".17"
              />
              <stop
                offset="100%"
                stopColor="#6d927a"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((tick) => (
            <g key={tick}>
              <line
                x1="48"
                x2="618"
                y1={24 + (tick * 128) / 3}
                y2={24 + (tick * 128) / 3}
                stroke="#edf0eb"
                strokeDasharray="3 4"
              />
              <text
                x="38"
                y={28 + (tick * 128) / 3}
                textAnchor="end"
                className="axis-label"
              >
                {number.format(Math.round(max * (1 - tick / 3)))}
              </text>
            </g>
          ))}
          {metric !== 'stores' ? (
            <>
              <polygon
                points={`48,152 ${line} 618,152`}
                fill={`url(#${gradientId})`}
              />
              {metric === 'sales' && (
                <polyline
                  points={averagePoints.map((point) => point.join(',')).join(' ')}
                  fill="none"
                  stroke="#c4cdbb"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              )}
              <polyline
                points={line}
                fill="none"
                stroke="#4f7961"
                strokeWidth="2.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {mainPoints.map(([x, y], pointIndex) => (
                <g
                  key={data[pointIndex].month}
                  tabIndex={0}
                  role="button"
                  aria-label={`${data[pointIndex].month}: ${number.format(data[pointIndex][metric])}${info.unit}`}
                  onFocus={() => setActive(pointIndex)}
                  onBlur={() => setActive(null)}
                  onMouseEnter={() => setActive(pointIndex)}
                  onClick={() => setActive(pointIndex)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="14"
                    fill="transparent"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={index === pointIndex ? 5 : 3.5}
                    fill="#fff"
                    stroke="#4f7961"
                    strokeWidth="2"
                  />
                </g>
              ))}
            </>
          ) : (
            data.map((point, pointIndex) => {
              const x = 48 + ((pointIndex + 0.5) * 570) / data.length
              const width = Math.min(18, 200 / data.length)
              return (
                <g key={point.month}>
                  <rect
                    x={x - width - 2}
                    y={152 - (point.openings / max) * 128}
                    width={width}
                    height={(point.openings / max) * 128}
                    rx="3"
                    fill="#6b8e76"
                  />
                  <rect
                    x={x + 2}
                    y={152 - (point.closures / max) * 128}
                    width={width}
                    height={(point.closures / max) * 128}
                    rx="3"
                    fill="#c9d0c1"
                  />
                </g>
              )
            })
          )}
          {metric === 'stores' && (
            <>
              <polyline
                points={storePoints.map((point) => point.join(',')).join(' ')}
                fill="none"
                stroke="#b49a73"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {storePoints.map(([x, y], pointIndex) => (
                <g
                  key={data[pointIndex].month}
                  tabIndex={0}
                  role="button"
                  aria-label={`${data[pointIndex].month}: 전체 점포 ${data[pointIndex].stores}개, 개업 ${data[pointIndex].openings}개, 폐업 ${data[pointIndex].closures}개`}
                  onFocus={() => setActive(pointIndex)}
                  onBlur={() => setActive(null)}
                  onMouseEnter={() => setActive(pointIndex)}
                  onClick={() => setActive(pointIndex)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="12"
                    fill="transparent"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#fff"
                    stroke="#b49a73"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
              {[0, 1, 2, 3].map((tick) => (
                <text
                  key={tick}
                  x="660"
                  y={28 + (tick * 128) / 3}
                  textAnchor="end"
                  className="axis-label store-axis-label"
                >
                  {Math.round(storeMax * (1 - tick / 3))}
                </text>
              ))}
            </>
          )}
          {data.map((point, pointIndex) => (
            <text
              className="axis-label"
              key={point.month}
              x={
                metric === 'stores'
                  ? 48 + ((pointIndex + 0.5) * 570) / data.length
                  : 48 + (pointIndex * 570) / Math.max(data.length - 1, 1)
              }
              y="179"
              textAnchor="middle"
            >
              {Number(point.month.slice(5))}월
            </text>
          ))}
        </svg>
      </div>
      <div className="chart-bottom">
        <span>
          {data[0].month.replace('-', '.')} – {last.month.replace('-', '.')} ·{' '}
          {metric === 'population'
            ? '일평균 기준'
            : metric === 'stores'
              ? '좌: 개·폐업 / 우: 전체 점포'
              : '월별 기준'}
        </span>
        <button
          className="text-button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
        >
          <Table2 size={13} />
          {showTable ? '데이터 접기' : '데이터 보기'}
        </button>
      </div>
      {showTable && (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">상권 월별 추이 원본 데이터</caption>
            <thead>
              <tr>
                <th>기간</th>
                <th>매출(만원)</th>
                <th>인구(명)</th>
                <th>점포(개)</th>
                <th>개업</th>
                <th>폐업</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.month}>
                  <td>{point.month}</td>
                  <td>{number.format(point.sales)}</td>
                  <td>{number.format(point.population)}</td>
                  <td>{point.stores}</td>
                  <td>{point.openings}</td>
                  <td>{point.closures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
