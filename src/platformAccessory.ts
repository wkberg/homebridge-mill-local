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
      
      // --- Additional Mode Switch ---
const modeSwitchName = `${this.device.Name} Mode`;
const modeSwitch =
  this.accessory.getService(modeSwitchName) ||
  this.accessory.addService(this.platform.Service.Switch, modeSwitchName);

modeSwitch
  .getCharacteristic(this.platform.Characteristic.On)
  .onGet(() => this.device.Mode === 'ON')
  .onSet(async (value: CharacteristicValue) => {
    let newMode: 'ON' | 'SCHEDULED';
    newMode = value ? 'ON' : 'SCHEDULED';
    this.platform.log.debug(`[${this.device.Name}] Mode Switch → ${newMode}`);
    await this.device.setMode(newMode);
  });

    // --- Characteristic Handlers ---

    // Current heater state (off/on)
    this.service
      .getCharacteristic(Characteristic.Active)
      .onGet(this.handleGetActive.bind(this))
      .onSet(this.handleSetActive.bind(this));

    // Target state (ON = HEAT, SCHEDULED = AUTO)
    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .onGet(this.handleGetTargetState.bind(this))
      .onSet(this.handleSetTargetState.bind(this));

    // Current temperature
    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.handleGetCurrentTemperature.bind(this));

    // Target temperature
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleGetTargetTemperature.bind(this))
      .onSet(this.handleSetTargetTemperature.bind(this));

    // Set supported temperature range
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: 5,
        maxValue: 35,
        minStep: 0.5,
      });

    // Periodically update
    setInterval(() => this.updateFromDevice(), 30000);
  }

  //
  // 🔥 Characteristic handlers
  //

  async handleGetActive(): Promise<CharacteristicValue> {
    const active = this.device.Mode !== 'OFF';
    this.platform.log.debug(`[${this.device.Name}] GET Active = ${active}`);
    return active ? 1 : 0; // 1 = Active, 0 = Inactive
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
        // Off is represented by Active = 0, so just mirror that.
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

  async handleGetCurrentTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.Name}] GET CurrentTemperature = ${this.device.CurrentTemperature}`);
    return this.device.CurrentTemperature;
  }

  async handleGetTargetTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug(`[${this.device.Name}] GET TargetTemperature = ${this.device.TargetTemperature}`);
    return this.device.TargetTemperature;
  }

  async handleSetTargetTemperature(value: CharacteristicValue) {
    const temp = value as number;
    this.platform.log.debug(`[${this.device.Name}] SET TargetTemperature → ${temp}`);
    await this.device.setTargetTemperature(temp);
  }

  //
  // 🔁 Periodic sync from device
  //
  private async updateFromDevice() {
    try {
      await this.device.update();

      const { Characteristic } = this.platform;

      // Update Active status
      this.service.updateCharacteristic(
        Characteristic.Active,
        this.device.Mode !== 'OFF' ? 1 : 0,
      );
      
      // Update Mode Switch
const modeSwitchService = this.accessory.getService(`${this.device.Name} Mode`);
if (modeSwitchService) {
  modeSwitchService.updateCharacteristic(
    this.platform.Characteristic.On,
    this.device.Mode === 'ON' ? true : false
  );
}

      // Update Target State
      const newState =
        this.device.Mode === 'SCHEDULED'
          ? Characteristic.TargetHeaterCoolerState.AUTO
          : Characteristic.TargetHeaterCoolerState.HEAT;

      this.service.updateCharacteristic(
        Characteristic.TargetHeaterCoolerState,
        newState,
      );

      // Update Temperatures
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