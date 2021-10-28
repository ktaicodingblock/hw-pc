import { createProxy } from 'src/electron-ipc-cat/client'
import { IPreferencesService, PreferenceServiceIPCDescriptor } from 'src/services/preferences/interface'
import { IContextService, ContextServiceIPCDescriptor } from 'src/services/context/interface'
import { ISerialPortService, SerialPortServiceIPCDescriptor } from 'src/services/serialport/interface'
import { HidServiceIPCDescriptor, IHidService } from 'src/services/hid/interface'
import { IWindowService, WindowServiceIPCDescriptor } from 'src/services/windows/interface'
import { IMenuService, MenuServiceIPCDescriptor } from 'src/services/menu/interface'
import { IHwService, HwServiceIPCDescriptor } from 'src/services/hw/interface'
import { INativeService, NativeServiceIPCDescriptor } from 'src/services/native/interface'

export const preferences = createProxy<IPreferencesService>(PreferenceServiceIPCDescriptor)
export const context = createProxy<IContextService>(ContextServiceIPCDescriptor)
export const serialPort = createProxy<ISerialPortService>(SerialPortServiceIPCDescriptor)
export const hid = createProxy<IHidService>(HidServiceIPCDescriptor)
export const menu = createProxy<IMenuService>(MenuServiceIPCDescriptor)
export const window = createProxy<IWindowService>(WindowServiceIPCDescriptor)
export const hw = createProxy<IHwService>(HwServiceIPCDescriptor)
export const native = createProxy<INativeService>(NativeServiceIPCDescriptor)

export const descriptors = {
    preferences: PreferenceServiceIPCDescriptor,
    context: ContextServiceIPCDescriptor,
    serialPort: SerialPortServiceIPCDescriptor,
    hid: HidServiceIPCDescriptor,
    window: WindowServiceIPCDescriptor,
    menu: MenuServiceIPCDescriptor,
    hw: HwServiceIPCDescriptor,
    native: NativeServiceIPCDescriptor,
}
