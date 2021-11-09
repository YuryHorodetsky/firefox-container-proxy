import { Store } from '../store/Store'
import { HttpProxySettings, HttpsProxySettings, ProxySettings } from '../domain/ProxySettings'
import { ProxyInfo, Socks5ProxyInfo } from '../domain/ProxyInfo'
import { ProxyType } from '../domain/ProxyType'
import BlockingResponse = browser.webRequest.BlockingResponse
import _OnAuthRequiredDetails = browser.webRequest._OnAuthRequiredDetails
import _OnRequestDetails = browser.proxy._OnRequestDetails

const localhosts = new Set(['localhost', '127.0.0.1', '[::1]'])

type DoNotProxy = never[]
export const doNotProxy: DoNotProxy = []

const emergencyBreak: Socks5ProxyInfo = {
  type: ProxyType.Socks5,
  host: 'emergency-break-proxy.localhost',
  port: 1,
  failoverTimeout: 1,
  username: 'nonexistent user',
  password: 'dummy password',
  proxyDNS: true
}

export default class BackgroundMain {
  store: Store

  constructor ({ store }: { store: Store }) {
    this.store = store
  }

  initializeAuthListener (cookieStoreId: string, proxy: HttpProxySettings | HttpsProxySettings): void {
    const listener: (details: _OnAuthRequiredDetails) => BlockingResponse = (details) => {
      if (!details.isProxy) return {}

      if (details.cookieStoreId !== cookieStoreId) return {}

      // TODO: Fix in @types/firefox-webext-browser
      // @ts-expect-error
      const info = details.proxyInfo
      if (info.host !== proxy.host || info.port !== proxy.port || info.type !== proxy.type) return {}

      const result = { authCredentials: { username: proxy.username, password: proxy.password } }

      browser.webRequest.onAuthRequired.removeListener(listener)

      return result
    }

    browser.webRequest.onAuthRequired.addListener(
      listener,
      { urls: ['<all_urls>'] },
      ['blocking']
    )
  }

  openPreferences (browser: { runtime: any }) {
    return () => {
      browser.runtime.openOptionsPage()
    }
  }

  // TODO: Fix in @types/firefox-webext-browser
  async onRequest (requestDetails: Pick<_OnRequestDetails, 'cookieStoreId' | 'url'>): Promise<DoNotProxy | ProxyInfo[]> {
    try {
      const cookieStoreId = requestDetails.cookieStoreId ?? ''
      if (cookieStoreId === '') {
        console.error('cookieStoreId is not defined', requestDetails)
        return doNotProxy
      }

      const proxies = await this.store.getProxiesForContainer(cookieStoreId)

      if (proxies.length > 0) {
        proxies.forEach(p => {
          if (p.type === ProxyType.Http || p.type === ProxyType.Https) {
            this.initializeAuthListener(cookieStoreId, p)
          }
        })

        const result: ProxyInfo[] = proxies.filter((p: ProxySettings) => {
          try {
            const documentUrl = new URL(requestDetails.url)
            const isLocalhost = localhosts.has(documentUrl.hostname)
            if (isLocalhost && p.doNotProxyLocal) {
              return false
            }
          } catch (e) {
            console.error(e)
          }

          return true
        }).map(p => p.asProxyInfo())

        if (result.length === 0) {
          return doNotProxy
        }
        return result
      }

      return doNotProxy
    } catch (e: unknown) {
      console.error(`Error in onRequest listener: ${e as string}`)
      return [emergencyBreak]
    }
  }

  run (browser: { proxy: any, browserAction: any, runtime: any }): void {
    const filter = { urls: ['<all_urls>'] }

    browser.proxy.onRequest.addListener(this.onRequest.bind(this), filter)

    browser.browserAction.onClicked.addListener(this.openPreferences(browser))

    browser.proxy.onError.addListener((e: Error) => {
      console.error('Proxy error', e)
    })
  }
}
