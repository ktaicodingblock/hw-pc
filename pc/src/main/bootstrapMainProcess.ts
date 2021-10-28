import { app, ipcMain, session, powerMonitor, protocol } from 'electron'
import settings from 'electron-settings'
import fs from 'fs-extra'
import path from 'path'
import 'reflect-metadata'
import { SETTINGS_FOLDER } from 'src/constants/appPaths'
import { MainChannel } from 'src/constants/channels'
import { isTest } from 'src/constants/environment'
import { bindServiceProxy } from 'src/main/bindServiceProxy'
import { container } from 'src/services/container'
import { logger } from 'src/services/libs/log'
import { IPreferencesService } from 'src/services/preferences/interface'
import serviceIdentifier from 'src/services/serviceIdentifier'
import { IWindowService } from 'src/services/windows/interface'
import { WindowNames } from 'src/services/windows/WindowProperties'

app.commandLine.appendSwitch('enable-web-bluetooth', 'true')

const CSP = [
    `'self'`,
    `'unsafe-eval'`,
    `'unsafe-inline'`,
    'data:',
    'mediastream:',
    'blob:',
    'filesystem:',
    'http://localhost:*',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://blockly-demo.appspot.com',
    'https://cdn.rawgit.com',
    'https://cdn.jsdelivr.net',
]
const CSP_ARRAY = ['default-src', 'style-src-elem', 'img-src', 'script-src', 'font-src'].map(
    (it) => `${it} ${CSP.join(' ')}`,
)

settings.configure({ dir: SETTINGS_FOLDER })
bindServiceProxy()

const preferenceService = container.get<IPreferencesService>(serviceIdentifier.Preferences)
const windowService = container.get<IWindowService>(serviceIdentifier.Window)

async function customInit() {
    logger.warn('customInit() called: isRegistered:' + protocol.isProtocolRegistered('file'))
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': CSP_ARRAY,
            },
        })
    })

    const succ = protocol.registerFileProtocol('file', (request, callback) => {
        logger.warn('protocol handler called:', request.url)
        const pathname = decodeURIComponent(request.url.replace('file:///', ''))
        if (path.isAbsolute(pathname) ? fs.existsSync(pathname) : fs.existsSync(`/${pathname}`)) {
            logger.warn(`registerFileProtocol ${pathname}`)
            callback(pathname)
        } else {
            // on production, __dirname will be in .webpack/main
            const filePath = path.join(app.getAppPath(), '.webpack', 'renderer', pathname)
            logger.warn(`registerFileProtocol ${filePath}`)
            callback(filePath)
        }
    })

    if (!succ) {
        logger.error('Failed to registerFileProtocol file:///')
        app.quit()
    }

    await windowService.open(WindowNames.main)
    // perform wiki startup and git sync for each workspace
    // await workspaceViewService.initializeAllWorkspaceView()
    // buildLanguageMenu()

    ipcMain.emit('request-update-pause-notifications-info')
    // Fix webview is not resized automatically when window is maximized on Linux
    // https://github.com/atomery/webcatalog/issues/561
    // run it here not in mainWindow.createAsync()
    // because if the `mainWindow` is maximized or minimized
    // before the workspaces's BrowserView fully loaded error will occur
    // see https://github.com/atomery/webcatalog/issues/637
    // eslint-disable-next-line promise/always-return
    const mainWindow = windowService.get(WindowNames.main)
    if (process.platform === 'linux') {
        if (mainWindow !== undefined) {
            const handleMaximize = (): void => {
                // getContentSize is not updated immediately
                // try once after 0.2s (for fast computer), another one after 1s (to be sure)
                // setTimeout(() => {
                //     void workspaceViewService.realignActiveWorkspace()
                // }, 200)
                // setTimeout(() => {
                //     void workspaceViewService.realignActiveWorkspace()
                // }, 1000)
            }
            mainWindow.on('maximize', handleMaximize)
            mainWindow.on('unmaximize', handleMaximize)
        }
    }

    if (mainWindow) {
        // mainWindow.webContents.session.setPermissionCheckHandler(
        //     (webContents, permission, requestingOrigin, details) => {
        //         if (permission === 'serial' && details.securityOrigin === 'file:///') {
        //             return true
        //         }
        //     },
        // )
        // mainWindow.webContents.session.setDevicePermissionHandler((details) => {
        //     if (details.deviceType === 'serial' && details.origin === 'file://') {
        //         return true
        //     }
        //     return false
        // })
        // mainWindow.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
        //     event.preventDefault()
        //     logger.info('select-serial-port: ' + portList?.map((it) => it.portId).join(','))
        //     if (portList && portList.length > 0) {
        //         callback(portList[0].portId)
        //     } else {
        //         callback('') //Could not find any matching devices
        //     }
        // })
        // mainWindow.webContents.session.on('serial-port-added', (event, port) => {
        //     logger.info('serial-port-added FIRED WITH' + port)
        // })
        // mainWindow.webContents.session.on('serial-port-removed', (event, port) => {
        //     logger.info('serial-port-removed FIRED WITH' + port)
        // })
    }

    // trigger whenTrulyReady
    // ipcMain.emit(MainChannel.commonInitFinished)
}

app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    const mainWindow = windowService.get(WindowNames.main)
    if (mainWindow !== undefined) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore()
        }
        mainWindow.focus()
    }
})

if (fs.existsSync(settings.file())) {
    preferenceService.getPreferences().then((pref) => {
        if (!pref['useHardwareAcceleration']) {
            app.disableHardwareAcceleration()
        }
        if (!pref['ignoreCertificateErrors']) {
            // https://www.electronjs.org/docs/api/command-line-switches
            app.commandLine.appendSwitch('ignore-certificate-errors')
        }
    })
}

app.on('ready', () => {
    powerMonitor.on('shutdown', () => {
        app.quit()
    })
    customInit()
})

app.on(MainChannel.windowAllClosed, () => {
    // prevent quit on MacOS. But also quit if we are in test.
    if (process.platform !== 'darwin' || isTest) {
        app.quit()
    }
})

app.on('activate', () => {
    // // On OS X it's common to re-create a window in the app when the
    // // dock icon is clicked and there are no other windows open.
    // if (BrowserWindow.getAllWindows().length === 0) {
    //     createWindow()
    // }
    windowService.open(WindowNames.main)
})

app.on('before-quit', async () => {
    logger.info('App before-quit')
    logger.info('Quitting worker threads and watcher.')
    if (process.platform === 'darwin') {
        const mainWindow = windowService.get(WindowNames.main)
        if (mainWindow !== undefined) {
            logger.info('App force quit on MacOS')
            await windowService.updateWindowMeta(WindowNames.main, { forceClose: true })
        }
    }
    app.exit(0)
})

app.on('quit', () => {
    logger.info('App quit')
})

// const menu = new Menu()
// menu.append(
//     new MenuItem({
//         label: 'File',
//         submenu: [
//             {
//                 role: 'help',
//                 accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Alt+Shift+I',
//                 click: () => {
//                     console.log('Electron rocks!')
//                 },
//             },
//         ],
//     }),
// )
// Menu.setApplicationMenu(menu)
