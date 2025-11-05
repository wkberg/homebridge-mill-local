import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MillLocalPlatform } from './platform';
import { IDevice } from './device';

export class MillLocalPlatformAccessory {
  private service: Service;
  private modeSwitchService: Service;

  constructor(
    private readonly platform: MillLocalPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: IDevice,
  ) {
    const { Characteristic, Service } = this.platform;

    // --- Accessory Info ---
    this.accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Mill')
      .setCharacteristic(Characteristic.Model, 'Mill Heater Gen3 Panel')
      .setCharacteristic(Characteristic.SerialNumber, this.device.ID);

    // --- Heater Service (Main) ---
    this.service =
      this.accessory.getService(Service.HeaterCooler) ||
      this.accessory.addService(Service.HeaterCooler);

    this.service.setCharacteristic(Characteristic.Name, this.device.Name);

    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          Characteristic.TargetHeaterCoolerState.HEAT,
          Characteristic.TargetHeaterCoolerState.AUTO,
        ],
      });

    // --- Heater Characteristic Handlers ---
    this.service
      .getCharacteristic(Characteristic.Active)
      .onGet(this.handleGetActive.bind(this))
      .onSet(this.handleSetActive.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .onGet(this.handleGetTargetState.bind(this))
      .onSet(this.handleSetTargetState.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.handleGetCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleGetTargetTemperature.bind(this))
      .onSet(this.handleSetTargetTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({ minValue: 5, maxValue: 35, minStep: 0.5 });

// --- Mode Switch Service ---
this.modeSwitchService =
  this.accessory.getService('Manual Mode') ||
  this.accessory.addService(
    Service.Switch,
    'Manual Mode',       // name in HomeKit
    'manual-mode-switch' // unique subtype
  );
  
  this.accessory.services.forEach(service => {
  if (
    service.displayName === 'Manual Mode' &&
    service.subtype !== 'manual-mode-switch'
  ) {
    this.accessory.removeService(service);
  }
});

this.modeSwitchService
  .getCharacteristic(Characteristic.On)
  .onGet(() => this.device.Mode === 'ON')
  .onSet(async (value: CharacteristicValue) => {
    const newMode: 'ON' | 'SCHEDULED' = value ? 'ON' : 'SCHEDULED';
    this.platform.log.debug(`[${this.device.Name}] Manual Mode Switch → ${newMode}`);
    await this.device.setMode(newMode);
  });

    // --- Periodic update ---
    setInterval(() => this.updateFromDevice(), 30000);
  }

  // --- Characteristic Handlers ---

  async handleGetActive(): Promise<CharacteristicValue> {
    return this.device.Mode !== 'OFF' ? 1 : 0;
  }

  async handleSetActive(value: CharacteristicValue) {
    const isOn = value === 1;
    const newMode = isOn ? 'ON' : 'SCHEDULED';
    this.platform.log.debug(`[${this.device.Name}] SET Active → ${newMode}`);
    await this.device.setMode(newMode);
  }

  async handleGetTargetState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    switch (this.device.Mode) {
      case 'ON':
        return Characteristic.TargetHeaterCoolerState.HEAT;
      case 'SCHEDULED':
        return Characteristic.TargetHeaterCoolerState.AUTO;
      case 'OFF':
      default:
        return Characteristic.TargetHeaterCoolerState.HEAT;
    }
  }

  async handleSetTargetState(value: CharacteristicValue) {
    const { Characteristic } = this.platform;
    const newMode: 'ON' | 'SCHEDULED' | 'OFF' =
      value === Characteristic.TargetHeaterCoolerState.HEAT
        ? 'ON'
        : 'SCHEDULED';

    this.platform.log.debug(`[${this.device.Name}] SET TargetState → ${newMode}`);
    await this.device.setMode(newMode);
  }

  async handleGetCurrentTemperature(): Promise<CharacteristicValue> {
    return this.device.CurrentTemperature;
  }

  async handleGetTargetTemperature(): Promise<CharacteristicValue> {
    return this.device.TargetTemperature;
  }

  async handleSetTargetTemperature(value: CharacteristicValue) {
    await this.device.setTargetTemperature(value as number);
  }

  // --- Periodic device sync ---
  private async updateFromDevice() {
    try {
      await this.device.update();
      const { Characteristic } = this.platform;

      // Heater Active
      this.service.updateCharacteristic(
        Characteristic.Active,
        this.device.Mode !== 'OFF' ? 1 : 0
      );

      // Heater Target State
      const newState =
        this.device.Mode === 'SCHEDULED'
          ? Characteristic.TargetHeaterCoolerState.AUTO
          : Characteristic.TargetHeaterCoolerState.HEAT;

      this.service.updateCharacteristic(Characteristic.TargetHeaterCoolerState, newState);

      // Heater Temperatures
      this.service.updateCharacteristic(
        Characteristic.CurrentTemperature,
        this.device.CurrentTemperature
      );
      this.service.updateCharacteristic(
        Characteristic.HeatingThresholdTemperature,
        this.device.TargetTemperature
      );

      // Update Mode Switch
      if (this.modeSwitchService) {
        this.modeSwitchService.updateCharacteristic(
          Characteristic.On,
          this.device.Mode === 'ON'
        );
      }
    } catch (err) {
      this.platform.log.warn(
        `[${this.device.Name}] Failed to update device: ${(err as Error).message}`
      );
    }
  }
}