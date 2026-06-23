import { registerSW } from 'virtual:pwa-register'

export function registerPWA() {
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('PWA ready for offline use')
    },
    onNeedRefresh() {
      console.info('PWA update available')
    },
  })
}
