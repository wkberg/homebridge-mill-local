import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MillLocalPlatform } from './platform';
import { IDevice } from './device';

export class MillLocalPlatformAccessory {
  private service: Service;

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

    // Use HeaterCooler service but only for heating
    this.service =
      this.accessory.getService(Service.HeaterCooler) ||
      this.accessory.addService(Service.HeaterCooler);

    this.service.setCharacteristic(Characteristic.Name, this.device.Name);

    // Restrict to only HEAT + AUTO (no COOL)
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
      .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .onGet(this.handleGetCurrentHeaterCoolerState.bind(this));

    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({ minValue: 5, maxValue: 35, minStep: 0.5 });

    // Periodically update
    setInterval(() => this.updateFromDevice(), 30000);
  }

  // 🔥 Characteristic Handlers
  async handleGetActive(): Promise<CharacteristicValue> {
    return this.device.Mode !== 'OFF' ? 1 : 0;
  }

  async handleSetActive(value: CharacteristicValue) {
    const isActive = value === 1;

    if (!isActive) {
      await this.device.setMode('OFF');
      this.platform.log.debug(`[${this.device.Name}] SET Active → OFF`);
    } else {
      // Do nothing: turning Active on should not force Scheduled/Manual
      this.platform.log.debug(`[${this.device.Name}] Active turned ON — keep current mode`);
    }
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
    let newMode: 'ON' | 'SCHEDULED' | 'OFF';

    switch (value) {
      case Characteristic.TargetHeaterCoolerState.HEAT:
        newMode = 'ON';
        break;
      case Characteristic.TargetHeaterCoolerState.AUTO:
        newMode = 'SCHEDULED';
        break;
      default:
        newMode = 'OFF';
    }

    this.platform.log.debug(`[${this.device.Name}] SET TargetState → ${newMode}`);
    await this.device.setMode(newMode);
  }

  async handleGetCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
    const { Characteristic } = this.platform;

    switch (this.device.Mode) {
      case 'ON':
        return Characteristic.CurrentHeaterCoolerState.HEATING;
      case 'SCHEDULED':
        return Characteristic.CurrentHeaterCoolerState.IDLE;
      case 'OFF':
      default:
        return Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  async handleGetCurrentTemperature(): Promise<CharacteristicValue> {
    return this.device.CurrentTemperature;
  }

  async handleGetTargetTemperature(): Promise<CharacteristicValue> {
    return this.device.TargetTemperature;
  }

  async handleSetTargetTemperature(value: CharacteristicValue) {
    const temp = value as number;
    await this.device.setTargetTemperature(temp);
  }

  // 🔁 Periodic sync from device
  private async updateFromDevice() {
    try {
      await this.device.update();
      const { Characteristic } = this.platform;

      this.service.updateCharacteristic(
        Characteristic.Active,
        this.device.Mode !== 'OFF' ? 1 : 0,
      );

      const newTargetState =
        this.device.Mode === 'SCHEDULED'
          ? Characteristic.TargetHeaterCoolerState.AUTO
          : Characteristic.TargetHeaterCoolerState.HEAT;

      this.service.updateCharacteristic(
        Characteristic.TargetHeaterCoolerState,
        newTargetState,
      );

      this.service.updateCharacteristic(
        Characteristic.CurrentHeaterCoolerState,
        await this.handleGetCurrentHeaterCoolerState(),
      );

      this.service.updateCharacteristic(
        Characteristic.CurrentTemperature,
        this.device.CurrentTemperature,
      );

      this.service.updateCharacteristic(
        Characteristic.HeatingThresholdTemperature,
        this.device.TargetTemperature,
      );
    } catch (err) {
      this.platform.log.warn(
        `[${this.device.Name}] Failed to update device: ${(err as Error).message}`,
      );
    }
  }
}