import { Logger } from 'homebridge';
import fetch from 'whatwg-fetch';

export interface IDevice {
  ID: string;
  Name: string;
  Status: string;
  On: boolean;
  CurrentTemperature: number;
  TargetTemperature: number;
  CurrentPower: number;
  isHeating: boolean;
  setTargetTemperature: (value: number) => void;
  setOn: (value: boolean) => void;
  update: () => void;
}

const INDIVIDUAL_MODE = 'Control individually';

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
    return this._mode !== 'off';
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
    const statusRes = await this._get<StatusResponse>('status');
    this._mac = statusRes.mac_address ?? this._mac;
    this._status = statusRes.status ?? this._status;

    const controlRes = await this._get<ControlStatusResponse>('control-status');
    this._mode = controlRes.operation_mode ?? this._mode;
    this._currentTemperature = controlRes.ambient_temperature ?? this._currentTemperature;
    this._targetTemperature = controlRes.set_temperature ?? this._targetTemperature;
    this._currentPower = controlRes.current_power ?? this._currentPower;
  } catch (ex) {
    this.log.error(`Failed to fetch data from ${this._name}:`, ex instanceof Error ? ex.message : ex);
    // don’t throw → keep old values instead of failing completely
  }
}

  setTargetTemperature(target: number) {
    this._post<SimpleResponse>('set-temperature', {
      type: 'Normal',
      value: target,
    }).then(({ status }) => {
      if (status === 'ok') {
        // Optimistic update
        this._targetTemperature = target;
      }
    });
  }

  async setOn(on) {
    const targetMode = on ? INDIVIDUAL_MODE : 'off';
    await this._post<SimpleResponse>('operation-mode', {
      mode: targetMode,
    }).then(({ status }) => {
      if (status === 'ok') {
        this._mode = targetMode;
      }
    });

    await this.update();
  }

  _get<T>(command: string): Promise<T> {
    this.log.debug(`GET from http://${this._ip}/${command}`);
    return fetch(`http://${this._ip}/${command}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((res) => res.json() as Promise<T>);
  }

  _post<T>(command: string, data: Record<string, number | string>): Promise<T> {
    this.log.debug(`POST to http://${this._ip}/${command} with data: ${JSON.stringify(data)}`);
    return fetch(`http://${this._ip}/${command}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then((res) => res.json() as Promise<T>);
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
  version: string; //"0x231124",
  operation_key: string;
  mac_address: string;
  status: string;
};
