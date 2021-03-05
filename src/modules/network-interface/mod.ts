// deno-lint-ignore-file no-explicit-any
import { EOL } from 'https://deno.land/std@0.114.0/fs/eol.ts'

import { Exec } from '../exec/mod.ts'
import { NetworkIPs, IGetInterfaceIPReturnSingle } from '../network-IPs/mod.ts'
import { ClassArray } from '../array/mod.ts'
import { ShellCommand } from '../shell-command/mod.ts'

/**
 * output example "ip link show ${nameInterface}"
 * 1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
 * link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
 */
const regexes = {
  // will match "1: lo: <LOOPBACK,UP,LOWER_UP> mtu "
  iplinkMTU: /.+mtu\s/,
  // will match all the way to "link/loopback " and just before MAC address
  iplinkBeforeMAC: /link\/([^\s]+) /,

  numbersInRow: /\d+/,
}

export interface IGetAllNetworkInterfacesDataReturnSingle {
  readonly MAC: string
  readonly MTU: number
  readonly group: string
  readonly IPs: IGetInterfaceIPReturnSingle
  readonly nameInterface: string
  // for example wanvir@eth0 will have parent set as eth0
  readonly nameInterfaceParent: string
  readonly state: 'UP' | 'DOWN' | 'UNKNOWN'
}

export type TGetAllNetworkInterfacesDataReturn =
  Array<IGetAllNetworkInterfacesDataReturnSingle>

export interface IGetSingleNetworkInterfacesDataReturn {
  readonly nameInterface: string
  readonly nameInterfaceParent: string
  readonly output: string
}

export interface IGetNetworkInterfacesDataOptions {
  readonly interfacesExclude?: string[]
  readonly interfacesInclude?: string[]
  readonly shellCommandGetInterfaces?: string
}

export class NetworkInterface {
  static checkRequiredCommands() {
    return ShellCommand.API.checkRequiredCommands({
      commandsSpecification: {
        ss: {
          messageError: 'iproute2 command "ss" was not found.',
        },
      },
    })
  }

  static API = {
    async getSingleNetworkInterfacesData({
      checkRequiredCommands: shouldCheckRequiredCommands = true,
      nameInterface,
    }: {
      readonly checkRequiredCommands?: boolean
      readonly nameInterface: string
    }) {
      if (shouldCheckRequiredCommands) {
        await NetworkInterface.checkRequiredCommands()
      }

      const {
        outputs: { stdErr, stdOut },
        status,
      } = await Exec.API.exec({
        getCommand: () => `ip link show ${nameInterface}`,
        throwOnCommandError: false,
      })

      if (!status.success || !stdOut) {
        console.error(stdErr)

        throw new Error(
          `Failed to get network interface data for interface: "${nameInterface}"`
        )
      }

      return {
        nameInterface,
        output: stdOut,
      }
    },

    async getNetworkInterfacesData({
      interfacesExclude = [],
      interfacesInclude = [],
      shellCommandGetInterfaces = `ip addr list | awk -F': ' '/^[0-9]/ {print $2}'`,
    }: IGetNetworkInterfacesDataOptions = {}) {
      await NetworkInterface.checkRequiredCommands()

      const {
        command,
        outputs: { stdErr, stdOut },
      } = await Exec.API.exec({
        getCommand: () => shellCommandGetInterfaces,
        throwOnCommandError: false,
        withShell: true,
      })

      if (!stdOut) {
        console.error(stdErr)

        throw new Error(
          `Failed to get network interfaces using ===> ${command.string}`
        )
      }

      const hasInterfaceInclusion = interfacesInclude.length > 0
      const interfacesExcludeMap = ClassArray.arrayToLookUpMap({
        array: interfacesExclude,
      })
      const interfacesIncludeMap = ClassArray.arrayToLookUpMap({
        array: interfacesInclude,
      })
      const interfacesFoundFromOutput = stdOut.split(EOL.LF)
      const interfacesFoundFromOutputMap = ClassArray.arrayToLookUpMap({
        array: interfacesFoundFromOutput,
      })

      if (interfacesInclude.length) {
        interfacesInclude.forEach((interfaceName) => {
          if (!interfacesFoundFromOutputMap[interfaceName]) {
            throw new Error(
              `interface "${interfaceName}" which is supposed to be included was not found in system.`
            )
          }
        })
      }
      const dataInterface: Array<IGetSingleNetworkInterfacesDataReturn> = []
      const dataInterfaceIPs = {} as {
        [interfaceName: string]: IGetInterfaceIPReturnSingle
      }

      const execPromises = interfacesFoundFromOutput.reduce(
        (acc, nameInterfaceInput) => {
          // remove @ because they are virtual devices
          const nameInterfaceSplit = nameInterfaceInput.split('@')
          const nameInterface = nameInterfaceSplit[0]
          const nameInterfaceParent = nameInterfaceSplit[1] || ''

          if (
            (hasInterfaceInclusion && !interfacesIncludeMap[nameInterface]) ||
            interfacesExcludeMap[nameInterface]
          ) {
            return acc
          }

          acc.push(
            NetworkInterface.API.getSingleNetworkInterfacesData({
              checkRequiredCommands: false,
              nameInterface,
            }).then((x) => {
              dataInterface.push({
                ...x,
                nameInterfaceParent,
              })
              return x
            })
          )

          acc.push(
            NetworkIPs.getNetInterfaceIPs({
              nameInterface,
            }).then((x) => {
              dataInterfaceIPs[nameInterface] = x
              return x
            })
          )

          return acc
        },
        [] as Array<Promise<any>>
      )

      await Promise.all(execPromises)

      const dataObject = {} as {
        [nameInterface: string]: IGetAllNetworkInterfacesDataReturnSingle
      }

      return {
        dataArray: dataInterface.reduce(
          (acc, { nameInterface, nameInterfaceParent, output }) => {
            const dataSingleObject: IGetAllNetworkInterfacesDataReturnSingle = {
              MAC: output.split(regexes.iplinkBeforeMAC)[2].split(' brd')[0],
              MTU: +(output
                .replace(regexes.iplinkMTU, '')
                .match(regexes.numbersInRow) as any),
              group: output.split('group')[1].split(' ')[1].trim() as any,
              nameInterface,
              nameInterfaceParent,
              state: output.split('state')[1].split('mode')[0].trim() as any,
              IPs: dataInterfaceIPs[nameInterface],
            }

            dataObject[nameInterface] = dataSingleObject

            acc.push(dataSingleObject)
            return acc
          },
          [] as TGetAllNetworkInterfacesDataReturn
        ),
        dataObject,
      }
    },
  }
}
