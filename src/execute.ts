
import {
    // Notebook,
    NotebookPanel,
    // NotebookTracker
} from '@jupyterlab/notebook';

import {
    KernelMessage,
    Kernel
} from '@jupyterlab/services';
//
// import {
//     Manager
// } from "./manager"

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

let my_execute = function(content: KernelMessage.IExecuteRequest, disposeOnDone: boolean = true): Kernel.IFuture {
    // let tracker = new NotebookTracker({ namespace: 'notebook' });
    // let notebook = tracker.currentWidget.notebook;
    //
    // let code = content.code;
    // let workflow = "";
    // let run_notebook = false;
    // let lines = code.split("\n");
    //
    // for (let l = 0; l < lines.length; ++l) {
    //     if (lines[l].startsWith("#") || lines[l].trim() === "" || lines[l].startsWith("!")) {
    //         continue;
    //     }
    //     // other magic
    //     if (lines[l].startsWith("%")) {
    //         if (lines[l].match(/^%sosrun($|\s)|^%run($|\s)|^%sossave($|\s)|^%preview\s.*(-w|--workflow).*$/)) {
    //             run_notebook = true;
    //             break;
    //         } else {
    //             continue;
    //         }
    //     } else {
    //         run_notebook = false;
    //         break;
    //     }
    // }
    //
    // let i;
    // let cells = nb.get_cells();
    // if (run_notebook) {
    //     // Running %sossave --to html needs to save notebook
    //     nb.save_notebook();
    //     for (i = 0; i < cells.length; ++i) {
    //         // older version of the notebook might have sos in metadata
    //         if (cells[i].cell_type === "code" && (!cells[i].metadata.kernel || cells[i].metadata.kernel === "SoS" ||
    //             cells[i].metadata.kernel === "sos")) {
    //             workflow += get_workflow_from_cell(cells[i]);
    //         }
    //     }
    // }
    // if (run_notebook) {
    //     window.sos_comm.send({
    //         "workflow": workflow,
    //     });
    // }
    // let rerun_option = "";
    // for (i = cells.length - 1; i >= 0; --i) {
    //     // this is the cell that is being executed...
    //     // according to this.set_input_prompt("*") before execute is called.
    //     // also, because a cell might be starting without a previous cell
    //     // being finished, we should start from reverse and check actual code
    //     if (cells[i].input_prompt_number === "*" && code === cells[i].get_text()) {
    //         // use cell kernel if meta exists, otherwise use nb.metadata["sos"].default_kernel
    //         if (window._auto_resume) {
    //             rerun_option = " --resume ";
    //             window._auto_resume = false;
    //         }
    //         return this.orig_execute(
    //             // passing to kernel
    //             // 1. the default kernel (might have been changed from menu bar
    //             // 2. cell kernel (might be unspecified for new cell)
    //             // 3. cell index (for setting style after execution)
    //             "%frontend " +
    //             (nb.metadata["sos"]["panel"].displayed ? " --use-panel" : "") +
    //             " --default-kernel " + nb.metadata["sos"].default_kernel +
    //             " --cell-kernel " + cells[i].metadata.kernel + rerun_option +
    //             (run_notebook ? " --filename '" + window.document.getElementById("notebook_name").innerHTML + "'" : "") +
    //             " --cell " + i.toString() + "\n" + code,
    //             callbacks, options);
    //     }
    // }
    // // if this is a command from scratch pad (not part of the notebook)
    // return this.orig_execute(
    //     "%frontend " +
    //     " --use-panel " +
    //     " --default-kernel " + nb.metadata["sos"].default_kernel +
    //     " --cell-kernel " + window.my_panel.cell.metadata.kernel +
    //     (run_notebook ? " --filename '" + window.document.getElementById("notebook_name").innerHTML + "'" : "") +
    //     " --cell -1 " + "\n" + code,
    //     callbacks, {
    //         "silent": false,
    //         "store_history": false
    //     });
    return this.orig_executor(content, disposeOnDone);
};