import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MillLocalPlatform } from './platform';
import { IDevice } from './device';

export class MillLocalPlatformAccessory {
  private heaterService: Service;
  private autoSwitchService: Service;

  constructor(
    private readonly platform: MillLocalPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly device: IDevice,
  ) {
    const { Characteristic, Service } = this.platform;

    // --- Accessory info ---
    this.accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Mill')
      .setCharacteristic(Characteristic.Model, 'Mill Heater Gen3 Panel')
      .setCharacteristic(Characteristic.SerialNumber, this.device.ID);

    // --- HeaterCooler service for manual control ---
    this.heaterService =
      this.accessory.getService(Service.HeaterCooler) ||
      this.accessory.addService(Service.HeaterCooler);

    this.heaterService.setCharacteristic(Characteristic.Name, this.device.Name);

    this.heaterService
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          Characteristic.TargetHeaterCoolerState.HEAT,
          Characteristic.TargetHeaterCoolerState.AUTO,
        ],
      });

    this.heaterService
      .getCharacteristic(Characteristic.Active)
      .onGet(this.handleGetActive.bind(this))
      .onSet(this.handleSetActive.bind(this));

    this.heaterService
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .onGet(this.handleGetTargetState.bind(this))
      .onSet(this.handleSetTargetState.bind(this));

    this.heaterService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.handleGetCurrentTemperature.bind(this));

    this.heaterService
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleGetTargetTemperature.bind(this))
      .onSet(this.handleSetTargetTemperature.bind(this));

    this.heaterService
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: 5,
        maxValue: 35,
        minStep: 0.5,
      });

    // --- Automatic / Weekly Program switch ---
    this.autoSwitchService =
      this.accessory.getServiceById(Service.Switch, 'autoMode') ||
      this.accessory.addService(Service.Switch, 'Automatic Mode', 'autoMode');

    this.autoSwitchService.setCharacteristic(Characteristic.Name, 'Automatic Mode');

    this.autoSwitchService
      .getCharacteristic(Characteristic.On)
      .onGet(() => this.device.Mode === 'SCHEDULED')
      .onSet(async (value: CharacteristicValue) => {
        const newMode = value ? 'SCHEDULED' : 'ON';
        this.platform.log.debug(`[${this.device.Name}] SET Automatic Mode → ${newMode}`);
        await this.device.setMode(newMode);
        // Update HeaterCooler UI
        this.updateFromDevice();
      });

    // --- Periodic update ---
    setInterval(() => this.updateFromDevice(), 30000);
  }

  // --- HeaterCooler handlers ---
  async handleGetActive(): Promise<CharacteristicValue> {
    return this.device.Mode !== 'OFF' ? 1 : 0;
  }

  async handleSetActive(value: CharacteristicValue) {
    const newMode = value === 1 ? 'ON' : 'OFF';
    await this.device.setMode(newMode);
  }

  async handleGetTargetState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;
    return this.device.Mode === 'SCHEDULED'
      ? Characteristic.TargetHeaterCoolerState.AUTO
      : Characteristic.TargetHeaterCoolerState.HEAT;
  }

  async handleSetTargetState(value: CharacteristicValue) {
    const { Characteristic } = this.platform;
    const newMode = value === Characteristic.TargetHeaterCoolerState.AUTO ? 'SCHEDULED' : 'ON';
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

  // --- Periodic sync ---
  private async updateFromDevice() {
    try {
      await this.device.update();
      const { Characteristic } = this.platform;

      // HeaterCooler UI
      this.heaterService.updateCharacteristic(
        Characteristic.Active,
        this.device.Mode !== 'OFF' ? 1 : 0,
      );
      this.heaterService.updateCharacteristic(
        Characteristic.TargetHeaterCoolerState,
        this.device.Mode === 'SCHEDULED'
          ? Characteristic.TargetHeaterCoolerState.AUTO
          : Characteristic.TargetHeaterCoolerState.HEAT,
      );
      this.heaterService.updateCharacteristic(
        Characteristic.CurrentTemperature,
        this.device.CurrentTemperature,
      );
      this.heaterService.updateCharacteristic(
        Characteristic.HeatingThresholdTemperature,
        this.device.TargetTemperature,
      );

      // Automatic Mode switch
      this.autoSwitchService.updateCharacteristic(
        Characteristic.On,
        this.device.Mode === 'SCHEDULED',
      );
    } catch (err) {
      this.platform.log.warn(`[${this.device.Name}] Failed to update: ${(err as Error).message}`);
    }
  }
}