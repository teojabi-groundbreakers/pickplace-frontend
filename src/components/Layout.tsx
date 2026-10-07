import { useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router'
import {
  ArrowUpRight,
  Bookmark,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  Compass,
  Home,
  MapPin,
  Menu,
  X,
} from 'lucide-react'
import { config } from '../lib/config'
import type { ReactNode } from 'react'

export function Layout({ children, savedCount }: { children: ReactNode; savedCount: number }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const page =
    location.pathname === '/saved'
      ? '저장한 분석'
      : location.pathname === '/guide'
        ? '이용 가이드'
        : '상권 분석'
  const items = [
    { to: '/', icon: ChartNoAxesCombined, label: '상권 분석' },
    { to: '/saved', icon: Bookmark, label: '저장한 분석' },
    { to: '/guide', icon: Compass, label: '이용 가이드' },
  ]
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
      >
        본문으로 건너뛰기
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Link
          className="brand"
          to="/"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-mark">
            <MapPin
              size={24}
              strokeWidth={2.3}
            />
            <i />
          </span>
          <span>
            PickPlace<span className="brand-caption">좋은 시작을 위한 좋은 자리</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="내비게이션 닫기"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="주요 메뉴">
          {items.map((item) => (
            <NavLink
              to={item.to}
              end
              key={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.to === '/saved' && savedCount > 0 ? (
                <span className="nav-count">{savedCount}</span>
              ) : (
                item.to === '/' && (
                  <ChevronRight
                    size={14}
                    className="nav-arrow"
                  />
                )
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-message">
          <div className="sidebar-illustration">
            <span className="building building-one" />
            <span className="building building-two" />
            <span className="building building-three" />
            <span className="illustration-line" />
            <span className="illustration-pin">
              <MapPin size={20} />
            </span>
          </div>
          <span className="sidebar-eyebrow">YOUR NEXT CHAPTER</span>
          <h3>
            당신의 다음 시작,
            <br />
            어디가 좋을까요?
          </h3>
          <p>
            가능성은 데이터에서,
            <br />
            확신은 PickPlace에서.
          </p>
          <Link
            to="/guide"
            onClick={() => setMenuOpen(false)}
          >
            분석 활용 가이드 <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <span className="sidebar-bottom-icon">
            <MapPin size={18} />
          </span>
          <div>
            <strong>오늘의 가능성을 발견하세요</strong>
            <span>Every place has potential.</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="내비게이션 열기"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Menu size={20} />
            </button>
            <Home size={15} />
            <ChevronRight size={12} />
            <span>{page}</span>
          </div>
          <div className="topbar-right">
            <span className="data-status">
              <i />
              {config.demoMode ? '데모 데이터' : 'API 연동 모드'}
            </span>
            <span className="topbar-divider" />
            <Link
              to="/guide"
              aria-label="이용 가이드"
            >
              <CircleHelp size={19} />
            </Link>
            <span
              className="workspace-avatar"
              title="로컬 워크스페이스"
            >
              P
            </span>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} PickPlace</span>
          <span>
            데이터로 발견하는 상권의 가능성<span className="footer-dot">·</span>
            <Link to="/guide">데이터 안내</Link>
          </span>
        </footer>
      </div>
    </div>
  )
}
