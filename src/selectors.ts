import {
    NotebookPanel, Notebook
} from '@jupyterlab/notebook';

import {
    Cell // ICellModel
} from '@jupyterlab/cells';

import {
    Message
} from '@phosphor/messaging';

import {
    Widget
} from '@phosphor/widgets';


import {
    Styling
} from '@jupyterlab/apputils';

import {
    NotebookInfo
} from "./manager"


const TOOLBAR_LANGUAGE_DROPDOWN_CLASS = 'jp-NotebooklanguageDropDown';
const CELL_LANGUAGE_DROPDOWN_CLASS = 'jp-CelllanguageDropDown';

export class DefaultLanguageSwitcher extends Widget {
    constructor(widget: Notebook, info: NotebookInfo) {
        super({ node: createLanguageSwitcher(info.KernelList) });
        this.addClass(TOOLBAR_LANGUAGE_DROPDOWN_CLASS);
        this.addClass('sos-widget')

        this._select = this.node.firstChild as HTMLSelectElement;
        Styling.wrapSelect(this._select);
        this._info = info;
    }

    public update_selector(languages: Array<string>): void {
        for (let lan of languages) {
            // ignore if already exists
            if (this._select.options.namedItem(lan))
                continue;
            let option = document.createElement('option');
            option.value = lan;
            option.id = lan;
            option.textContent = lan;
            this._select.appendChild(option);
        }
    }
    /**
     * Handle the DOM events for the widget.
     *
     * @param event - The DOM event sent to the widget.
     */
    handleEvent(event: Event): void {
        if (event.type === 'change') {
            this._info.defaultKernel = (event.target as HTMLOptionElement).value;
        }
    }

    /**
     * Handle `after-attach` messages for the widget.
     */
    protected onAfterAttach(msg: Message): void {
        this._select.addEventListener('change', this);
    }

    /**
     * Handle `before-detach` messages for the widget.
     */
    protected onBeforeDetach(msg: Message): void {
        this._select.removeEventListener('change', this);
    }

    private _select: HTMLSelectElement = null;
    private _info: NotebookInfo = null;
}


/**
 * Create the node for the cell type switcher.
 */
function createLanguageSwitcher(languages): HTMLElement {
    let div = document.createElement('div');
    let select = document.createElement('select');
    for (let lan of languages) {
        let option = document.createElement('option');
        option.value = lan;
        option.id = lan;
        option.textContent = lan;
        select.appendChild(option);
    }
    select.className = TOOLBAR_LANGUAGE_DROPDOWN_CLASS + " sos-widget";
    select.value = 'SoS';
    //select.selectedIndex = languages.indexOf('SoS');
    div.appendChild(select);
    return div;
}


export function changeStyleOnKernel(cell: Cell, kernel: string, info: NotebookInfo) {
    // Note: JupyterLab does not yet support tags
    if (cell.model.metadata.get('tags') && (cell.model.metadata.get('tags') as Array<string>).indexOf("report_output") >= 0) {
        let op = cell.node.getElementsByClassName('jp-Cell-outputWrapper') as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < op.length; ++i)
            op.item(i).classList.add('report-output');
    } else {
        let op = cell.node.getElementsByClassName('jp-Cell-outputWrapper') as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < op.length; ++i)
            op.item(i).classList.remove('report-output');
    }

    // cell in panel does not have prompt area
    var col = "";
    if (kernel && info.BackgroundColor[kernel]) {
        col = info.BackgroundColor[kernel];
    }
    let prompt = cell.node.getElementsByClassName("jp-InputPrompt") as HTMLCollectionOf<HTMLElement>;
    if (prompt.length > 0)
        prompt[0].style.backgroundColor = col;
    prompt = cell.node.getElementsByClassName("jp-OutputPrompt") as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < prompt.length; ++i) {
        prompt.item(i).style.backgroundColor = col;
    }
    // cell.user_highlight = {
    //     name: 'sos',
    //     base_mode: info.LanguageName[kernel] || info.KernelName[kernel] || kernel,
    // };
    // //console.log(`Set cell code mirror mode to ${cell.user_highlight.base_mode}`)
    // cell.code_mirror.setOption('mode', cell.user_highlight);
    let nodes = cell.node.getElementsByClassName(CELL_LANGUAGE_DROPDOWN_CLASS) as HTMLCollectionOf<HTMLElement>;
    if (nodes.length === 0) {
        // if there is no selector, create one
        let select = document.createElement('select');
        for (let lan of info.KernelList) {
            let option = document.createElement('option');
            option.value = lan;
            option.id = lan;
            option.textContent = lan;
            select.appendChild(option);
        }
        select.className = CELL_LANGUAGE_DROPDOWN_CLASS + " sos-widget";
        let editor = cell.node.getElementsByClassName("jp-InputArea-editor")[0];
        editor.insertBefore(select, editor.children[0]);
        select.value = kernel ? kernel : 'SoS';
        select.addEventListener('change', function(evt) {
            cell.model.metadata.set('kernel', (evt.target as HTMLOptionElement).value);
            changeStyleOnKernel(cell, (evt.target as HTMLOptionElement).value, info);
        });

    } else {
        // use the existing dropdown box
        let select = nodes.item(0) as HTMLSelectElement;
        // update existing
        for (let lan of info.KernelList) {
            // ignore if already exists
            if (select.options.namedItem(lan))
                continue;
            let option = document.createElement('option');
            option.value = lan;
            option.id = lan;
            option.textContent = lan;
            select.appendChild(option);
        }
        select.value = kernel ? kernel : 'SoS';
    }

    //
    // select.change(function() {
    //     let value = (<HTMLInputElement>(this)).value;
    //     cell.model.metadata.set('kernel', info.DisplayName[value]);
    //     // cell in panel does not have prompt area
    //     var ip = cell.node.getElementsByClassName("input_prompt") as HTMLCollectionOf<HTMLElement>;
    //     var op = cell.node.getElementsByClassName("out_prompt_overlay") as HTMLCollectionOf<HTMLElement>;
    //     if (info.BackgroundColor[value]) {
    //         ip[0].style.backgroundColor = info.BackgroundColor[value];
    //         op[0].style.backgroundColor = info.BackgroundColor[value];
    //     } else {
    //         // Use "" to remove background-color?
    //         ip[0].style.backgroundColor = "";
    //         op[0].style.backgroundColor = "";
    //     }

}

export function updateCellStyles(panel: NotebookPanel, info: NotebookInfo) {
    var cells = panel.notebook.widgets;

    // setting up background color and selection according to notebook metadata
    for (let i = 0; i < cells.length; ++i) {
        if (cells[i].model.type === "code") {
            changeStyleOnKernel(cells[i], cells[i].model.metadata.get('kernel') as string, info);
        }
    }

    // $("[id^=status_]").removeAttr("onClick").removeAttr("onmouseover").removeAttr("onmouseleave");
    // var tasks = $("[id^=status_]");
    // info.unknown_tasks = [];
    // for (i = 0; i < tasks.length; ++i) {
    //     // status_localhost_5ea9232779ca1959
    //     if (tasks[i].id.match("^status_[^_]+_[0-9a-f]{16,32}$")) {
    //         tasks[i].className = "fa fa-fw fa-2x fa-refresh fa-spin";
    //         info.unknown_tasks.push(tasks[i].id);
    //     }
    // }
}
