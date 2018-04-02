


import {
    NotebookPanel
} from '@jupyterlab/notebook';

import {
    Cell // ICellModel
} from '@jupyterlab/cells';

import { Manager, NotebookInfo } from "./manager"

function changeStyleOnKernel(cell: Cell, type: any, info: NotebookInfo) {
    // type should be  displayed name of kernel
    // var sel = cell.element[0].getElementsByClassName("cell_kernel_selector")[0];
    // if (!type) {
    //     sel.selectedIndex = -1;
    // } else {
    //     var opts = sel.options;
    //     var opt, j;
    //     for (j = 0; opt = opts[j]; j++) {
    //         if (opt.value === info.DisplayName[type]) {
    //             sel.selectedIndex = j;
    //             break;
    //         }
    //     }
    // }

    // if (cell.metadata.tags && cell.metadata.tags.indexOf("report_output") >= 0) {
    //     $(".output_wrapper", cell.element).addClass("report_output");
    // } else {
    //     $(".output_wrapper", cell.element).removeClass("report_output");
    // }

    // cell in panel does not have prompt area
    var col = "";

    if (type === "sos") {
        col = "#F0F0F0";
    } else if (type && info.BackgroundColor[type]) {
        col = info.BackgroundColor[type];
    }
    // var ip = cell.element[0].getElementsByClassName("input_prompt");
    // var op = cell.element[0].getElementsByClassName("out_prompt_overlay");
    // if (ip.length > 0) {
    //     ip[0].style.backgroundColor = col;
    // }
    // if (op.length > 0) {
    //     op[0].style.backgroundColor = col;
    // }
    let prompt = cell.node.getElementsByClassName("jp-InputPrompt") as HTMLCollectionOf<HTMLElement>;
    if (prompt)
        prompt[0].style.backgroundColor = col;

    // cell.user_highlight = {
    //     name: 'sos',
    //     base_mode: info.LanguageName[type] || info.KernelName[type] || type,
    // };
    // //console.log(`Set cell code mirror mode to ${cell.user_highlight.base_mode}`)
    // cell.code_mirror.setOption('mode', cell.user_highlight);

}

export function updateCellStyles(panel: NotebookPanel) {
    var cells = panel.notebook.widgets;
    debugger;
    let info = Manager.manager.get_info(panel);
    // setting up background color and selection according to notebook metadata
    for (let i = 0; i < cells.length; ++i) {
        if (cells[i].model.type === "code") {
            changeStyleOnKernel(cells[i], cells[i].model.metadata.get('kernel'), info);
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
