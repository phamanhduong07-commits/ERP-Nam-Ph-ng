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
            colorPrimary: '#1677ff',
            borderRadius: 6,

            // ── Typography — ERP standard ──────────────────────────
            fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
            fontSize:   14,       // body / data cells
            fontSizeSM: 12,       // labels, captions
            fontSizeLG: 16,       // sub-headings
            fontSizeXL: 20,       // page titles
            fontSizeHeading1: 20,
            fontSizeHeading2: 18,
            fontSizeHeading3: 16,
            fontSizeHeading4: 14,
            fontSizeHeading5: 13,

            // ── Line height (1.4–1.5 per standard) ─────────────────
            lineHeight:   1.5,
            lineHeightLG: 1.5,
            lineHeightSM: 1.4,

            // ── Color — #333 easier on eyes than #000 ──────────────
            colorText:            '#333333',
            colorTextSecondary:   '#666666',
            colorTextDescription: '#999999',
            colorTextDisabled:    '#bfbfbf',

            // ── Spacing ─────────────────────────────────────────────
            padding:   16,
            paddingSM: 10,
            paddingXS:  6,
          },
          components: {
            // Table — trái tim ERP
            Table: {
              fontSize:        13,
              fontSizeSM:      12,
              headerBg:        '#fafafa',
              headerColor:     '#4a4a4a',
              cellFontSize:    13,
              rowHoverBg:      '#e6f4ff',
              borderColor:     '#e8e8e8',
            },
            // Form
            Form: {
              labelFontSize: 13,
              labelColor:    '#4a4a4a',
            },
            // Input
            Input: {
              fontSize:        14,
              colorText:       '#333333',
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
              fontWeight:       500,
              contentFontSize:  13,
            },
            // Modal
            Modal: {
              titleFontSize: 16,
            },
            // Card
            Card: {
              headerFontSize: 14,
            },
            // Menu sidebar
            Menu: {
              fontSize:      13,
              itemHeight:    38,
              subMenuItemBg: '#f8f8f8',
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
