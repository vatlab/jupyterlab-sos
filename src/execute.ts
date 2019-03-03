import {
  // Notebook,
  NotebookPanel
} from '@jupyterlab/notebook';

import {
  KernelMessage,
  Kernel
} from '@jupyterlab/services';

import {
  ICellModel, Cell
} from '@jupyterlab/cells';

import {
  Manager
} from "./manager"

export function wrapExecutor(panel: NotebookPanel) {
  let kernel = panel.session.kernel;

  // override kernel execute with the wrapper.
  // however, this function can be called multiple times for kernel
  // restart etc, so we should be careful
  if (!kernel.hasOwnProperty('orig_execute')) {
    (kernel as any)['orig_execute'] = kernel.requestExecute;
    kernel.requestExecute = my_execute;
    console.log("executor patched");
  }
}

function scanHeaderLines(cells: ReadonlyArray<Cell>) {
  let TOC = ''
  for (let i = 0; i < cells.length; ++i) {
    let cell = cells[i].model;
    if (cell.type === "markdown") {
      var lines = cell.value.text.split("\n");
      for (let l = 0; l < lines.length; ++l) {
        if (lines[l].match('^#+ ')) {
          TOC += lines[l] + '\n';
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
    } else if (lines[l].startsWith("#") || lines[l].startsWith("%") || lines[l].trim() === "" || lines[l].startsWith("!")) {
      continue;
    } else if (lines[l].startsWith("[") && lines[l].endsWith("]")) {
      // include comments before section header
      let c = l - 1
      let comment = ''
      while (c >= 0 && lines[c].startsWith('#')) {
          comment = lines[c] + '\n' + comment;
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
  let workflow = '#!/usr/bin/env sos-runner\n#fileformat=SOS1.0\n\n';
  for (let i = 0; i < cells.length; ++i) {
    let cell = cells[i].model;
    if (cell.type === "code" && (!cell.metadata.get('kernel') || cell.metadata.get('kernel') === "SoS")) {
      workflow += getCellWorkflow(cell);
    }
  }
  return workflow;
}

function my_execute(content: KernelMessage.IExecuteRequest, disposeOnDone: boolean = true): Kernel.IFuture {
  let code = content.code;

  content.sos = {};
  let panel = Manager.currentNotebook;
  if (code.match(/^%sosrun($|\s)|^%run($|\s)|^%sossave($|\s)|^%preview\s.*(-w|--workflow).*$/m)) {
    content.sos['workflow'] = getNotebookWorkflow(panel);
  }
  content.sos['path'] = panel.context.path;
  content.sos['use_panel'] = Manager.hasOpenConsole();
  content.sos['use_iopub'] = true;

  let info = Manager.manager.get_info(panel);

  // find the cell that is being executed...
  let cells = panel.content.widgets;

  if (code.match(/^%toc/m)) {
    content.sos['toc'] = scanHeaderLines(cells);
  }

  for (let i = cells.length - 1; i >= 0; --i) {
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
        content.sos['rerun'] = true;
        info.autoResume = false;
      }
      content.sos['cell_id'] = cell.model.id;
      content.sos['cell_kernel'] = cell.model.metadata.get('kernel');
      return this.orig_execute(content, disposeOnDone);
    }
  }

  // not sure how to handle console cell yet
  content.sos['cell_kernel'] = 'SoS';
  content.sos['cell_id'] = -1;
  content.silent = false;
  content.store_history = false;

  return this.orig_execute(content, disposeOnDone);
};
