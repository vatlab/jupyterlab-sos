import {
  NotebookPanel
} from '@jupyterlab/notebook';

import {
  Cell // ICellModel
} from '@jupyterlab/cells';

import {
  CodeMirrorEditor
} from '@jupyterlab/codemirror';

import {
  NotebookInfo
} from "./manager"

import {
  Manager,
  safe_css_name
} from "./manager"

const CELL_LANGUAGE_DROPDOWN_CLASS = 'jp-CelllanguageDropDown';

export function saveKernelInfo() {
  let panel = Manager.currentNotebook;
  let info = Manager.manager.get_info(panel);

  let used_kernels = new Set();
  let cells = panel.content.model.cells;
  for (var i = cells.length - 1; i >= 0; --i) {
    let cell = cells.get(i);
    if (cell.type === "code" && cell.metadata.get('kernel')) {
      used_kernels.add(cell.metadata.get('kernel'));
    }
  }
  (panel.content.model.metadata.get("sos") as any)["kernels"] = Array.from(used_kernels).sort().map(
    function(x) {
      return [info.DisplayName.get(x), info.KernelName.get(x),
      info.LanguageName.get(x) || "", info.BackgroundColor.get(x) || "",
      info.CodeMirrorMode.get(x) || ""
      ]
    }
  );
}

export function hideLanSelector(cell) {
  let nodes = cell.node.getElementsByClassName(CELL_LANGUAGE_DROPDOWN_CLASS) as HTMLCollectionOf<HTMLElement>;
  if (nodes.length > 0) {
    nodes[0].style.display = 'none';
  }
}

export function addLanSelector(cell: Cell, info: NotebookInfo) {
  if (!cell.model.metadata.has('kernel')) {
    cell.model.metadata.set('kernel', "SoS");
  }
  let kernel = cell.model.metadata.get('kernel') as string;

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
    editor.parentElement.insertBefore(select, editor);
    select.value = kernel;
    select.addEventListener('change', function(evt) {
      // set cell level meta data
      let kernel = (evt.target as HTMLOptionElement).value;
      cell.model.metadata.set('kernel', kernel);
      info.sos_comm.send({'set-editor-kernel': kernel})
      // change style
      changeStyleOnKernel(cell, kernel, info);
      // set global meta data
      saveKernelInfo();
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
}


export function changeCellKernel(cell: Cell, kernel: string, info: NotebookInfo) {
  cell.model.metadata.set('kernel', kernel);
  let nodes = cell.node.getElementsByClassName(CELL_LANGUAGE_DROPDOWN_CLASS) as HTMLCollectionOf<HTMLElement>;
  // use the existing dropdown box
  let select = nodes.item(0) as HTMLSelectElement;
  if (select) {
    select.value = kernel;
  }
  changeStyleOnKernel(cell, kernel, info);
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
  for (let className of Array.from(cell.node.classList)) {
    if (className.startsWith("sos_lan_")) {
      cell.node.classList.remove(className);
    }
  }
  cell.node.classList.add(safe_css_name(`sos_lan_${kernel}`));
  // cell.user_highlight = {
  //     name: 'sos',
  //     base_mode: info.LanguageName[kernel] || info.KernelName[kernel] || kernel,
  // };
  // //console.log(`Set cell code mirror mode to ${cell.user_highlight.base_mode}`)
  let base_mode : string = info.CodeMirrorMode.get(kernel) || info.LanguageName.get(kernel) || info.KernelName.get(kernel) || kernel;
  if (!base_mode || base_mode === 'sos') {
    (cell.inputArea.editorWidget.editor as CodeMirrorEditor).setOption('mode', 'sos');
  } else {
    (cell.inputArea.editorWidget.editor as CodeMirrorEditor).setOption('mode', {
      name: 'sos',
      base_mode: base_mode,
    });
  }
}

export function updateCellStyles(panel: NotebookPanel, info: NotebookInfo) : Array<string> {
  var cells = panel.content.widgets;

  // setting up background color and selection according to notebook metadata
  for (let i = 0; i < cells.length; ++i) {
    addLanSelector(cells[i], info);
    if (cells[i].model.type === "code") {
      changeStyleOnKernel(cells[i], cells[i].model.metadata.get('kernel') as string, info);
    }
  }

  let tasks = document.querySelectorAll('[id^="status_"]');
  let unknownTasks = [];
  for (let i = 0; i < tasks.length; ++i) {
    // status_localhost_5ea9232779ca1959
    if (tasks[i].id.match("^task_status_icon_.+_[0-9a-f]{16,32}$")) {
        tasks[i].className = "fa fa-fw fa-2x fa-refresh fa-spin";
        unknownTasks.push(tasks[i].id);
    }
  }
  return unknownTasks;
}
