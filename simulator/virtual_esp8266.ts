export interface SubNodePacket {
  magic: number;
  node_id: number;
  sequence_num: number;
  water_level_pct: number;
  water_liters: number;
  flow_rate_lpm: number;
  total_inflow_l: number;
  tds_ppm: number;
  temperature_c: number;
  sensor_health: number;
  battery_mv: number;
  crc16: number;
}

export class VirtualEsp8266SubNode {
  private sequenceNum: number = 1;
  public waterLevelPct: number = 72.5;
  public tankCapacityLiters: number = 2000.0;
  public totalInflowLiters: number = 4820.0;
  public baseTdsPpm: number = 245.0;
  public temperatureC: number = 24.2;

  constructor(initialLevelPct: number = 72.5) {
    this.waterLevelPct = initialLevelPct;
  }

  public stepPhysics(isPumpRunning: boolean, deltaSeconds: number = 2): SubNodePacket {
    let flowRate = 0.0;

    if (isPumpRunning) {
      // Pump is pumping water at ~14.5 Liters/min (with slight realistic variation)
      flowRate = 14.0 + (Math.sin(Date.now() / 3000) * 0.8) + (Math.random() * 0.4);
      const addedLiters = (flowRate / 60.0) * deltaSeconds;
      this.totalInflowLiters += addedLiters;

      // Increase water level percentage
      const deltaPct = (addedLiters / this.tankCapacityLiters) * 100.0;
      this.waterLevelPct = Math.min(100.0, this.waterLevelPct + deltaPct);
    } else {
      // Slow household consumption
      const consumptionLpm = 0.8 + Math.random() * 0.4;
      const consumedLiters = (consumptionLpm / 60.0) * deltaSeconds;
      const deltaPct = (consumedLiters / this.tankCapacityLiters) * 100.0;
      this.waterLevelPct = Math.max(0.0, this.waterLevelPct - deltaPct);
      flowRate = 0.0;
    }

    // Realistic sensor jitter
    const currentTds = this.baseTdsPpm + (Math.sin(Date.now() / 10000) * 8.0) + (Math.random() * 2.0 - 1.0);
    const currentTemp = this.temperatureC + (Math.sin(Date.now() / 30000) * 0.5);
    const currentLiters = (this.waterLevelPct / 100.0) * this.tankCapacityLiters;

    return {
      magic: 0xAA,
      node_id: 1,
      sequence_num: this.sequenceNum++,
      water_level_pct: parseFloat(this.waterLevelPct.toFixed(1)),
      water_liters: parseFloat(currentLiters.toFixed(1)),
      flow_rate_lpm: parseFloat(flowRate.toFixed(1)),
      total_inflow_l: parseFloat(this.totalInflowLiters.toFixed(1)),
      tds_ppm: parseFloat(currentTds.toFixed(0)),
      temperature_c: parseFloat(currentTemp.toFixed(1)),
      sensor_health: 0,
      battery_mv: 3300,
      crc16: 0xA1B2
    };
  }
}
