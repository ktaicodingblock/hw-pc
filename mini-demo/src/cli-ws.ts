import {
  HwClientProxy,
  IWiseXboardControl,
  WiseXboardCommands,
} from "@aimk/hw-proto";
import ReconnectingWebSocket, {
  Options as ReconnectingWebSocketOptions,
} from "reconnecting-websocket";
import { WebSocket } from "ws";
import { sleep } from "./util";

async function testWise(wise: IWiseXboardControl) {
  for (let i = 0; i < 10; i++) {
    await wise.digitalWrite(2, 1);
    await sleep(1000);
    await wise.digitalWrite(2, 0);
    await sleep(1000);
  }
}

async function test1() {
  const options: ReconnectingWebSocketOptions = {
    WebSocket: WebSocket, // custom WebSocket constructor
    connectionTimeout: 1000,
    maxRetries: 10,
    debug: true,
  };

  let rws = new ReconnectingWebSocket("ws://localhost:4000", [], options);

  rws.addEventListener("open", () => {
    const proxy = new HwClientProxy(rws);
    const wise = proxy.bindCommands<IWiseXboardControl>({
      hwId: "wise-xboard",
      commands: WiseXboardCommands,
    });
    testWise(wise);
  });

  //   websock.on("open", function () {

  //   });
}

async function main() {
  test1();
}

main();
