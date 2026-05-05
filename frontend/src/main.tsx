import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import './index.css'
import App from './App'

dayjs.locale('vi')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            // ── Brand ──────────────────────────────────────────────
            colorPrimary: '#1b168e',
            colorInfo: '#1b168e',
            colorWarning: '#ff8200',
            colorLink: '#1b168e',
            borderRadius: 6,

            // ── Typography — ERP standard ──────────────────────────
            fontFamily: "'Segoe UI Variable', 'Segoe UI', Arial, sans-serif",
            fontSize:   14,       // body / data cells
            fontSizeSM: 13,       // labels, captions
            fontSizeLG: 15,       // sub-headings
            fontSizeXL: 20,       // page titles
            fontSizeHeading1: 22,
            fontSizeHeading2: 19,
            fontSizeHeading3: 17,
            fontSizeHeading4: 15,
            fontSizeHeading5: 13,

            // ── Line height (1.4–1.5 per standard) ─────────────────
            lineHeight:   1.48,
            lineHeightLG: 1.45,
            lineHeightSM: 1.42,

            // ── Color — #333 easier on eyes than #000 ──────────────
            colorText:            '#20233a',
            colorTextSecondary:   '#60647a',
            colorTextDescription: '#8a8ea3',
            colorTextDisabled:    '#bfbfbf',
            colorBgLayout:        '#f5f7fb',
            colorBorderSecondary: '#e7e9f2',

            // ── Spacing ─────────────────────────────────────────────
            padding:   16,
            paddingSM: 10,
            paddingXS:  6,
          },
          components: {
            // Table — trái tim ERP
            Table: {
              fontSize:        13,
              fontSizeSM:      13,
              headerBg:        '#f5f7ff',
              headerColor:     '#1b168e',
              cellFontSize:    13,
              rowHoverBg:      '#fff4e8',
              borderColor:     '#e7e9f2',
            },
            // Form
            Form: {
              labelFontSize: 13,
              labelColor:    '#4f5368',
            },
            // Input
            Input: {
              fontSize:        14,
              colorText:       '#20233a',
              paddingBlock:     6,
              paddingInline:   10,
            },
            // Select
            Select: {
              fontSize:  14,
              optionFontSize: 13,
            },
            // Button
            Button: {
              fontSize:         13,
              fontWeight:       600,
              contentFontSize:  13,
              primaryShadow:    '0 4px 10px rgba(27, 22, 142, 0.18)',
            },
            // Modal
            Modal: {
              titleFontSize: 16,
            },
            // Card
            Card: {
              headerFontSize: 15,
            },
            // Menu sidebar
            Menu: {
              fontSize:      13,
              itemHeight:    40,
              itemSelectedBg: '#fff1e2',
              itemSelectedColor: '#1b168e',
              itemHoverBg: '#f3f5ff',
              itemHoverColor: '#1b168e',
              subMenuItemBg: '#f8f9ff',
            },
            // Tag / Badge
            Tag: {
              fontSize: 11,
            },
            // Statistic
            Statistic: {
              titleFontSize:   12,
              contentFontSize: 22,
            },
          },
        }}
      >
        <AntApp>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
