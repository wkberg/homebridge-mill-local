import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MillLocalPlatform } from './platform';
import { IDevice } from './device';

export class MillLocalPlatformAccessory {
  private service: Service;
  private modeSwitch: Service; // NEW: separate switch for controlling mode

  constructor(
    private readonly platform: MillLocalPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: IDevice,
  ) {
    const { Characteristic, Service } = this.platform;

    // Set accessory info
    this.accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Mill')
      .setCharacteristic(Characteristic.Model, 'Mill Heater Gen3 Panel')
      .setCharacteristic(Characteristic.SerialNumber, this.device.ID);

    // HeaterCooler service (main)
    this.service =
      this.accessory.getService(Service.HeaterCooler) ||
      this.accessory.addService(Service.HeaterCooler);

    this.service.setCharacteristic(Characteristic.Name, this.device.Name);

    // Restrict to only HEAT + AUTO
    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          Characteristic.TargetHeaterCoolerState.HEAT,
          Characteristic.TargetHeaterCoolerState.AUTO,
        ],
      });

    // --- Characteristic Handlers ---

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
      .setProps({
        minValue: 5,
        maxValue: 35,
        minStep: 0.5,
      });

    // --- NEW: Mode Switch Service ---
    this.modeSwitch =
      this.accessory.getService('Heater Mode') ||
      this.accessory.addService(Service.Switch, 'Heater Mode');

    this.modeSwitch.getCharacteristic(Characteristic.On)
      .onGet(() => this.device.Mode === 'Control individually')
      .onSet(async (value) => {
        let newMode: 'Control individually' | 'Weekly program' | 'OFF';
        if (value) {
          newMode = 'Control individually';
        } else if (this.device.Mode === 'OFF') {
          newMode = 'OFF';
        } else {
          newMode = 'Weekly program';
        }
        this.platform.log.debug(`[${this.device.Name}] Mode Switch → ${newMode}`);
        await this.device.setMode(newMode);
        // Update main service so HomeKit reflects the change
        this.updateFromDevice();
      });

    // Periodically update
    setInterval(() => this.updateFromDevice(), 30000);
  }

  async handleGetActive(): Promise<CharacteristicValue> {
    return this.device.Mode !== 'OFF' ? 1 : 0;
  }

  async handleSetActive(value: CharacteristicValue) {
    const isOn = value === 1;
    const newMode = isOn ? 'Control individually' : 'Weekly program';
    await this.device.setMode(newMode);
    this.updateFromDevice();
  }

  async handleGetTargetState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    switch (this.device.Mode) {
      case 'Control individually':
        return Characteristic.TargetHeaterCoolerState.HEAT;
      case 'Weekly program':
        return Characteristic.TargetHeaterCoolerState.AUTO;
      case 'OFF':
      default:
        return Characteristic.TargetHeaterCoolerState.HEAT;
    }
  }

  async handleSetTargetState(value: CharacteristicValue) {
    const { Characteristic } = this.platform;
    let newMode: 'Control individually' | 'Weekly program' | 'OFF';
    switch (value) {
      case Characteristic.TargetHeaterCoolerState.HEAT:
        newMode = 'Control individually';
        break;
      case Characteristic.TargetHeaterCoolerState.AUTO:
        newMode = 'Weekly program';
        break;
      default:
        newMode = 'OFF';
    }
    await this.device.setMode(newMode);
    this.updateFromDevice();
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

  private async updateFromDevice() {
    try {
      await this.device.update();
      const { Characteristic } = this.platform;

      // Active
      this.service.updateCharacteristic(
        Characteristic.Active,
        this.device.Mode !== 'OFF' ? 1 : 0
      );

      // Target State
      const newState =
        this.device.Mode === 'Weekly program'
          ? Characteristic.TargetHeaterCoolerState.AUTO
          : Characteristic.TargetHeaterCoolerState.HEAT;

      this.service.updateCharacteristic(
        Characteristic.TargetHeaterCoolerState,
        newState
      );

      // Temperatures
      this.service.updateCharacteristic(
        Characteristic.CurrentTemperature,
        this.device.CurrentTemperature
      );
      this.service.updateCharacteristic(
        Characteristic.HeatingThresholdTemperature,
        this.device.TargetTemperature
      );

      // Update mode switch
      this.modeSwitch.updateCharacteristic(
        Characteristic.On,
        this.device.Mode === 'Control individually'
      );

    } catch (err) {
      this.platform.log.warn(
        `[${this.device.Name}] Failed to update device: ${(err as Error).message}`
      );
    }
  }
}