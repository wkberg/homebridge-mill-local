import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { IDevice } from './device';

import { MillLocalPlatform } from './platform';

export class MillPlatformAccessory {
  private service: Service;

  constructor(
    private readonly platform: MillLocalPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: IDevice,
  ) {
    const { Characteristic } = this.platform;
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'mill')
      .setCharacteristic(Characteristic.Model, 'Mill HeaterGen3Panel')
      .setCharacteristic(Characteristic.SerialNumber, this.device.ID);

    this.service =
      this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.setCharacteristic(
      Characteristic.Name,
      accessory.context.device.Name,
    );
    
    // Make sure only HEAT/AUTO/OFF modes are available, disable cooling completely
this.service
  .getCharacteristic(Characteristic.TargetHeaterCoolerState)
  .setProps({
    validValues: [
      Characteristic.TargetHeaterCoolerState.HEAT,
      Characteristic.TargetHeaterCoolerState.AUTO,
      Characteristic.TargetHeaterCoolerState.OFF,
    ],
  });
    
    const { Characteristic } = this.platform;
    
    

// Force heater-only mode
this.service
  .getCharacteristic(Characteristic.TargetHeaterCoolerState)
  .setProps({
    validValues: [Characteristic.TargetHeaterCoolerState.HEAT],
  });

this.service.setCharacteristic(
  Characteristic.TargetHeaterCoolerState,
  Characteristic.TargetHeaterCoolerState.HEAT,
);

    // create handlers for required characteristics
    this.service
      .getCharacteristic(Characteristic.Active)
      .onGet(this.handleActiveGet.bind(this))
      .onSet(this.handleActiveSet.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .onGet(this.handleCurrentHeaterCoolerStateGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .onGet(this.handleTargetHeaterCoolerStateGet.bind(this))
      .onSet(this.handleTargetHeaterCoolerStateSet.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
      .onSet(this.hadleHeatingThresholdTemperatureSet.bind(this));
      // 🔁 Periodically refresh the device state and update HomeKit
      setInterval(async () => {
  try {
    await this.device.update();

    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      this.device.On,
    );

    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHeaterCoolerState,
      this.device.isHeating
        ? this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
        : this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE,
    );

    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.device.CurrentTemperature,
    );
    this.service.updateCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature,
        this.device.TargetTemperature,
        );
    } catch (err) {
        this.platform.log.error(`Polling failed for ${this.device.Name}:`, err);
        }
    }, 30 * 1000); // every 30 seconds
      
  }

async handleActiveGet(): Promise<CharacteristicValue> {
  const isActive =
    this.device.Mode === 'Control individually'
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE;

  this.platform.log.debug('Get Characteristic Active ->', isActive);
  return isActive;
}

async handleActiveSet(value: CharacteristicValue) {
  const isTurningOn =
    value === this.platform.Characteristic.Active.ACTIVE;

  const newMode = isTurningOn ? 'Control individually' : 'Schedule';
  await this.device.setMode(newMode);

  this.platform.log.debug('Set Characteristic Active ->', newMode);
}

  async handleCurrentHeaterCoolerStateGet(): Promise<CharacteristicValue> {
    await this.device.update();

    const isHeating = this.device.isHeating;

    const State = {
      INACTIVE: this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE,
      IDLE: this.platform.Characteristic.CurrentHeaterCoolerState.IDLE,
      HEATING: this.platform.Characteristic.CurrentHeaterCoolerState.HEATING,
    };

    let currentState = State.IDLE;

    if (isHeating) {
      currentState = State.HEATING;
    }

    this.platform.log.debug(
      'Get Characteristic HeaterCoolerState ->',
      currentState,
    );

    return currentState;
  }

async handleTargetHeaterCoolerStateGet(): Promise<CharacteristicValue> {
  const { TargetHeaterCoolerState } = this.platform.Characteristic;

  // Map device mode to HomeKit state
  switch (this.device.Mode) {
    case 'Control individually':
      return TargetHeaterCoolerState.HEAT;
    case 'Schedule':
      return TargetHeaterCoolerState.AUTO;
    case 'OFF':
    default:
      return TargetHeaterCoolerState.OFF;
  }
}

async handleTargetHeaterCoolerStateSet(value: CharacteristicValue) {
  const { TargetHeaterCoolerState } = this.platform.Characteristic;
  let newMode: 'Control individually' | 'Schedule' | 'OFF' = 'OFF';

  switch (value) {
    case TargetHeaterCoolerState.HEAT:
      newMode = 'Control individually';
      break;
    case TargetHeaterCoolerState.AUTO:
      newMode = 'Schedule';
      break;
    case TargetHeaterCoolerState.OFF:
      newMode = 'OFF';
      break;
  }

  this.platform.log.debug(`Changing mode -> ${newMode}`);
  await this.device.setMode(newMode);

  // Update the Active characteristic to reflect ON/OFF properly
  this.service.updateCharacteristic(
    this.platform.Characteristic.Active,
    newMode === 'Control individually'
      ? this.platform.Characteristic.Active.ACTIVE
      : this.platform.Characteristic.Active.INACTIVE,
  );
}

  async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
    await this.device.update();

    const currentTemp = this.device.CurrentTemperature;

    this.platform.log.debug(`getting CurrentTemperature ${currentTemp}`);

    return currentTemp;
  }

  async handleHeatingThresholdTemperatureGet(): Promise<CharacteristicValue> {
    await this.device.update();

    const targetTemp = this.device.TargetTemperature;

    this.platform.log.debug(
      'Get Characteristic ThresholdTemperature ->',
      targetTemp,
    );

    return targetTemp;
  }

  async hadleHeatingThresholdTemperatureSet(value: CharacteristicValue) {
    this.device.setTargetTemperature(value as number);

    this.platform.log.debug(
      'Set Characteristic ThresholdTemperature ->',
      value,
    );
  }
}
