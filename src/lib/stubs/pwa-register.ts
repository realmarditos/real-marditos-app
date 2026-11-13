// Substituto do registro do service worker para a demo (arquivo único, sem PWA).
import { useState } from 'react'
export function useRegisterSW(_opts?: unknown) {
  const needRefresh = useState(false)
  const offlineReady = useState(false)
  return { needRefresh, offlineReady, updateServiceWorker: async (_reload?: boolean) => {} }
}
