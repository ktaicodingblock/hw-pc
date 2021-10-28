import { HwKind, IHwCmdRequest, IHwInfo } from '@aimk/hw-proto'
import { findFirstSerialPort, HwOperator, ISerialPortOperator } from '@aimk/hw-control'
import SerialPort from 'serialport'
import { WebSocket } from 'ws'
import { logger } from '../libs/log'

const DEBUG = true

export type DisposeFn = () => void
export type CommandHandlerFn = () => Promise<any>

export type DeviceControlRequest = {
    type: 'deviceCtl'
    body: IHwCmdRequest
}

export type WebSocketRequestPayload = DeviceControlRequest

export class HwControls {
    private _registry: Record<string, { info: IHwInfo; operator: HwOperator; control: any }> = {}
    private _serialPort: SerialPort | undefined = undefined
    private _hwId: string | undefined = undefined

    get hwId(): string | undefined {
        return this._hwId
    }

    isOpen = (): boolean => {
        return this._serialPort?.isOpen === true
    }

    get serialPort(): SerialPort | undefined {
        return this._serialPort
    }

    startHw(hwId: string, serialPort: SerialPort) {
        console.log(`startHwId(hwId=${hwId}, path=${serialPort.path})`)
        this._hwId = hwId
        this._serialPort = serialPort
    }

    stopHw() {
        console.log(`stopHw(hwId=${this._hwId})`)
        this.closeSerialPort()
        this._hwId = undefined
    }

    private closeSerialPort = () => {
        if (this._serialPort && this._serialPort.isOpen) {
            try {
                this._serialPort.close((err) => {
                    console.log(err)
                })
            } catch (ignore: any) {}
        }
        this._serialPort = undefined
    }

    isInitialized = () => {
        return Object.keys(this._registry).length > 0
    }

    registerHw = (hwId: string, info: IHwInfo, operator: HwOperator, control: any) => {
        this._registry[hwId] = { info, operator, control }
    }

    createSerialPort = async (hwId: string): Promise<SerialPort | undefined> => {
        const operator = this._registry[hwId]?.operator
        if (!operator) return undefined
        return await findFirstSerialPort(operator)
    }

    private _ensureSerialPort = async (): Promise<SerialPort | undefined> => {
        const hwId = this._hwId
        if (!hwId) {
            console.warn('cannot start hw controls')
            return
        }

        if (typeof this._serialPort === 'undefined') {
            const operator = this._registry[hwId]?.operator
            if (!operator) return undefined
            this._serialPort = await this.createSerialPort(hwId)
        }

        return this._serialPort!
    }

    onNewClientSocket = (socket: WebSocket): DisposeFn => {
        const handleMsg = (bufferData: Buffer) => {
            const payload = JSON.parse(bufferData.toString())
            console.log('payload=', { payload })
            if (payload.type === 'deviceCtl') {
                this._handleRequest(socket, payload.body)
            }
        }
        const handleClose = (code: number, reason: Buffer) => {
            console.log('onClose', { code, reason })
        }

        socket.on('message', handleMsg)
        socket.on('close', handleClose)
        //socket.on('hw-control', handlerFn)

        return () => {
            console.log(`dispose client socket`)
            socket.off('message', handleMsg)
            socket.off('close', handleClose)
        }
    }

    private _handleRequest = (socket: WebSocket, request: IHwCmdRequest) => {
        console.log('_handleRequest request =', { request })
        const { requestId, clientMeta, hwId, cmd, args } = request
        if (typeof requestId !== 'string' || typeof hwId !== 'string' || typeof cmd !== 'string') {
            console.warn('unknown request', request)
            return
        }

        this._handleCommand(socket, requestId, hwId, cmd, args)
    }

    private _handleCommand = async (
        socket: WebSocket,
        requestId: string,
        hwId: string,
        cmd: string,
        args: unknown[],
    ) => {
        if (hwId !== this._hwId) {
            console.log(`invalid hwId: ${hwId}, current hwId = ${this._hwId}`)
            return
        }
        const { control: ctl, info, operator } = this._registry[hwId] ?? {}
        if (!ctl || !info) {
            console.log(`ignore, unknown hardware: ${hwId}`, { requestId, hwId, cmd, args })
            return
        }

        // 요청이 왔을때 연결한다
        if (info.hwKind === HwKind.serial) {
            try {
                this._ensureSerialPort()
            } catch (err: any) {
                logger.debug(err)
                return
            }
            if (!ctl.serialPort) {
                ctl.serialPort = this._serialPort
            }
        }

        const fnName = cmd
        let fn = ctl[fnName]
        if (!(fn instanceof Function)) {
            console.log(`cannot resolve action function ${fnName}() on ${JSON.stringify(ctl)}`, {
                requestId,
                hwId,
                cmd,
                args,
            })
            return
        }

        fn = fn as CommandHandlerFn
        if (DEBUG) console.log('XXX args=', { args })
        fn.apply(ctl, args)
            .then((result: any) => {
                let resultFrame: any
                if (typeof result === 'undefined' || result === null) {
                    resultFrame = { type: 'channel', channel: requestId, success: true }
                } else {
                    resultFrame = { type: 'channel', channel: requestId, success: true, body: result }
                }
                socket.send(JSON.stringify(resultFrame))
            })
            .catch((err: any) => {
                console.log(err)
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send({ type: 'channel', channel: requestId, success: false, error: err.message })
                } else {
                    console.log('cannot response, because web socket disconnect')
                }
            })
    }
}
