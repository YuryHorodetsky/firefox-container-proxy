import { ProxyInfo } from '../domain/ProxyInfo'
import { ProxyType } from '../domain/ProxyType'
import { generateAuthorizationHeader } from '../options/util'
import { ProxySettings } from '../domain/ProxySettings'
import tryFromDao = ProxySettings.tryFromDao

/* eslint-disable @typescript-eslint/no-namespace,no-redeclare,import/export */

export interface ProxyDao {
  id: string
  title: string
  type: string
  host: string
  port: number
  username?: string
  password?: string
  proxyDNS?: boolean
  doNotProxyLocal: boolean
}

export namespace ProxyDao {
  export function toProxyInfo (proxy: Pick<ProxyDao, 'type' | 'host' | 'port' | 'username' | 'password' | 'proxyDNS'>): ProxyInfo | undefined {
    const type = ProxyType.tryFromString(proxy.type)
    if (type === undefined) {
      return
    }

    const base = {
      host: proxy.host,
      port: proxy.port,
      failoverTimeout: 5
    }

    switch (type) {
      case ProxyType.Socks5:
        return {
          type,
          ...base,
          username: proxy.username ?? '',
          password: proxy.password ?? '',
          proxyDNS: proxy.proxyDNS ?? true
        }
      case ProxyType.Socks4:
        return {
          type,
          ...base,
          proxyDNS: proxy.proxyDNS ?? true
        }
      case ProxyType.Http:
        return {
          type,
          ...base
        }
      case ProxyType.Https:
        return {
          type,
          ...base,
          proxyAuthorizationHeader: generateAuthorizationHeader(proxy.username ?? '', proxy.password ?? '')
        }
    }
  }
}

export class Store {
  async getAllProxies (): Promise<ProxySettings[]> {
    const proxyDaos = await this.getAllProxyDaos()
    const result: ProxySettings[] = proxyDaos.map(tryFromDao).filter(p => p !== undefined) as ProxySettings[]
    return result
  }

  async getProxyById (id: string): Promise<ProxySettings | null> {
    const proxies = await this.getAllProxies()
    const index = proxies.findIndex(p => p.id === id)
    if (index === -1) {
      return null
    } else {
      return proxies[index]
    }
  }

  async putProxy (proxy: ProxySettings): Promise<void> {
    const proxies = await this.getAllProxyDaos()
    const index = proxies.findIndex(p => p.id === proxy.id)
    if (index !== -1) {
      proxies[index] = proxy.asDao()
    } else {
      proxies.push(proxy.asDao())
    }

    await this.saveProxyDaos(proxies)
  }

  async deleteProxyById (id: string): Promise<void> {
    const proxies = await this.getAllProxyDaos()
    const index = proxies.findIndex(p => p.id === id)
    if (index !== -1) {
      proxies.splice(index, 1)
      await this.saveProxyDaos(proxies)
    }
  }

  async getRelations (): Promise<{ [key: string]: string[] }> {
    const result = await browser.storage.local.get('relations')
    return result.relations as { [key: string]: string[] } ?? {}
  }

  async setContainerProxyRelation (cookieStoreId: string, proxyId: string): Promise<void> {
    const relations = await this.getRelations()
    relations[cookieStoreId] = [proxyId]

    await browser.storage.local.set({ relations: relations })
  }

  async getProxiesForContainer (cookieStoreId: string): Promise<ProxySettings[]> {
    const relations = await this.getRelations()

    const proxyIds: string[] = relations[cookieStoreId] ?? []

    if (proxyIds.length === 0) {
      return []
    }

    const proxies = await this.getAllProxies()
    const proxyById: { [key: string]: ProxySettings } = {}
    proxies.forEach(function (p) { proxyById[p.id] = p })

    return proxyIds.map(pId => proxyById[pId])
      .filter(p => p !== undefined)
      .map(fillInDefaults)
      .map(tryFromDao)
      .filter(p => p !== undefined) as ProxySettings[]
  }

  private async saveProxyDaos (p: ProxyDao[]): Promise<void> {
    await browser.storage.local.set({ proxies: p })
  }

  private async getAllProxyDaos (): Promise<ProxyDao[]> {
    const fetched = await browser.storage.local.get('proxies')
    const proxies = (fetched as any).proxies as Array<Partial<ProxyDao>> ?? []

    const proxyDaoList = proxies.map(fillInDefaults)
    return proxyDaoList
  }
}

function fillInDefaults (proxy: Partial<ProxyDao>): ProxyDao {
  if (proxy.title === undefined) {
    proxy.title = ''
  }
  if (typeof proxy.doNotProxyLocal === 'undefined') {
    proxy.doNotProxyLocal = true
  }
  if (typeof proxy.proxyDNS === 'undefined') {
    if (proxy.type === 'socks' || proxy.type === 'socks4') {
      proxy.proxyDNS = true
    }
  }
  return proxy as ProxyDao
}
