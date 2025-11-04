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
    const isActive = this.device.On;

    this.platform.log.debug('Get Characteristic Active ->', isActive);

    return isActive;
  }

 async handleActiveSet(value: CharacteristicValue) {
  await this.device.setOn(value as boolean);
  this.platform.log.debug('Set Characteristic Active ->', value);
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
    const State = {
      AUTO: this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
      HEAT: this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
    };
    const currentState = State.HEAT;

    this.platform.log.debug(`Get TargetHeaterCoolerState ${currentState}`);

    return currentState;
  }

  async handleTargetHeaterCoolerStateSet(value: CharacteristicValue) {
    // There is no auto in this case..
    this.platform.log.debug(`Set TargetHeaterCoolerState ${value}`);
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
