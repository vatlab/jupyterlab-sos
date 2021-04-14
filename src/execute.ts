import {
  // Notebook,
  NotebookPanel
} from "@jupyterlab/notebook";

import { KernelMessage, Kernel } from "@jupyterlab/services";

import { ICellModel, Cell } from "@jupyterlab/cells";

import { ConsolePanel } from "@jupyterlab/console";

import { JSONObject } from '@lumino/coreutils';

import { Manager } from "./manager";
import { changeCellKernel, hideLanSelector } from "./selectors";

export function wrapExecutor(panel: NotebookPanel) {
  let kernel = panel.sessionContext.session?.kernel;

  // override kernel execute with the wrapper.
  // however, this function can be called multiple times for kernel
  // restart etc, so we should be careful
  if (kernel && !kernel.hasOwnProperty("orig_execute")) {
    (kernel as any)["orig_execute"] = kernel.requestExecute;
    kernel.requestExecute = my_execute;
    console.log("executor patched");
  }
}

export function wrapConsoleExecutor(panel: ConsolePanel) {
  let kernel = panel.sessionContext.session?.kernel;

  // override kernel execute with the wrapper.
  // however, this function can be called multiple times for kernel
  // restart etc, so we should be careful
  if (!kernel.hasOwnProperty("orig_execute")) {
    (kernel as any)["orig_execute"] = kernel.requestExecute;
    kernel.requestExecute = my_execute;
    console.log("console executor patched");
  }
}

function scanHeaderLines(cells: ReadonlyArray<Cell>) {
  let TOC = "";
  for (let i = 0; i < cells.length; ++i) {
    let cell = cells[i].model;
    if (cell.type === "markdown") {
      var lines = cell.value.text.split("\n");
      for (let l = 0; l < lines.length; ++l) {
        if (lines[l].match("^#+ ")) {
          TOC += lines[l] + "\n";
        }
      }
    }
  }
  return TOC;
}

// get the workflow part of text from a cell
function getCellWorkflow(cell: ICellModel) {
  var lines = cell.value.text.split("\n");
  var workflow = "";
  var l;
  for (l = 0; l < lines.length; ++l) {
    if (lines[l].startsWith("%include") || lines[l].startsWith("%from")) {
      workflow += lines[l] + "\n";
      continue;
    } else if (
      lines[l].startsWith("#") ||
      lines[l].startsWith("%") ||
      lines[l].trim() === "" ||
      lines[l].startsWith("!")
    ) {
      continue;
    } else if (lines[l].startsWith("[") && lines[l].endsWith("]")) {
      // include comments before section header
      let c = l - 1;
      let comment = "";
      while (c >= 0 && lines[c].startsWith("#")) {
        comment = lines[c] + "\n" + comment;
        c -= 1;
      }
      workflow += comment + lines.slice(l).join("\n") + "\n\n";
      break;
    }
  }
  return workflow;
}

// get workflow from notebook
function getNotebookWorkflow(panel: NotebookPanel) {
  let cells = panel.content.widgets;
  let workflow = "";
  for (let i = 0; i < cells.length; ++i) {
    let cell = cells[i].model;
    if (
      cell.type === "code" &&
      (!cell.metadata.get("kernel") || cell.metadata.get("kernel") === "SoS")
    ) {
      workflow += getCellWorkflow(cell);
    }
  }
  if (workflow != "") {
    workflow = "#!/usr/bin/env sos-runner\n#fileformat=SOS1.0\n\n" + workflow;
  }
  return workflow;
}

function getNotebookContent(panel: NotebookPanel) {
  let cells = panel.content.widgets;
  let workflow = "#!/usr/bin/env sos-runner\n#fileformat=SOS1.0\n\n";

  for (let i = 0; i < cells.length; ++i) {
    let cell = cells[i].model;
    if (cell.type === "code" ) {
      workflow += `# cell ${i + 1}, kernel=${cell.metadata.get("kernel")}\n${cell.value.text}\n\n`
    }
  }
  return workflow;
}

function my_execute(
  content: KernelMessage.IExecuteRequestMsg['content'],
  disposeOnDone: boolean = true,
  metadata?: JSONObject
): Kernel.IShellFuture<
  KernelMessage.IExecuteRequestMsg,
  KernelMessage.IExecuteReplyMsg
> {
  let code = content.code;

  metadata.sos = {};
  let panel = Manager.currentNotebook;
  if (
    code.match(
      /^%sosrun($|\s)|^%run($|\s)|^%convert($|\s)|^%preview\s.*(-w|--workflow).*$/m
    )
  ) {
    if (code.match(/^%convert\s.*(-a|--all).*$/m)) {
      metadata.sos["workflow"] = getNotebookContent(panel);
    } else {
      metadata.sos["workflow"] = getNotebookWorkflow(panel);
    }
  }
  metadata.sos["path"] = panel.context.path;
  metadata.sos["use_panel"] = Manager.consolesOfNotebook(panel).length > 0;

  metadata.sos["use_iopub"] = true;

  let info = Manager.manager.get_info(panel);

  // find the cell that is being executed...
  let cells = panel.content.widgets;

  if (code.match(/^%toc/m)) {
    metadata.sos["toc"] = scanHeaderLines(cells);
  }

  let cell = panel.content.widgets.find(x => x.model.id === metadata.cellId);
  if (cell) {
    // check *
    // let prompt = cell.node.querySelector(".jp-InputArea-prompt");
    // if (!prompt || prompt.textContent.indexOf("*") === -1) continue;
    // use cell kernel if meta exists, otherwise use nb.metadata["sos"].default_kernel
    if (info.autoResume) {
      metadata.sos["rerun"] = true;
      info.autoResume = false;
    }
    metadata.sos["cell_id"] = cell.model.id;
    metadata.sos["cell_kernel"] = cell.model.metadata.get("kernel") as string;
    if (metadata.sos["cell_kernel"] === "Markdown") {
      // fold the input of markdown cells
      cell.inputHidden = true;
    }
  } else {
    let labconsole = Manager.currentConsole.console;
    let last_cell = labconsole.cells.get(labconsole.cells.length - 1);
    let kernel = last_cell.model.metadata.get("kernel");
    kernel = kernel ? kernel.toString() : "SoS";

    // change the color of console cell
    changeCellKernel(last_cell, kernel, info);
    changeCellKernel(labconsole.promptCell, kernel, info);

    // hide the drop down box
    hideLanSelector(last_cell);
    metadata.sos["cell_kernel"] = kernel;
    metadata.sos["cell_id"] = -1;
    content.silent = false;
    content.store_history = true;
  }
  return this.orig_execute(content, disposeOnDone, metadata);
}
