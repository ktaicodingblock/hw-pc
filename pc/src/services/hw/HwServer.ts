import { controls as HwRegistry } from '@aimk/hw-control'
import { EventEmitter } from 'events'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { WebSocketServer } from 'ws'
import { HwControls } from './HwControls'

const DEFAULT_OPTIONS = {
    listenPort: 3000,
}

type EventKey = 'start' | 'stop'

export class HwServer {
    private _httpServer: http.Server | undefined = undefined
    private _io: Server | undefined = undefined
    private _wsServer: WebSocketServer | undefined = undefined
    private _initialized = false
    private _options: { listenPort: number }
    private _controls: HwControls
    private _emitter: EventEmitter

    constructor(controls: HwControls, opts?: { listenPort: number }) {
        this._options = { ...(opts ?? DEFAULT_OPTIONS) }
        this._controls = controls
        this._emitter = new EventEmitter()
    }

    private init() {
        if (this._initialized) {
            return
        }
        this._initialized = true

        Object.entries(HwRegistry).forEach(([hwId, hw]) => {
            console.log({ hw })
            this._controls.registerHw(hwId, hw.info, hw.operator, hw.control())
        })
    }

    on = (event: EventKey, callback: () => void) => {
        this._emitter.on(event, callback)
    }

    once = (event: EventKey, callback: () => void) => {
        this._emitter.once(event, callback)
    }

    off = (event: EventKey, callback: () => void) => {
        this._emitter.off(event, callback)
    }

    async start() {
        this.init()
        await this.stop()
        const app = express()
        const httpServer = http.createServer(app)
        const wsServer = new WebSocketServer({ server: httpServer })

        this._httpServer = httpServer
        this._wsServer = wsServer
        const controls = this._controls
        wsServer.on('connection', (ws) => {
            console.log('on new client' + ws)
            controls.onNewClientSocket(ws)
        })

        httpServer.listen(this._options.listenPort, () => {
            console.log(`listening on *:${this._options.listenPort}`)
            this._emitter.emit('start')
        })
    }

    async stop() {
        const wsServer = this._wsServer
        const promiseList: Array<Promise<void>> = []
        if (wsServer) {
            promiseList.push(
                new Promise<void>((resolve) => {
                    wsServer.close((err) => {
                        if (err) {
                            console.log('ignore, websocket server close error:' + err.message)
                        } else {
                            console.log('websocket server closed')
                        }
                        resolve()
                    })
                }),
            )
        }
        const httpServer = this._httpServer
        if (httpServer) {
            promiseList.push(
                new Promise<void>((resolve) => {
                    httpServer.close((err) => {
                        if (err) {
                            console.log('ignore, server close error:' + err.message)
                        } else {
                            console.log('server closed')
                        }
                        resolve()
                    })
                }),
            )
        }
        this._wsServer = undefined
        this._httpServer = undefined

        if (promiseList.length > 0) {
            await Promise.all(promiseList)
            this._emitter.emit('stop')
        }
    }
}
