import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

// ─── Shared types (exported from CustomSidebarNav.tsx) ───────────────────────

export type SubItem = {
  key: string
  label: React.ReactNode // string or <Link to="...">text</Link>
  to?: string
  permissions?: string[]
}

export type FlyoutSection = {
  sectionLabel?: string // optional group header inside flyout
  items: SubItem[]
}

export type NavItem = {
  key: string
  icon?: React.ReactNode
  label: string // ALWAYS a plain string (not ReactNode)
  to?: string // navigate directly, no flyout
  hubTo?: string // navigate here on click; AND show flyout
  permissions?: string[]
  flyoutSections?: FlyoutSection[] // if defined -> show flyout on hover
}

// ─── Component props ─────────────────────────────────────────────────────────

type Props = {
  items: NavItem[]
  collapsed: boolean
  selectedPath: string // location.pathname + location.search
  userRole: string
  userPermissions: string[]
  siderWidth?: number // default 248, collapsed = 80
  onNavigate: (to: string) => void // use useNavigate() from react-router-dom inside
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SIDER_WIDTH_DEFAULT = 248
const SIDER_WIDTH_COLLAPSED = 80
const ITEM_HEIGHT = 42
const FLYOUT_WIDTH = 300
const ENTER_DELAY_MS = 80
const LEAVE_DELAY_MS = 150

const COLOR_SIDEBAR_BG = '#1b168e'
const COLOR_TEXT = 'rgba(255,255,255,0.88)'
const COLOR_HOVER_BG = 'rgba(255,255,255,0.10)'
const COLOR_ACTIVE_BG = '#ff8200'
const COLOR_ACTIVE_TEXT = '#ffffff'

// Inject keyframe animation once into <head>
const STYLE_ID = 'sidebar-flyout-kf'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @keyframes flyout-in {
      from { opacity:0; transform:translateX(-10px); }
      to   { opacity:1; transform:translateX(0); }
    }
    .np-flyout-scroll::-webkit-scrollbar { width: 3px; }
    .np-flyout-scroll::-webkit-scrollbar-track { background: transparent; }
    .np-flyout-scroll::-webkit-scrollbar-thumb { background: rgba(27,22,142,0.18); border-radius: 3px; }
    .np-flyout-scroll::-webkit-scrollbar-thumb:hover { background: rgba(27,22,142,0.35); }
    .np-flyout-filter { outline: none; font-family: inherit; }
    .np-flyout-filter::placeholder { color: #b0b7c3; }
    .np-flyout-filter::-webkit-search-cancel-button { display: none; }
    .np-flyout-scroll a, .np-flyout-scroll a:hover, .np-flyout-scroll a:visited { text-decoration: none; color: inherit; }
  `
  document.head.appendChild(s)
}

// ─── Permission helpers ──────────────────────────────────────────────────────

function isAdmin(userRole: string): boolean {
  return userRole === 'ADMIN' || userRole === 'admin'
}

/**
 * An item is visible when:
 *  - the current user is an admin (sees everything), OR
 *  - the item declares no permissions (always visible), OR
 *  - the user holds ANY of the item's declared permissions.
 */
function canSee(
  permissions: string[] | undefined,
  userRole: string,
  userPermissions: string[],
): boolean {
  if (isAdmin(userRole)) return true
  if (!permissions || permissions.length === 0) return true
  return permissions.some((p) => userPermissions.includes(p))
}

function filterSubItems(
  subItems: SubItem[],
  userRole: string,
  userPermissions: string[],
): SubItem[] {
  return subItems.filter((s) => canSee(s.permissions, userRole, userPermissions))
}

function filterSections(
  sections: FlyoutSection[] | undefined,
  userRole: string,
  userPermissions: string[],
): FlyoutSection[] {
  if (!sections) return []
  return sections
    .map((section) => ({
      sectionLabel: section.sectionLabel,
      items: filterSubItems(section.items, userRole, userPermissions),
    }))
    .filter((section) => section.items.length > 0)
}

// ─── Active-state detection ──────────────────────────────────────────────────

/**
 * A top-level item is "active" when the selected path matches its own
 * hubTo/to, or matches (exactly or by prefix) any of its visible children's
 * `to`. Prefix matching lets a detail route (e.g. /sales/orders/42) keep the
 * parent highlighted.
 */
function isItemActive(
  item: NavItem,
  visibleSections: FlyoutSection[],
  selectedPath: string,
): boolean {
  if (item.hubTo && selectedPath === item.hubTo) return true
  if (item.to && selectedPath === item.to) return true

  for (const section of visibleSections) {
    for (const sub of section.items) {
      if (!sub.to) continue
      if (selectedPath === sub.to) return true
      // Prefix match guarded so "/" or short roots don't match everything.
      if (sub.to !== '/' && selectedPath.startsWith(sub.to + '/')) return true
    }
  }
  return false
}

function isSubItemActive(sub: SubItem, selectedPath: string): boolean {
  if (!sub.to) return false
  if (selectedPath === sub.to) return true
  if (sub.to !== '/' && selectedPath.startsWith(sub.to + '/')) return true
  return false
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  background: COLOR_SIDEBAR_BG,
  height: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingTop: 4,
  paddingBottom: 4,
}

function navItemStyle(
  active: boolean,
  hovered: boolean,
  collapsed: boolean,
): React.CSSProperties {
  let background = 'transparent'
  if (active) background = COLOR_ACTIVE_BG
  else if (hovered) background = COLOR_HOVER_BG

  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    height: ITEM_HEIGHT,
    padding: '0 12px',
    boxSizing: 'border-box',
    cursor: 'pointer',
    color: active ? COLOR_ACTIVE_TEXT : COLOR_TEXT,
    background,
    userSelect: 'none',
    transition: 'background 0.12s ease, color 0.12s ease',
    // Inset left border on the active item (sits inside the 12px padding).
    borderLeft: active ? '3px solid #ffffff' : '3px solid transparent',
  }
}

const iconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  width: 16,
  height: 16,
  flexShrink: 0,
}

const labelStyle: React.CSSProperties = {
  marginLeft: 10,
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1,
}

function arrowStyle(open: boolean): React.CSSProperties {
  return {
    marginLeft: 'auto',
    fontSize: 13,
    lineHeight: 1,
    opacity: open ? 1 : 0.55,
    flexShrink: 0,
    display: 'inline-block',
    transition: 'transform 0.15s ease, opacity 0.15s ease',
    transform: open ? 'translateX(3px)' : 'translateX(0)',
  }
}

function flyoutPanelStyle(left: number, top: number): React.CSSProperties {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const idealTop = Math.max(8, top - 6)
  // Always guarantee at least 660px of panel height by clamping computedTop.
  // This ensures ALL menus (large or small, top or bottom of sidebar) have
  // enough room without relying on an item-position threshold.
  const computedTop = Math.max(8, Math.min(idealTop, vh - 660))
  // Use all remaining space — no hard cap
  const maxH = vh - computedTop - 12

  return {
    position: 'fixed',
    left: left + 2,
    top: computedTop,
    width: FLYOUT_WIDTH,
    maxHeight: maxH,
    background: '#ffffff',
    borderRadius: 10,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 16px 40px -4px rgba(27,22,142,0.15)',
    border: '1px solid rgba(27,22,142,0.10)',
    zIndex: 1050,
    boxSizing: 'border-box',
    animation: 'flyout-in 0.14s ease-out',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
}

const flyoutHeaderStyle: React.CSSProperties = {
  background: '#1b168e',
  padding: '9px 14px 9px 16px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const flyoutHeaderTextStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.95)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
}


const sectionLabelStyle: React.CSSProperties = {
  padding: '8px 14px 3px 16px',
  fontSize: 10,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.9px',
  userSelect: 'none',
}

function flyoutItemStyle(active: boolean, hovered: boolean): React.CSSProperties {
  if (active) {
    return {
      display: 'flex',
      alignItems: 'center',
      minHeight: 34,
      padding: '5px 14px 5px 13px',
      fontSize: 13,
      color: '#c45600',
      fontWeight: 600,
      background: '#fff4e8',
      cursor: 'pointer',
      borderLeft: '3px solid #ff8200',
      boxSizing: 'border-box',
      lineHeight: '1.35',
      transition: 'background 0.1s',
    }
  }
  if (hovered) {
    return {
      display: 'flex',
      alignItems: 'center',
      minHeight: 34,
      padding: '5px 14px 5px 13px',
      fontSize: 13,
      color: '#1b168e',
      fontWeight: 500,
      background: '#eef0fc',
      cursor: 'pointer',
      borderLeft: '3px solid #1b168e',
      boxSizing: 'border-box',
      lineHeight: '1.35',
      transition: 'background 0.1s',
    }
  }
  return {
    display: 'flex',
    alignItems: 'center',
    minHeight: 34,
    padding: '5px 14px 5px 16px',
    fontSize: 13,
    color: '#374151',
    fontWeight: 400,
    background: 'transparent',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    boxSizing: 'border-box',
    lineHeight: '1.35',
    transition: 'background 0.1s',
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomSidebarNav(props: Props) {
  const {
    items,
    collapsed,
    selectedPath,
    userRole,
    userPermissions,
    siderWidth,
    onNavigate,
  } = props

  const navigate = useNavigate()

  // Resolve the effective sidebar width: explicit prop wins, otherwise derive
  // from collapsed state.
  const resolvedWidth =
    typeof siderWidth === 'number'
      ? siderWidth
      : collapsed
        ? SIDER_WIDTH_COLLAPSED
        : SIDER_WIDTH_DEFAULT

  // Which top-level item's flyout is currently showing (null = none).
  const [activeKey, setActiveKey] = useState<string | null>(null)
  // Vertical position of the flyout panel, derived from the hovered item.
  const [flyoutTop, setFlyoutTop] = useState<number>(0)
  // Hover highlight tracking (separate from the navigate selection).
  const [hoveredNavKey, setHoveredNavKey] = useState<string | null>(null)
  const [hoveredSubKey, setHoveredSubKey] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [showBottomFade, setShowBottomFade] = useState(false)
  const flyoutScrollRef = useRef<HTMLDivElement>(null)

  // Hover timers. setTimeout's return type differs between DOM and Node, so we
  // pin it via ReturnType<typeof setTimeout> per the implementation contract.
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set to true when flyout is opened via keyboard so we auto-focus first item.
  const focusFirstFlyoutItemRef = useRef(false)

  const clearEnterTimer = useCallback(() => {
    if (enterTimer.current !== null) {
      clearTimeout(enterTimer.current)
      enterTimer.current = null
    }
  }, [])

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  // Guarantee no timer outlives the component (prevents setState-after-unmount).
  useEffect(() => {
    return () => {
      clearEnterTimer()
      clearLeaveTimer()
    }
  }, [clearEnterTimer, clearLeaveTimer])

  // Reset search filter whenever the flyout switches to a different item.
  useEffect(() => {
    setFilterQuery('')
  }, [activeKey])

  // When flyout was opened via keyboard, focus the first menuitem after render.
  useEffect(() => {
    if (!focusFirstFlyoutItemRef.current || !activeKey) return
    focusFirstFlyoutItemRef.current = false
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>('[role="menu"] [role="menuitem"]')
      first?.focus()
    })
  }, [activeKey])

  // Track whether the scroll area overflows so we can show the bottom fade.
  useEffect(() => {
    const el = flyoutScrollRef.current
    if (!el) { setShowBottomFade(false); return }
    const check = () => {
      setShowBottomFade(
        el.scrollHeight > el.clientHeight + 4 &&
        el.scrollTop + el.clientHeight < el.scrollHeight - 4,
      )
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [activeKey, filterQuery])

  // Precompute permission-filtered nav items together with their filtered
  // flyout sections, so render and active-detection share one source of truth.
  const visibleItems = useMemo(() => {
    return items
      .filter((item) => canSee(item.permissions, userRole, userPermissions))
      .map((item) => ({
        item,
        sections: filterSections(item.flyoutSections, userRole, userPermissions),
      }))
  }, [items, userRole, userPermissions])

  const handleNavMouseEnter = useCallback(
    (
      navKey: string,
      hasFlyout: boolean,
      el: HTMLDivElement | null,
    ) => {
      clearLeaveTimer()
      setHoveredNavKey(navKey)

      // Collapsed mode never shows a flyout. Items without flyout sections
      // also have nothing to show — close any panel currently open.
      if (collapsed || !hasFlyout) {
        clearEnterTimer()
        setActiveKey(null)
        return
      }

      // Capture the rect immediately; the element may be gone by the time the
      // delayed callback fires.
      const top = el ? el.getBoundingClientRect().top : 0
      clearEnterTimer()
      enterTimer.current = setTimeout(() => {
        setFlyoutTop(top)
        setActiveKey(navKey)
        enterTimer.current = null
      }, ENTER_DELAY_MS)
    },
    [collapsed, clearEnterTimer, clearLeaveTimer],
  )

  const handleNavMouseLeave = useCallback(() => {
    clearEnterTimer()
    setHoveredNavKey(null)
    clearLeaveTimer()
    leaveTimer.current = setTimeout(() => {
      setActiveKey(null)
      leaveTimer.current = null
    }, LEAVE_DELAY_MS)
  }, [clearEnterTimer, clearLeaveTimer])

  const handleFlyoutMouseEnter = useCallback(() => {
    // Mouse moved from the sidebar item into the panel — keep it open.
    clearLeaveTimer()
  }, [clearLeaveTimer])

  const handleFlyoutMouseLeave = useCallback(() => {
    clearLeaveTimer()
    leaveTimer.current = setTimeout(() => {
      setActiveKey(null)
      setHoveredSubKey(null)
      leaveTimer.current = null
    }, LEAVE_DELAY_MS)
  }, [clearLeaveTimer])

  const handleNavClick = useCallback(
    (item: NavItem) => {
      const target = item.hubTo ?? item.to
      if (target) {
        onNavigate(target)
        navigate(target)
        clearEnterTimer()
        clearLeaveTimer()
        setActiveKey(null)
        setHoveredNavKey(null)
      }
    },
    [navigate, onNavigate, clearEnterTimer, clearLeaveTimer],
  )

  const handleSubClick = useCallback(
    (sub: SubItem) => {
      // If the label is itself a <Link>, let React Router handle navigation —
      // calling navigate() too would be redundant. Only drive navigation here
      // when the sub-item exposes a plain `to`.
      if (sub.to) {
        onNavigate(sub.to)
        navigate(sub.to)
      }
      // Close the flyout after a selection.
      clearEnterTimer()
      clearLeaveTimer()
      setActiveKey(null)
      setHoveredSubKey(null)
    },
    [navigate, onNavigate, clearEnterTimer, clearLeaveTimer],
  )

  const returnFocusToParent = useCallback(() => {
    const sidebar = document.querySelector('[aria-label="Sidebar"]')
    const btn = activeKey
      ? sidebar?.querySelector<HTMLElement>(`[data-nav-key="${activeKey}"]`)
      : null
    setActiveKey(null)
    // Focus after state update so the flyout is gone and the sidebar item is visible.
    requestAnimationFrame(() => btn?.focus())
  }, [activeKey, setActiveKey])

  const handleSubKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, sub: SubItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleSubClick(sub)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const flyout = e.currentTarget.closest('[role="menu"]') as HTMLElement | null
        if (!flyout) return
        const items = Array.from(flyout.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        const idx = items.indexOf(e.currentTarget)
        if (e.key === 'ArrowDown') {
          if (idx < items.length - 1) items[idx + 1].focus()
        } else {
          if (idx > 0) items[idx - 1].focus()
          else returnFocusToParent()
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault()
        returnFocusToParent()
      }
    },
    [handleSubClick, returnFocusToParent],
  )

  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, item: NavItem, hasFlyout: boolean) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleNavClick(item)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const sidebar = e.currentTarget.closest('[aria-label="Sidebar"]') as HTMLElement | null
        if (!sidebar) return
        const navBtns = Array.from(sidebar.querySelectorAll<HTMLElement>('[role="button"]'))
        const idx = navBtns.indexOf(e.currentTarget)
        if (e.key === 'ArrowDown' && idx < navBtns.length - 1) navBtns[idx + 1].focus()
        else if (e.key === 'ArrowUp' && idx > 0) navBtns[idx - 1].focus()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (hasFlyout) {
          // Open flyout and auto-focus first item via the ref+useEffect pattern.
          const top = e.currentTarget.getBoundingClientRect().top
          setFlyoutTop(top)
          focusFirstFlyoutItemRef.current = true
          setActiveKey(item.key)
        } else {
          handleNavClick(item)
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        e.preventDefault()
        setActiveKey(null)
      }
    },
    [handleNavClick, setActiveKey, setFlyoutTop],
  )

  // Resolve the currently open flyout's sections (if any) for rendering.
  const activeEntry =
    activeKey !== null
      ? visibleItems.find((v) => v.item.key === activeKey)
      : undefined
  const activeSections = activeEntry ? activeEntry.sections : []
  const flyoutLeft = resolvedWidth + 6

  const totalItems = activeSections.reduce((n, s) => n + s.items.length, 0)
  const showSearch = totalItems > 7
  const q = filterQuery.trim().toLowerCase()
  const filteredSections = q
    ? activeSections
        .map((s) => ({
          ...s,
          items: s.items.filter((item) =>
            typeof item.label === 'string'
              ? item.label.toLowerCase().includes(q)
              : true,
          ),
        }))
        .filter((s) => s.items.length > 0)
    : activeSections

  return (
    <div style={rootStyle} role="navigation" aria-label="Sidebar">
      {visibleItems.map(({ item, sections }) => {
        const hasFlyout = sections.length > 0
        const active = isItemActive(item, sections, selectedPath)
        const hovered = hoveredNavKey === item.key

        return (
          <div
            key={item.key}
            role="button"
            tabIndex={0}
            data-nav-key={item.key}
            title={collapsed ? item.label : undefined}
            aria-haspopup={hasFlyout ? 'menu' : undefined}
            aria-expanded={hasFlyout ? activeKey === item.key : undefined}
            style={navItemStyle(active, hovered, collapsed)}
            onMouseEnter={(e) =>
              handleNavMouseEnter(item.key, hasFlyout, e.currentTarget)
            }
            onMouseLeave={handleNavMouseLeave}
            onClick={() => handleNavClick(item)}
            onKeyDown={(e) => handleNavKeyDown(e, item, hasFlyout)}
          >
            {item.icon ? <span style={iconStyle}>{item.icon}</span> : null}

            {!collapsed ? (
              <span style={labelStyle}>{item.label}</span>
            ) : null}

            {!collapsed && hasFlyout ? (
              <span style={arrowStyle(activeKey === item.key)} aria-hidden="true">
                {'›'}
              </span>
            ) : null}
          </div>
        )
      })}

      {activeKey !== null && activeSections.length > 0 ? createPortal(
        <div
          role="menu"
          style={flyoutPanelStyle(flyoutLeft, flyoutTop)}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          {/* Connector caret pointing left toward sidebar */}
          <div style={{
            position: 'absolute',
            left: -7,
            top: 13,
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderRight: '7px solid #1b168e',
          }} />

          {/* Panel header */}
          <div style={flyoutHeaderStyle}>
            <span style={flyoutHeaderTextStyle}>{activeEntry?.item.label}</span>
            <span style={{
              background: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.88)',
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 10,
            }}>
              {totalItems}
            </span>
          </div>

          {/* Search — only for menus with >7 items */}
          {showSearch && (
            <div style={{
              padding: '7px 10px 5px',
              borderBottom: '1px solid #f0f1f5',
              background: '#fafbff',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '4px 9px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  className="np-flyout-filter"
                  type="search"
                  placeholder="Tìm nhanh..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 12.5,
                    color: '#374151',
                    width: '100%',
                    padding: 0,
                  }}
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery('')}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: '#9ca3af', fontSize: 15, padding: 0, lineHeight: 1, flexShrink: 0,
                    }}
                  >×</button>
                )}
              </div>
            </div>
          )}

          {/* Scrollable content — direct flex child so height resolves correctly */}
          <div
            ref={flyoutScrollRef}
            className="np-flyout-scroll"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0 6px' }}
          >
            {filteredSections.length === 0 && q ? (
              <div style={{ padding: '18px 14px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                Không tìm thấy "{filterQuery}"
              </div>
            ) : (
              filteredSections.map((section, sectionIdx) => (
                <div key={section.sectionLabel ?? `section-${sectionIdx}`}>
                  {sectionIdx > 0 && (
                    <div style={{ height: 1, background: '#f0f1f5', margin: '3px 0' }} />
                  )}
                  {section.sectionLabel ? (
                    <div style={sectionLabelStyle}>{section.sectionLabel}</div>
                  ) : null}

                  {section.items.map((sub) => {
                    const subActive = isSubItemActive(sub, selectedPath)
                    const subHovered = hoveredSubKey === sub.key
                    return (
                      <div
                        key={sub.key}
                        role="menuitem"
                        tabIndex={0}
                        title={typeof sub.label === 'string' ? sub.label : undefined}
                        style={flyoutItemStyle(subActive, subHovered)}
                        onMouseEnter={() => setHoveredSubKey(sub.key)}
                        onMouseLeave={() => setHoveredSubKey(null)}
                        onClick={() => handleSubClick(sub)}
                        onKeyDown={(e) => handleSubKeyDown(e, sub)}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.label}
                        </span>
                        {subHovered && !subActive && (
                          <span style={{ flexShrink: 0, color: '#1b168e', opacity: 0.35, fontSize: 12, marginLeft: 4 }}>›</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Bottom fade — positioned absolute within the fixed panel */}
          {showBottomFade && (
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 28,
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.96))',
              pointerEvents: 'none',
              borderRadius: '0 0 10px 10px',
            }} />
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
