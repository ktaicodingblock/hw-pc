import SerialPort from 'serialport'
import path from 'path'
import { app, dialog, MessageBoxOptions, shell } from 'electron'
import { IHwInfo } from '@aimk/hw-proto'
import { controls as HwRegistry } from '@aimk/hw-control'
import { injectable } from 'inversify'
import { BehaviorSubject } from 'rxjs'
import { HwServer } from './HwServer'
import { HwServerState, IHwService } from './interface'
import serviceIdentifier from '../serviceIdentifier'
import { lazyInject } from 'src/services/container'
import { IContextService } from '../context/interface'
import { ISerialPortService } from '../serialport/interface'
import { HwControls } from './HwControls'
import { logger } from '../libs/log'

@injectable()
export class HwService implements IHwService {
    @lazyInject(serviceIdentifier.Context) private readonly contextService!: IContextService
    @lazyInject(serviceIdentifier.SerialPort) private readonly serialPortService!: ISerialPortService

    /**
     * @override
     */
    public hwServerState$ = new BehaviorSubject<HwServerState>({ running: false })

    private _controls = new HwControls()
    private _serverDisposeFn: (() => Promise<void>) | undefined = undefined

    constructor() {
        // empty
    }

    async getHwServerState(): Promise<HwServerState> {
        return this.hwServerState$.value
    }

    private _onStop = () => {
        console.log('hw service stopped')
        this.stop()
    }

    async infoList(): Promise<IHwInfo[]> {
        try {
            return Object.values(HwRegistry).map((it) => it.info)
        } catch (err) {
            console.log('error', err)
            return []
        }
    }

    async findInfoById(hwId: string): Promise<IHwInfo> {
        return HwRegistry[hwId].info
    }

    async isSupportHw(hwId: string): Promise<boolean> {
        return hwId in HwRegistry
    }

    async serialPortList(hwId: string): Promise<SerialPort.PortInfo[]> {
        const hw = HwRegistry[hwId]
        const list = await this.serialPortService.list()
        return list.filter(hw.operator.isMatch)
    }

    async isReadable(hwId: string, portPath: string): Promise<boolean> {
        if (this._controls.hwId !== hwId) return false
        let port: SerialPort | undefined = this._controls.serialPort
        try {
            if (port && port.isOpen && port.path === portPath) {
                return true
            }
        } catch (err: any) {
            console.log('serialport open fail(2):' + err)
        }
        return false
    }

    async downloadDriver(driverUri: string): Promise<void> {
        if (driverUri.startsWith('http://') || driverUri.startsWith('https://')) {
            shell.openExternal(driverUri)
        } else {
            const folder = await this.contextService.get('DRIVER_FOLDER')
            shell.openPath(path.resolve(folder, driverUri))
        }
    }

    async downloadFirmware(firmwareUri: string): Promise<void> {
        if (firmwareUri.startsWith('http://') || firmwareUri.startsWith('https://')) {
            shell.openExternal(firmwareUri)
        } else {
            const folder = await this.contextService.get('FIRMWARE_FOLDER')
            shell.openPath(path.resolve(folder, firmwareUri))
        }
    }

    private initControls() {
        Object.entries(HwRegistry).forEach(([hwId, hw]) => {
            console.log({ hw })
            this._controls.registerHw(hwId, hw.info, hw.operator, hw.control())
        })
    }

    private findSerialPortInfo = async (portPath: string): Promise<SerialPort.PortInfo | undefined> => {
        const list = await SerialPort.list()
        return list.find((it) => it.path === portPath)
    }

    async selectHw(hwId: string): Promise<void> {
        const state = this.hwServerState$.value ?? {}
        if (state.hwId === hwId) {
            return
        }
        await this.stopServer()
        this.hwServerState$.next({ hwId, running: false })
    }

    async start(hwId: string, portPath: string): Promise<void> {
        await this.stopServer()
        console.log(`hw service starting: ${hwId},  ${portPath}`)

        if (!this._controls.isInitialized()) {
            this.initControls()
        }
        const portInfo = await this.findSerialPortInfo(portPath)
        if (!portInfo) {
            console.log('cannot find serialPort:' + portPath)
            return
        }

        let serialPort: SerialPort | undefined
        try {
            serialPort = await this._controls.createSerialPort(hwId)
        } catch (err) {
            logger.info(serialPort)
            return
        }

        if (!serialPort) {
            console.log('cannot create serialPort:' + portPath)
            return
        }

        this._controls.startHw(hwId, serialPort)

        const server = new HwServer(this._controls, { listenPort: 4000 })
        await server.start()
        console.log('hw service started')
        this.hwServerState$.next({ hwId, running: true })
        server.on('stop', this._onStop)

        this._serverDisposeFn = async () => {
            try {
                await server.stop()
            } catch (ignore: any) {
                console.log(ignore.message)
            }
            try {
                this._controls.stopHw()
            } catch (ignore: any) {
                console.log(ignore.message)
            }
        }
    }

    async stopServer(): Promise<void> {
        if (this._serverDisposeFn) {
            await this._serverDisposeFn?.()
        }
        this._serverDisposeFn = undefined
        const state = this.hwServerState$.value ?? {}
        state.running = false
        this.hwServerState$.next(state)
    }

    async stop(): Promise<void> {
        if (this._serverDisposeFn) {
            await this._serverDisposeFn?.()
        }
        this._serverDisposeFn = undefined
        this.hwServerState$.next({ running: false })
    }
}
