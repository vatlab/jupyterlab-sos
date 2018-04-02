import {
    NotebookPanel
} from '@jupyterlab/notebook';

export class NotebookInfo {
    notebook: NotebookPanel;
    KernelList: Array<Array<string>>;

    BackgroundColor: Map<string, string>;
    DisplayName: Map<string, string>;
    KernelName: Map<string, string>;
    LanguageName: Map<string, string>;
    KernelOptions: Map<string, string>;

    constructor(notebook) {
        this.notebook = notebook;
        this.KernelList = [];

        this.BackgroundColor = new Map<string, string>();
        this.DisplayName = new Map<string, string>();
        this.KernelName = new Map<string, string>();
        this.LanguageName = new Map<string, string>();
        this.KernelOptions = new Map<string, string>();
    }

    add_language(data: Array<Array<string>>) {
        // fill the look up tables with language list passed from the kernel
        for (let i = 0; i < data.length; i++) {
            // BackgroundColor is color
            this.BackgroundColor[data[i][0]] = data[i][3];
            this.BackgroundColor[data[i][1]] = data[i][3];
            // DisplayName
            this.DisplayName[data[i][0]] = data[i][0];
            this.DisplayName[data[i][1]] = data[i][0];
            // Name
            this.KernelName[data[i][0]] = data[i][1];
            this.KernelName[data[i][1]] = data[i][1];
            // LanguageName
            this.LanguageName[data[i][0]] = data[i][2];
            this.LanguageName[data[i][1]] = data[i][2];
            // KernelList, use displayed name
            this.KernelList.push([data[i][0], data[i][0]]);
        }
    }

    update_language(data: Array<Array<string>>) {
        for (let i = 0; i < data.length; i++) {
            // BackgroundColor is color
            this.BackgroundColor[data[i][0]] = data[i][3];
            // by kernel name? For compatibility ...
            if (!(data[i][1] in this.BackgroundColor)) {
                this.BackgroundColor[data[i][1]] = data[i][3];
            }
            // DisplayName
            this.DisplayName[data[i][0]] = data[i][0];
            if (!(data[i][1] in this.DisplayName)) {
                this.DisplayName[data[i][1]] = data[i][0];
            }
            // Name
            this.KernelName[data[i][0]] = data[i][1];
            if (!(data[i][1] in this.KernelName)) {
                this.KernelName[data[i][1]] = data[i][1];
            }
            // Language Name
            this.LanguageName[data[i][0]] = data[i][2];
            if (!(data[i][2] in this.LanguageName)) {
                this.LanguageName[data[i][2]] = data[i][2];
            }
            // KernelList, use displayed name
            if (this.KernelList.findIndex((item) => item[0] === data[i][0]) === -1) {
                this.KernelList.push([data[i][0], data[i][0]]);
            }
            // if options ...
            if (data[i].length > 4) {
                this.KernelOptions[data[i][0]] = data[i][4];
            }
        }
    }

    public show() {
        console.log(this.KernelList);
    }
}

export class Manager {
    // global registry for notebook info
    private static _instance: Manager;

    private _comms: Map<string, NotebookPanel>;
    private _info: Map<NotebookPanel, NotebookInfo>;

    private constructor() {
        if (!this._info) {
            this._info = new Map<NotebookPanel, NotebookInfo>();
            this._comms = new Map<string, NotebookPanel>();
        }
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
            console.log("Creating a new notebook info")
            this._info.set(notebook, new NotebookInfo(notebook));
        }
        return this._info.get(notebook);
    }

    public register_comm(comm_id: string, notebook: NotebookPanel) {
        if (!this._comms.has(comm_id)) {
            this._comms.set(comm_id, notebook);
        }
    }

    // this is the same as get_info,
    public notebook_of_comm(comm_id: string): NotebookPanel {
        return this._comms.get(comm_id);
    }
}
