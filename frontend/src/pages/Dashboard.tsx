import React from 'react'
import { Skeleton } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import client from '../api/client'
import { getDashboardType } from '../utils/dashboardType'
import { DashboardStats } from './dashboards/_shared'
import DashboardBGD from './dashboards/DashboardBGD'
import DashboardSalesManager from './dashboards/DashboardSalesManager'
import DashboardSalesStaff from './dashboards/DashboardSalesStaff'
import DashboardAccounting from './dashboards/DashboardAccounting'
import DashboardProduction from './dashboards/DashboardProduction'
import DashboardWarehouse from './dashboards/DashboardWarehouse'
import DashboardPurchase from './dashboards/DashboardPurchase'
import DashboardDefault from './dashboards/DashboardDefault'

export default function Dashboard() {
  const { user } = useAuthStore()
  const dashboardType = getDashboardType(user?.role)
  const userName = user?.ho_ten || user?.username || 'bạn'

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => client.get<DashboardStats>('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading || !stats) {
    return <div style={{ padding: 40 }}><Skeleton active paragraph={{ rows: 10 }} /></div>
  }

  switch (dashboardType) {
    case 'bgd':
      return <DashboardBGD stats={stats} userName={userName} />
    case 'sales_manager':
      return <DashboardSalesManager stats={stats} userName={userName} />
    case 'sales_staff':
      return <DashboardSalesStaff stats={stats} userName={userName} />
    case 'accounting':
      return <DashboardAccounting stats={stats} userName={userName} />
    case 'production':
      return <DashboardProduction stats={stats} userName={userName} />
    case 'warehouse':
      return <DashboardWarehouse stats={stats} userName={userName} />
    case 'purchase':
      return <DashboardPurchase stats={stats} userName={userName} />
    default:
      return <DashboardDefault userName={userName} />
  }
}
