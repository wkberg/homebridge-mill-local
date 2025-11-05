import { Logger } from 'homebridge';

export interface IDevice {
  ID: string;
  Name: string;
  Status: string;
  On: boolean;
  CurrentTemperature: number;
  TargetTemperature: number;
  CurrentPower: number;
  isHeating: boolean;
  Mode: 'ON' | 'SCHEDULED' | 'OFF';
  setMode: (mode: 'ON' | 'SCHEDULED' | 'OFF') => Promise<void>;
  setTargetTemperature: (value: number) => void;
  update: () => Promise<void>;
}

const INDIVIDUAL_MODE = 'Control individually';
const SCHEDULED_MODE = 'Weekly program';
const OFF_MODE = 'off';

export default class MillDevice implements IDevice {
  private _mac = '';
  private _status = 'unknown';
  private _mode = 'unknown';
  private _currentTemperature = 0;
  private _targetTemperature = 0;
  private _currentPower = 0;

  get ID() {
    return this._mac;
  }

  get Name() {
    return this._name;
  }

  get Status() {
    return this._status;
  }

  get On() {
    return this._mode !== OFF_MODE;
  }

  get CurrentTemperature() {
    return this._currentTemperature;
  }

  get TargetTemperature() {
    return this._targetTemperature;
  }

  get CurrentPower() {
    return this._currentPower;
  }

  get isHeating() {
    return this._currentPower > 0;
  }

  get Mode(): 'ON' | 'SCHEDULED' | 'OFF' {
    switch (this._mode) {
      case INDIVIDUAL_MODE:
        return 'ON';
      case SCHEDULED_MODE:
        return 'SCHEDULED';
      case OFF_MODE:
      default:
        return 'OFF';
    }
  }

  constructor(
    private readonly _name: string,
    private readonly _ip: string,
    private readonly log: Logger,
  ) {
    this.log.info(`Setting up device ${this._name}`);
  }

  async init() {
    await this.update();
  }

  async update() {
    try {
      this.log.debug(`[${this._name}] Updating device data...`);

      const statusRes = await this._get<StatusResponse>('status');
      if (statusRes) {
        this._mac = statusRes.mac_address ?? this._mac;
        this._status = statusRes.status ?? this._status;
      }

      const controlRes = await this._get<ControlStatusResponse>('control-status');
      if (controlRes) {
        this._mode = controlRes.operation_mode ?? this._mode;
        this._currentTemperature = controlRes.ambient_temperature ?? this._currentTemperature;
        this._targetTemperature = controlRes.set_temperature ?? this._targetTemperature;
        this._currentPower = controlRes.current_power ?? this._currentPower;
      }

      this.log.debug(`[${this._name}] Updated mode=${this._mode}, temp=${this._currentTemperature}°C, target=${this._targetTemperature}°C, power=${this._currentPower}W`);
    } catch (ex: any) {
      this.log.error(`Failed to fetch data from ${this._name}: ${ex?.message ?? ex}`);
      // Do not throw — keep last known values
    }
  }

  async setTargetTemperature(target: number) {
    this.log.debug(`[${this._name}] Setting target temperature to ${target}°C`);

    try {
      const res = await this._post<SimpleResponse>('set-temperature', {
        type: 'Normal',
        value: target,
      });

      if (res.status === 'ok') {
        this._targetTemperature = target;
      }
    } catch (ex: any) {
      this.log.error(`[${this._name}] Failed to set target temperature: ${ex?.message ?? ex}`);
    }
  }

  async setMode(mode: 'ON' | 'SCHEDULED' | 'OFF') {
    let targetMode: string;

    switch (mode) {
      case 'ON':
        targetMode = INDIVIDUAL_MODE;
        break;
      case 'SCHEDULED':
        targetMode = SCHEDULED_MODE;
        break;
      case 'OFF':
      default:
        targetMode = OFF_MODE;
        break;
    }

    this.log.debug(`[${this._name}] Setting mode to ${mode} (${targetMode})`);

    try {
      const res = await this._post<SimpleResponse>('operation-mode', { mode: targetMode });

      if (res.status === 'ok') {
        this._mode = targetMode;
        this.log.info(`[${this._name}] Mode successfully set to ${mode}`);
      } else {
        this.log.warn(`[${this._name}] Failed to change mode, response: ${res.status}`);
      }
    } catch (ex: any) {
      this.log.error(`[${this._name}] Failed to set mode ${mode}: ${ex?.message ?? ex}`);
    }

    // Refresh after mode change
    try {
      await this.update();
    } catch {
      this.log.warn(`[${this._name}] Skipped refresh after mode change (fetch failed)`);
    }
  }

  /** HTTP Helpers */
  private async _get<T>(command: string): Promise<T> {
    this.log.debug(`[${this._name}] GET http://${this._ip}/${command}`);
    const response = await fetch(`http://${this._ip}/${command}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private async _post<T>(command: string, data: Record<string, number | string>): Promise<T> {
    this.log.debug(`[${this._name}] POST http://${this._ip}/${command} data=${JSON.stringify(data)}`);

    const response = await fetch(`http://${this._ip}/${command}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}

/** Response types */
type SimpleResponse = {
  status: string;
};
type ControlStatusResponse = {
  ambient_temperature: number;
  current_power: number;
  control_signal: number;
  lock_active: string;
  open_window_active_now: string;
  raw_ambient_temperature: number;
  set_temperature: number;
  switched_on: boolean;
  connected_to_cloud: boolean;
  operation_mode: string;
  status: string;
};
type StatusResponse = {
  name: string;
  custom_name: string;
  version: string;
  operation_key: string;
  mac_address: string;
  status: string;
};