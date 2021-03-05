import { EOL } from 'https://deno.land/std@0.152.0/fs/eol.ts'
import { expandIPv6Number } from 'https://cdn.skypack.dev/ip-num@1'

import { ShellCommand } from '../shell-command/mod.ts'
import { Exec } from '../exec/mod.ts'
import { DependencyHandler } from '../dependency-handler/mod.ts'

export enum EIPFamilyAddressTypes {
  IPv4 = 'IPv4',
  IPv6 = 'IPv6',
}

export interface IGetNetInterfacesIPsOptions {
  readonly nameInterfaces: string[]
}

export interface IGetNetInterfaceIPsOptions {
  readonly checkRequiredCommands?: boolean
  readonly nameInterface: string
}

export interface IGetInterfaceIPInfoIPv4 {
  readonly address: string
  readonly family: EIPFamilyAddressTypes
  readonly lengthPrefix: number
}

export interface IGetInterfaceIPInfoIPv6 extends IGetInterfaceIPInfoIPv4 {
  readonly addressIPv6Short: string
}

export interface IGetInterfaceAllIPInfo {
  IPv4: Array<IGetInterfaceIPInfoIPv4>
  IPv6: Array<IGetInterfaceIPInfoIPv6>
  IPvAll: Array<IGetInterfaceIPInfoIPv4 | IGetInterfaceIPInfoIPv6>
}

export interface IGetInterfaceIPReturnSingle {
  readonly dataArray: IGetInterfaceAllIPInfo
  readonly hasIPs: boolean
  readonly nameInterface: string
  readonly success: boolean
}

export type TGetInterfaceIPsReturn = Array<IGetInterfaceIPReturnSingle>

export class NetworkIPs {
  static DH = new DependencyHandler({
    dependencies: {
      Exec,
    },
  })

  static CONSTANTS = {
    commandsRequired: [
      {
        description: 'iproute2',
        nameCommand: 'ss',
      },
    ],
  }

  static getters = {
    netInterfaceIPsReturn() {
      return {
        IPv4: [],
        IPv6: [],
        IPvAll: [],
      } as IGetInterfaceIPReturnSingle['dataArray']
    },
  }

  static checkRequiredCommands = () =>
    ShellCommand.API.checkRequiredCommands({
      commandsSpecification: {
        ss: {
          messageError: 'iproute2 command "ss" was not found.',
        },
      },
    })

  static async getNetInterfaceIPs({
    checkRequiredCommands: shouldCheckRequiredCommands = true,
    nameInterface,
  }: IGetNetInterfaceIPsOptions): Promise<IGetInterfaceIPReturnSingle> {
    if (shouldCheckRequiredCommands) {
      await NetworkIPs.checkRequiredCommands()
    }

    const {
      outputs: { stdOut },
    } = await NetworkIPs.DH.dependencies.Exec.API.exec({
      getCommand: () => `ip addr show ${nameInterface}`,
    })

    if (!stdOut) {
      return {
        dataArray: NetworkIPs.getters.netInterfaceIPsReturn(),
        hasIPs: false,
        nameInterface,
        success: false,
      }
    }

    const dataReturn = NetworkIPs.getters.netInterfaceIPsReturn()

    stdOut.split(EOL.LF).forEach((str) => {
      if (str.includes('inet6')) {
        const dataIPWithPrefixLength = str
          .trim()
          .replace('inet6 ', '')
          .split(' scope')[0]
          .split('/')

        dataReturn.IPv6.push({
          address: expandIPv6Number(dataIPWithPrefixLength[0]),
          addressIPv6Short: dataIPWithPrefixLength[0],
          family: EIPFamilyAddressTypes.IPv6,
          lengthPrefix: +dataIPWithPrefixLength[1] || 0,
        })
      } else if (str.includes('inet')) {
        const dataIPWithPrefixLength = str
          .trim()
          .replace('inet ', '')
          .split(' brd')[0]
          .split('/')

        dataReturn.IPv4.push({
          address: dataIPWithPrefixLength[0],
          family: EIPFamilyAddressTypes.IPv4,
          lengthPrefix: +dataIPWithPrefixLength[1] || 0,
        })
      }
    })

    dataReturn.IPvAll = dataReturn.IPv4.concat(dataReturn.IPv6)

    return {
      dataArray: dataReturn,
      hasIPs: dataReturn.IPvAll.length > 0,
      nameInterface,
      success: true,
    }
  }

  static async getNetInterfacesIPs({
    nameInterfaces,
  }: IGetNetInterfacesIPsOptions) {
    await NetworkIPs.checkRequiredCommands()

    const dataObject = {} as {
      [key: string]: IGetInterfaceIPReturnSingle
    }

    return {
      dataArray: await Promise.all(
        Array.from(new Set(nameInterfaces)).reduce((acc, nameInterface) => {
          acc.push(
            NetworkIPs.getNetInterfaceIPs({
              checkRequiredCommands: false,
              nameInterface,
            }).then((x) => {
              dataObject[nameInterface] = x
              return x
            })
          )

          return acc
        }, [] as Array<Promise<IGetInterfaceIPReturnSingle>>)
      ),
      dataObject,
    }
  }
}
