import React from 'react'
import { Card } from 'antd'
import TabGiaoHang from '../production/TabGiaoHang'
import PageLayout from '../../components/PageLayout'

export default function GiaoHangPage() {
  return (
    <PageLayout title="🚚 Quản lý Giao hàng & Bán hàng">
      <Card>
        <TabGiaoHang />
      </Card>
    </PageLayout>
  )
}
