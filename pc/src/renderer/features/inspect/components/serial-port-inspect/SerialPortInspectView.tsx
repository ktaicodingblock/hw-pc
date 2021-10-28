import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import SerialPort from 'serialport'
import { usePromiseValue } from 'src/renderer/util/useServiceValue'
import Portlet from 'src/renderer/components/Portlet'
import PortletContent from 'src/renderer/components/PortletContent'
import PortletHeader from 'src/renderer/components/PortletHeader'
import HardwareIcon from '@mui/icons-material/Hardware'
import PortletLabel from 'src/renderer/components/PortletLabel'

// portinfo 예시
// const info:SerialPort.PortInfo = {
//     locationId: 'Port_#0001.Hub_#0006',
//     manufacturer: 'Silicon Labs',
//     path: 'COM8',
//     pnpId: 'USB\\VID_10C4&PID_EA60\\01C9FA85',
//     productId: 'EA60',
//     vendorId: '10C4',
//     serialNumber: '01C9FA85',
// }

export default function SerialPortInspectView() {
    const serialportList = usePromiseValue<SerialPort.PortInfo[]>(
        async () => await window.service.serialPort.list(),
        [],
    )

    return (
        <Portlet>
            <PortletHeader>
                <PortletLabel title="시리얼포트" icon={<HardwareIcon />} />
            </PortletHeader>
            <PortletContent>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Vecdor Id</TableCell>
                                <TableCell>Product Id</TableCell>
                                <TableCell>Path</TableCell>
                                <TableCell>제조사</TableCell>
                                <TableCell>Location Id</TableCell>
                                <TableCell>PnP Id</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {serialportList?.map((serial) => (
                                <TableRow key={serial.path}>
                                    <TableCell>{serial.productId}</TableCell>
                                    <TableCell>{serial.vendorId}</TableCell>
                                    <TableCell>{serial.path}</TableCell>
                                    <TableCell>{serial.manufacturer}</TableCell>
                                    <TableCell>{serial.locationId}</TableCell>
                                    <TableCell>{serial.pnpId}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </PortletContent>
        </Portlet>
    )
}
