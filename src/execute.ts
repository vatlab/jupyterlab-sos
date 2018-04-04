
import {
    // Notebook,
    NotebookPanel
} from '@jupyterlab/notebook';

import {
    KernelMessage,
    Kernel
} from '@jupyterlab/services';

import {
    Manager
} from "./manager"

export function wrapExecutor(panel: NotebookPanel) {
    let kernel = panel.session.kernel;

    // override kernel execute with the wrapper.
    // however, this function can be called multiple times for kernel
    // restart etc, so we should be careful
    if (!kernel.hasOwnProperty('orig_execute')) {
        kernel['orig_execute'] = kernel.requestExecute;
        kernel.requestExecute = my_execute;
        console.log("executor patched");
    }
}

function get_workflow_from_cell(cell) {
    var lines = cell.get_text().split("\n");
    var workflow = "";
    var l;
    for (l = 0; l < lines.length; ++l) {
        if (lines[l].startsWith("%include") || lines[l].startsWith("%from")) {
            workflow += lines[l] + "\n";
            continue;
        } else if (lines[l].startsWith("#") || lines[l].startsWith("%") || lines[l].trim() === "" || lines[l].startsWith("!")) {
            continue;
        } else if (lines[l].startsWith("[") && lines[l].endsWith("]")) {
            workflow += lines.slice(l).join("\n") + "\n\n";
            break;
        }
    }
    return workflow;
}

/*
* FIXME This is a really bad way but let us have it done and then modify jupyterlab to add it to better places
*/
let my_execute = function(content: KernelMessage.IExecuteRequest, disposeOnDone: boolean = true): Kernel.IFuture {
    let panel = Manager.currentNotebook;
    let info = Manager.manager.get_info(panel);

    let code = content.code;
    let workflow = "";
    let run_notebook = false;
    let lines = code.split("\n");

    for (let l = 0; l < lines.length; ++l) {
        if (lines[l].startsWith("#") || lines[l].trim() === "" || lines[l].startsWith("!")) {
            continue;
        }
        // other magic
        if (lines[l].startsWith("%")) {
            if (lines[l].match(/^%sosrun($|\s)|^%run($|\s)|^%sossave($|\s)|^%preview\s.*(-w|--workflow).*$/)) {
                run_notebook = true;
                break;
            } else {
                continue;
            }
        } else {
            run_notebook = false;
            break;
        }
    }

    let i;
    let cells = panel.notebook.widgets;
    if (run_notebook) {
        // Running %sossave --to html needs to save notebook
        //FIXME nb.save_notebook();
        for (i = 0; i < cells.length; ++i) {
            // older version of the notebook might have sos in metadata
            let cell = cells[i].model;
            if (cell.type === "code" && (!cell.metadata.get('kernel') || cell.metadata.get('kernel') === "SoS")) {
                workflow += get_workflow_from_cell(cell);
            }
        }
    }
    if (run_notebook) {
        info.sos_comm.send({
            "workflow": workflow,
        });
    }
    let rerun_option = "";
    for (i = cells.length - 1; i >= 0; --i) {
        // this is the cell that is being executed...
        // according to this.set_input_prompt("*") before execute is called.
        // also, because a cell might be starting without a previous cell
        // being finished, we should start from reverse and check actual code
        let cell = cells[i];
        if (code === cell.model.value.text) {
            // check *
            let prompt = cell.node.querySelector('.jp-InputArea-prompt');
            if (!prompt || prompt.textContent.indexOf("*") === -1)
                continue;
            // use cell kernel if meta exists, otherwise use nb.metadata["sos"].default_kernel
            if (info.autoResume) {
                rerun_option = " --resume ";
                info.autoResume = false;
            }
            // passing to kernel
            // 1. the default kernel (might have been changed from menu bar
            // 2. cell kernel (might be unspecified for new cell)
            // 3. cell index (for setting style after execution)
            content.code = "%frontend " +
                " --default-kernel " + panel.notebook.model.metadata.get("sos")['default_kernel'] +
                " --cell-kernel " + cell.model.metadata.get('kernel') + rerun_option +
                (run_notebook ? " --filename '" + panel.session.name + "'" : "") +
                " --cell " + i.toString() + "\n" + code
            return this.orig_execute(content, disposeOnDone);
        }
    }
    // if this is a command from scratch pad (not part of the notebook)
    // return this.orig_execute(
    //     "%frontend " +
    //     " --use-panel " +
    //     " --default-kernel " + panel.notebook.model.metadata.get("sos").default_kernel +
    //     " --cell-kernel " + window.my_panel.cell.metadata.kernel +
    //     (run_notebook ? " --filename '" + window.document.getElementById("notebook_name").innerHTML + "'" : "") +
    //     " --cell -1 " + "\n" + code,
    //     callbacks, {
    //         "silent": false,
    //         "store_history": false
    //     });

    return this.orig_executor(content, disposeOnDone);
};
