# 10 — Physical Installation & Wiring Schematics

## 1. Tank Installation (Sub Node)
- Mount the waterproof ultrasonic sensor (JSN-SR04T) vertically downward through the center of the tank lid, at least 15 cm above the maximum overflow water line (to respect the ultrasonic dead zone).
- Install the YF-S201 flow sensor horizontally in-line with the tank inlet pipe, ensuring water flows in the arrow direction indicated on the casing.
- Submerge the titanium TDS probe in the mid-water zone away from direct turbulent inlet splashing.

## 2. Pump Room Installation (Main Node)
- Install the ESP32 controller inside an IP65 rated DIN-rail enclosure next to the motor starter panel.
- Wire the opto-isolated relay to the contactor coil A1/A2 terminals.
- Feed the motor phase conductor through the ACS712 current sensor hall core.
