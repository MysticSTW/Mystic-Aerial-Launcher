import type {
  MCPQueryProfileStorageItem,
  MCPStorageTransferItem,
} from '../../../types/services/mcp'
import type { AccountData } from '../../../types/accounts'

// import { ElectronAPIEventKeys } from '../../../config/constants/main-process'

// import { MainWindow } from '../../startup/windows/main'
import { Authentication } from '../authentication'

import {
  getQueryProfileStorageProfile,
  setStorageTransfer,
} from '../../../services/endpoints/mcp'

const maxBuildingMaterial = 5000

const calculateMaterial = (
  itemValue: MCPQueryProfileStorageItem,
  total: number
) => {
  const tempTotalSum = total + itemValue.quantity
  const tempRemoveOverflow = maxBuildingMaterial - total
  const quantity =
    tempTotalSum <= maxBuildingMaterial
      ? itemValue.quantity
      : tempRemoveOverflow

  return quantity
}

export class MCPStorageTransfer {
  /**
   * Moves wood/stone/metal from storage to the backpack. Returns a short
   * summary of what happened (Auto Claim writes it to its log).
   */
  static async buildingMaterials(account: AccountData): Promise<string> {
    try {
      await new Promise((resolve) => {
        setTimeout(() => resolve(true), 3_500) // 3.5 seconds
      })

      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        return 'no access token'
      }

      const { accountId } = account

      const response = await getQueryProfileStorageProfile({
        accessToken,
        accountId,
      })
      const profileChanges = response.data.profileChanges[0] ?? null
      const items = Object.entries(profileChanges.profile?.items ?? {})
      const buildingMaterials = items.filter(([, itemValue]) =>
        [
          'WorldItem:wooditemdata',
          'WorldItem:stoneitemdata',
          'WorldItem:metalitemdata',
        ].includes(itemValue.templateId)
      )

      if (buildingMaterials.length >= 0) {
        const wood = {
          total: 0,
          items: [] as Array<MCPStorageTransferItem>,
        }
        const stone = {
          total: 0,
          items: [] as Array<MCPStorageTransferItem>,
        }
        const metal = {
          total: 0,
          items: [] as Array<MCPStorageTransferItem>,
        }

        buildingMaterials.forEach(([itemId, itemValue]) => {
          if (itemValue.templateId === 'WorldItem:wooditemdata') {
            if (wood.total < maxBuildingMaterial) {
              const quantity = calculateMaterial(itemValue, wood.total)

              wood.total += quantity
              wood.items.push({
                itemId,
                quantity,
                newItemIdHint: '',
                toStorage: false,
              })
            }

            return
          }

          if (itemValue.templateId === 'WorldItem:stoneitemdata') {
            if (stone.total < maxBuildingMaterial) {
              const quantity = calculateMaterial(itemValue, stone.total)

              stone.total += quantity
              stone.items.push({
                itemId,
                quantity,
                newItemIdHint: '',
                toStorage: false,
              })
            }

            return
          }

          if (itemValue.templateId === 'WorldItem:metalitemdata') {
            if (metal.total < maxBuildingMaterial) {
              const quantity = calculateMaterial(itemValue, metal.total)

              metal.total += quantity
              metal.items.push({
                itemId,
                quantity,
                newItemIdHint: '',
                toStorage: false,
              })
            }

            return
          }
        })

        let itemsToTransfer: Array<MCPStorageTransferItem> = []

        if (wood.items.length > 0) {
          itemsToTransfer = [...itemsToTransfer, ...wood.items]
        }

        if (stone.items.length > 0) {
          itemsToTransfer = [...itemsToTransfer, ...stone.items]
        }

        if (metal.items.length > 0) {
          itemsToTransfer = [...itemsToTransfer, ...metal.items]
        }

        const summary = `wood=${wood.total} stone=${stone.total} metal=${metal.total}`

        if (itemsToTransfer.length <= 0) {
          return `nothing in storage (${summary})`
        }

        try {
          await setStorageTransfer({
            accessToken,
            accountId,
            items: itemsToTransfer,
          })

          return `moved to backpack: ${summary}`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          return `FAILED (${summary}): ${error?.response?.data?.errorCode ?? error?.message ?? error}`
        }
      }

      return 'nothing to do'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return `FAILED: ${error?.response?.data?.errorCode ?? error?.message ?? error}`
    }
  }
}
