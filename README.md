# Mill Local Connection for Homebridge

**Mill Local Connection** allows you to control your Mill heaters directly via Homebridge, using your local network connection. This plugin supports:

- Turning the heater **ON** or **OFF**  
- Switching between **manual mode** (ON) and **scheduled mode** (AUTO / weekly program)  
- Adjusting the **target temperature**  
- Real-time updates of **current temperature** and **heater state**

> ⚠️ This plugin is still in active development. Use at your own discretion. Features and stability may improve over time.

## Features

- **Direct local control** without cloud dependency  
- **HomeKit integration** with proper Active / Target HeaterCoolerState reporting  
- Scheduled mode remains active without being flipped OFF automatically  

## Installation

Run this command in your terminal:

    npm install -g homebridge-mill-local

## Configuration

Add the accessory to your Homebridge `config.json`:

    {
      "accessories": [
        {
          "accessory": "MillLocal",
          "name": "Living Room Heater",
          "deviceId": "YOUR_DEVICE_ID",
          "ipAddress": "HEATER_LOCAL_IP"
        }
      ]
    }

## Usage Tips

- **Manual Mode (ON):** You can control the heater directly and set any target temperature  
- **Scheduled Mode (AUTO / Weekly Program):** The heater follows its pre-programmed schedule. The target temperature is managed automatically  
- **Active switch:** Turning the Active switch OFF will completely turn off the heater. Turning it ON will **not** force manual mode; the heater will continue following its current mode (manual or scheduled)  
- **Target HeaterCoolerState:** Use this to switch between manual (HEAT) and scheduled (AUTO) modes without interfering with the Active switch  

## Known Issues / Limitations

- The HomeKit UI may appear blank or show limited controls when in scheduled (AUTO) mode  