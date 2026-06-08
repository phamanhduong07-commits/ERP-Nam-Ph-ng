import { useAuthStore } from '../store/auth'
import { APPROVE_ROLES } from '../constants/permissions'

export function usePermission() {
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''
  const permissions = user?.permissions ?? []
  const isAdmin = role === 'ADMIN'

  const hasPermission = (perm: string): boolean => {
    if (isAdmin) return true
    return permissions.includes(perm)
  }

  const hasAnyPermission = (perms: string[]): boolean => {
    if (isAdmin) return true
    return perms.some(p => permissions.includes(p))
  }

  const canApprove = isAdmin || APPROVE_ROLES.includes(role)

  return { hasPermission, hasAnyPermission, isAdmin, canApprove, user, role }
}
