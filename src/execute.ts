
import {
  Cell,
  ICellModel
} from '@jupyterlab/cells';

import {
  KernelMessage,
} from '@jupyterlab/services';

import {
  Manager
} from "./manager"


function get_workflow_from_cell(cell: ICellModel) {
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
      workflow += lines.slice(l).join("\n") + "\n\n";
      break;
    }
  }
  return workflow;
}

export
function prepareContext(cell: Cell, options: KernelMessage.IExecuteRequest): boolean {
  let panel = Manager.currentNotebook;
  let info = Manager.manager.get_info(panel);

  let code = options.code;
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
    options.filename = window.document.getElementById("notebook_name").innerHTML;
    options.workflow = '#!/usr/bin/env sos-runner\n#fileformat=SOS1.0\n\n' + workflow;
  }
  options.user_panel = true;
  options.default_kernel = info.defaultKernel;
  options.rerun = false;
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
        options.rerun = true;
        info.autoResume = false;
      }
      options.cell = i;
      options.cell_kernel = cell.model.metadata.get('kernel');
      return true;
    }
  }

  options.cell_kernel = 'SoS';
  options.cell = -1;
  options.silent = false;
  options.store_history = false;

  return true;
};
