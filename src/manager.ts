import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';

import { CommandRegistry } from '@lumino/commands';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { Kernel } from '@jupyterlab/services';

interface ISosMetadata {
  version: string;
  kernels: Array<[string, string, string, string, any?, string?]>;
}

interface INotebookState {
  autoResume: boolean;
  pendingCells: Map<any, any>;
}

class NotebookRuntimeState implements INotebookState {
  autoResume: boolean;
  pendingCells: Map<any, any>;
  sos_comm: Kernel.IComm | null;

  constructor() {
    this.autoResume = false;
    this.pendingCells = new Map<any, any>();
    this.sos_comm = null;
  }

  reset(): void {
    this.autoResume = false;
    this.pendingCells.clear();
    this.sos_comm = null;
  }
}

//
export class NotebookInfo {
  notebook: NotebookPanel;
  KernelList: Array<string>;

  // Language mapping data (persistent)
  BackgroundColor: Map<string, string>;
  DisplayName: Map<string, string>;
  KernelName: Map<string, string>;
  LanguageName: Map<string, string>;
  CodeMirrorMode: Map<string, any>;
  KernelOptions: Map<string, string>;

  // Runtime state (non-persistent)
  private runtimeState: NotebookRuntimeState;

  private static readonly METADATA_VERSION = '1.0';
  private static readonly DEFAULT_KERNEL_DATA: Array<
    [string, string, string, string]
  > = [['SoS', 'sos', '', '']];
  /** create an info object from metadata of the notebook
   */
  constructor(notebook: NotebookPanel) {
    this.notebook = notebook;
    this.KernelList = new Array<string>();
    this.runtimeState = new NotebookRuntimeState();

    this.BackgroundColor = new Map<string, string>();
    this.DisplayName = new Map<string, string>();
    this.KernelName = new Map<string, string>();
    this.LanguageName = new Map<string, string>();
    this.KernelOptions = new Map<string, any>();
    this.CodeMirrorMode = new Map<string, any>();

    const metadata = this.getVersionedMetadata();
    this.initializeFromKernelData(metadata.kernels);
  }

  // Getters for backward compatibility
  get autoResume(): boolean {
    return this.runtimeState.autoResume;
  }

  set autoResume(value: boolean) {
    this.runtimeState.autoResume = value;
  }

  get pendingCells(): Map<any, any> {
    return this.runtimeState.pendingCells;
  }

  get sos_comm(): Kernel.IComm | null {
    return this.runtimeState.sos_comm;
  }

  set sos_comm(comm: Kernel.IComm | null) {
    this.runtimeState.sos_comm = comm;
  }

  resetRuntimeState(): void {
    this.runtimeState.reset();
  }

  private validateMetadata(metadata: any): metadata is ISosMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    if (!Array.isArray(metadata.kernels)) {
      return false;
    }

    return metadata.kernels.every(
      (item: any) =>
        Array.isArray(item) &&
        item.length >= 4 &&
        typeof item[0] === 'string' &&
        typeof item[1] === 'string' &&
        typeof item[2] === 'string' &&
        typeof item[3] === 'string'
    );
  }

  private getVersionedMetadata(): ISosMetadata {
    const rawMetadata = this.notebook.model.getMetadata('sos') as any;

    if (!rawMetadata) {
      return {
        version: NotebookInfo.METADATA_VERSION,
        kernels: NotebookInfo.DEFAULT_KERNEL_DATA
      };
    }

    if (this.validateMetadata(rawMetadata)) {
      return {
        version: rawMetadata.version || NotebookInfo.METADATA_VERSION,
        kernels: rawMetadata.kernels
      };
    }

    // Legacy format support
    if (Array.isArray(rawMetadata.kernels)) {
      console.warn('Converting legacy SoS metadata format');
      return {
        version: NotebookInfo.METADATA_VERSION,
        kernels: rawMetadata.kernels
      };
    }

    console.error('Invalid SoS metadata format, using defaults');
    return {
      version: NotebookInfo.METADATA_VERSION,
      kernels: NotebookInfo.DEFAULT_KERNEL_DATA
    };
  }

  private initializeFromKernelData(
    data: Array<[string, string, string, string, any?, string?]>
  ): void {
    for (let i = 0; i < data.length; i++) {
      // BackgroundColor is color
      this.BackgroundColor.set(data[i][0], data[i][3]);
      // by kernel name? For compatibility ...
      if (!this.BackgroundColor.has(data[i][1])) {
        this.BackgroundColor.set(data[i][1], data[i][3]);
      }
      // DisplayName
      this.DisplayName.set(data[i][0], data[i][0]);
      if (!this.DisplayName.has(data[i][1])) {
        this.DisplayName.set(data[i][1], data[i][0]);
      }
      // Name
      this.KernelName.set(data[i][0], data[i][1]);
      if (!this.KernelName.has(data[i][1])) {
        this.KernelName.set(data[i][1], data[i][1]);
      }
      // LanguageName
      this.LanguageName.set(data[i][0], data[i][2]);
      if (!this.LanguageName.has(data[i][2])) {
        this.LanguageName.set(data[i][2], data[i][2]);
      }

      // if codemirror mode ...
      if (data[i].length >= 5 && data[i][4]) {
        this.CodeMirrorMode.set(data[i][0], data[i][4]);
      }

      // if options ...
      if (data[i].length >= 6 && data[i][5]) {
        this.KernelOptions.set(data[i][0], data[i][5]);
      }

      if (this.KernelList.indexOf(data[i][0]) === -1) {
        this.KernelList.push(data[i][0]);
      }
    }
  }

  saveMetadata(): void {
    const kernelData: Array<[string, string, string, string, any?, string?]> =
      [];

    for (const kernel of this.KernelList) {
      const entry: [string, string, string, string, any?, string?] = [
        kernel,
        this.KernelName.get(kernel) || kernel,
        this.LanguageName.get(kernel) || '',
        this.BackgroundColor.get(kernel) || ''
      ];

      const mode = this.CodeMirrorMode.get(kernel);
      if (mode) {
        entry.push(mode);
      }

      const options = this.KernelOptions.get(kernel);
      if (options) {
        if (!mode) {
          entry.push(undefined);
        }
        entry.push(options);
      }

      kernelData.push(entry);
    }

    const metadata: ISosMetadata = {
      version: NotebookInfo.METADATA_VERSION,
      kernels: kernelData
    };

    this.notebook.model.setMetadata('sos', metadata);
  }

  updateLanguages(data: Array<Array<string>>) {
    // Convert Array<Array<string>> to the expected format
    const kernelData: Array<[string, string, string, string, any?, string?]> =
      data.map(item => {
        const result: [string, string, string, string, any?, string?] = [
          item[0] || '',
          item[1] || '',
          item[2] || '',
          item[3] || ''
        ];
        if (item.length > 4 && item[4]) {
          result[4] = item[4];
        }
        if (item.length > 5 && item[5]) {
          result[5] = item[5];
        }
        return result;
      });

    this.initializeFromKernelData(kernelData);
    this.saveMetadata();
    this.updateCSS();
  }

  public updateCSS(): void {
    const css_text = this.KernelList.map((lan: string) => {
      if (this.BackgroundColor.get(lan)) {
        const css_name = safe_css_name(`sos_lan_${lan}`);
        return `.jp-CodeCell.${css_name} .jp-InputPrompt,
            .jp-CodeCell.${css_name} .jp-OutputPrompt {
              background: ${this.BackgroundColor.get(lan)};
            }
          `;
      } else {
        return null;
      }
    })
      .filter(Boolean)
      .join('\n');
    const css = document.createElement('style');
    css.innerHTML = css_text;
    document.body.appendChild(css);
  }

  public show() {
    console.log(this.KernelList);
  }
}

export function safe_css_name(name) {
  return name.replace(/[^a-z0-9_]/g, s => {
    const c = s.charCodeAt(0);
    if (c === 32) {
      return '-';
    }
    if (c >= 65 && c <= 90) {
      return '_' + s.toLowerCase();
    }
    return '__' + ('000' + c.toString(16)).slice(-4);
  });
}

export class Manager {
  // global registry for notebook info
  private static _instance: Manager;
  // used to track the current notebook widget
  private static _notebook_tracker: INotebookTracker;
  private static _console_tracker: IConsoleTracker;
  private static _commands: CommandRegistry;
  private _info: Map<NotebookPanel, NotebookInfo>;
  private _settings: ISettingRegistry.ISettings;

  private constructor() {
    if (!this._info) {
      this._info = new Map<NotebookPanel, NotebookInfo>();
    }
  }

  public static set_trackers(
    notebook_tracker: INotebookTracker,
    console_tracker: IConsoleTracker
  ) {
    this._notebook_tracker = notebook_tracker;
    this._console_tracker = console_tracker;
  }

  public static set_commands(commands: CommandRegistry) {
    this._commands = commands;
  }

  static get currentNotebook() {
    return this._notebook_tracker.currentWidget;
  }

  public static consolesOfNotebook(panel: NotebookPanel): Array<ConsolePanel> {
    return this._console_tracker.filter(value => {
      return value.console.sessionContext.path === panel.context.path;
    });
  }

  static get currentConsole(): ConsolePanel {
    return this._console_tracker.currentWidget;
  }

  static get commands() {
    return this._commands;
  }

  static get manager() {
    if (this._instance === null || this._instance === undefined) {
      this._instance = new Manager();
    }
    return this._instance;
  }

  // register notebook info to the global registry
  public get_info(notebook: NotebookPanel): NotebookInfo {
    if (!this._info.has(notebook)) {
      console.log('Creating a new notebook info');
      this._info.set(notebook, new NotebookInfo(notebook));
    }
    return this._info.get(notebook);
  }

  public register_comm(comm: Kernel.IComm, notebook: NotebookPanel) {
    this.get_info(notebook).sos_comm = comm;
  }

  // this is the same as get_info,
  public notebook_of_comm(comm_id: string): NotebookPanel {
    for (const [panel, info] of Array.from(this._info.entries())) {
      if (info.sos_comm && info.sos_comm.commId === comm_id) {
        return panel;
      }
    }
  }

  public update_config(settings: ISettingRegistry.ISettings): void {
    this._settings = settings;
  }

  public get_config(key: string): any {
    // sos.kernel_codemirror_mode
    return this._settings.get(key).composite;
  }
}
