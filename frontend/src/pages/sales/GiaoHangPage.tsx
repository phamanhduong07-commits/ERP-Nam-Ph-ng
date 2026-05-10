import React from 'react'
import { Typography, Card } from 'antd'
import TabGiaoHang from '../production/TabGiaoHang'

const { Title } = Typography

export default function GiaoHangPage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>🚚 Quản lý Giao hàng & Bán hàng</Title>
      <Card>
        <TabGiaoHang />
      </Card>
    </div>
  )
}
