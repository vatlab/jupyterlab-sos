


import {
    NotebookPanel
} from '@jupyterlab/notebook';

import {
    Cell // ICellModel
} from '@jupyterlab/cells';

import { Manager, NotebookInfo } from "./manager"
import * as $ from "jquery";

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
    if (prompt.length > 0)
        prompt[0].style.backgroundColor = col;
    prompt = cell.node.getElementsByClassName("jp-OutputPrompt") as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < prompt.length; ++i) {
        prompt[i].style.backgroundColor = col;
    }
    // cell.user_highlight = {
    //     name: 'sos',
    //     base_mode: info.LanguageName[type] || info.KernelName[type] || type,
    // };
    // //console.log(`Set cell code mirror mode to ${cell.user_highlight.base_mode}`)
    // cell.code_mirror.setOption('mode', cell.user_highlight);

}

function addCellLevelLanguageSelector(cell: Cell, kernel: any, info: NotebookInfo) {
    //
    if (cell.node.getElementsByClassName("cell_kernel_selector").length > 0) {
        // update existing list
        var select = $(".cell_kernel_selector", cell.node).empty();
        for (var i = 0; i < info.KernelList.length; i++) {
            select.append($("<option/>")
                .attr("value", info.DisplayName[info.KernelList[i][0]])
                .text(info.DisplayName[info.KernelList[i][0]]));
        }
        select.val(kernel ? kernel : "");
        return;
    }
    // add a new one
    var select = $("<select/>").attr("id", "cell_kernel_selector")
        .css("margin-left", "0.75em")
        .attr("class", "jp-cell-kernel-selector sos-widget");
    for (var i = 0; i < info.KernelList.length; i++) {
        select.append($("<option/>")
            .attr("value", info.DisplayName[info.KernelList[i][0]])
            .text(info.DisplayName[info.KernelList[i][0]]));
    }
    select.val(kernel ? kernel : "");

    select.change(function() {
        let value = (<HTMLInputElement>(this)).value;
        cell.model.metadata.set('kernel', info.DisplayName[value]);
        // cell in panel does not have prompt area
        var ip = cell.node.getElementsByClassName("input_prompt") as HTMLCollectionOf<HTMLElement>;
        var op = cell.node.getElementsByClassName("out_prompt_overlay") as HTMLCollectionOf<HTMLElement>;
        if (info.BackgroundColor[value]) {
            ip[0].style.backgroundColor = info.BackgroundColor[value];
            op[0].style.backgroundColor = info.BackgroundColor[value];
        } else {
            // Use "" to remove background-color?
            ip[0].style.backgroundColor = "";
            op[0].style.backgroundColor = "";
        }
        // // https://github.com/vatlab/sos-notebook/issues/55
        // cell.user_highlight = {
        //     name: 'sos',
        //     base_mode: info.LanguageName[this.value] || info.KernelName[this.value] || this.value,
        // };
        // //console.log(`Set cell code mirror mode to ${cell.user_highlight.base_mode}`)
        // cell.code_mirror.setOption('mode', cell.user_highlight);
    });

    //cell.node.find("div.input_area").prepend(select);
    //let ia = cell.node.getElementsByClassName("jp-InputArea-editor") as HTMLCollectionOf<HTMLElement>;
    //if (ia.length > 0)
    //    (ia[0] as any).appendChild(select);
    $('.jp-InputArea-editor', cell.node).prepend(select);
    //cell.node.appendChild(select);
    return select;
}

export function updateCellStyles(panel: NotebookPanel) {
    var cells = panel.notebook.widgets;

    let info = Manager.manager.get_info(panel);
    // first update the info with language definitions from meta information
    info.add_languages(panel.model.metadata.get('sos')['kernels'])

    // setting up background color and selection according to notebook metadata
    for (let i = 0; i < cells.length; ++i) {
        if (cells[i].model.type === "code") {
            changeStyleOnKernel(cells[i], cells[i].model.metadata.get('kernel'), info);
            addCellLevelLanguageSelector(cells[i], cells[i].model.metadata.get('kernel'), info)
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
