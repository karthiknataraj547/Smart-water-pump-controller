import { VirtualEsp32MainNode } from './virtual_esp32';

console.log('===========================================================');
console.log('  SMART IOT WATER PUMP HARDWARE & PHYSICS EMULATOR         ');
console.log('  Emulating: ESP32 Industrial Node + ESP8266 Sub Node      ');
console.log('===========================================================');

const node = new VirtualEsp32MainNode('WPC-A81F29');
node.connect('mqtt://localhost:1883');
