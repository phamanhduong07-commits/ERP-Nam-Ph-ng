import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const arrowStyle: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 11,
  lineHeight: 1,
  opacity: 0.7,
  flexShrink: 0,
}

function flyoutPanelStyle(left: number, top: number): React.CSSProperties {
  return {
    position: 'fixed',
    left,
    top,
    width: FLYOUT_WIDTH,
    maxHeight: `calc(100vh - ${top}px - 16px)`,
    overflowY: 'auto',
    background: '#ffffff',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    zIndex: 1050,
    padding: '8px 0',
    boxSizing: 'border-box',
  }
}

const sectionLabelStyle: React.CSSProperties = {
  padding: '6px 16px 4px',
  fontSize: 11,
  fontWeight: 700,
  color: '#8c8fa3',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  userSelect: 'none',
}

function flyoutItemStyle(
  active: boolean,
  hovered: boolean,
): React.CSSProperties {
  let background = 'transparent'
  let color = '#20233a'
  let fontWeight = 400

  if (active) {
    background = '#fff4e8'
    color = '#ff8200'
    fontWeight = 600
  } else if (hovered) {
    background = '#f5f7ff'
    color = '#1b168e'
  }

  return {
    height: 38,
    lineHeight: '38px',
    padding: '0 16px',
    fontSize: 13,
    color,
    fontWeight,
    background,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxSizing: 'border-box',
    transition: 'background 0.1s ease, color 0.1s ease',
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

  // Hover timers. setTimeout's return type differs between DOM and Node, so we
  // pin it via ReturnType<typeof setTimeout> per the implementation contract.
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      // hubTo wins (navigate to the hub while the flyout stays via hover);
      // otherwise a plain `to` navigates directly. Items with neither are
      // pure flyout triggers and do nothing on click.
      const target = item.hubTo ?? item.to
      if (target) {
        onNavigate(target)
        navigate(target)
      }
    },
    [navigate, onNavigate],
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

  const handleSubKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, sub: SubItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleSubClick(sub)
      }
    },
    [handleSubClick],
  )

  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, item: NavItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleNavClick(item)
      }
    },
    [handleNavClick],
  )

  // Resolve the currently open flyout's sections (if any) for rendering.
  const activeEntry =
    activeKey !== null
      ? visibleItems.find((v) => v.item.key === activeKey)
      : undefined
  const activeSections = activeEntry ? activeEntry.sections : []
  const flyoutLeft = resolvedWidth + 6

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
            title={collapsed ? item.label : undefined}
            aria-haspopup={hasFlyout ? 'menu' : undefined}
            aria-expanded={hasFlyout ? activeKey === item.key : undefined}
            style={navItemStyle(active, hovered, collapsed)}
            onMouseEnter={(e) =>
              handleNavMouseEnter(item.key, hasFlyout, e.currentTarget)
            }
            onMouseLeave={handleNavMouseLeave}
            onClick={() => handleNavClick(item)}
            onKeyDown={(e) => handleNavKeyDown(e, item)}
          >
            {item.icon ? <span style={iconStyle}>{item.icon}</span> : null}

            {!collapsed ? (
              <span style={labelStyle}>{item.label}</span>
            ) : null}

            {!collapsed && hasFlyout ? (
              <span style={arrowStyle} aria-hidden="true">
                {'›'}
              </span>
            ) : null}
          </div>
        )
      })}

      {activeKey !== null && activeSections.length > 0 ? (
        <div
          role="menu"
          style={flyoutPanelStyle(flyoutLeft, flyoutTop)}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          {activeSections.map((section, sectionIdx) => (
            <div key={section.sectionLabel ?? `section-${sectionIdx}`}>
              {sectionIdx > 0 && (
                <hr style={{ margin: '4px 16px', border: 'none', borderTop: '1px solid #e7e9f2', height: 0 }} />
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
                    {sub.label}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
