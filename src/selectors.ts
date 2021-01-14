import {
  NotebookPanel,
  NotebookActions
} from "@jupyterlab/notebook";

import {
  Cell // ICellModel
} from "@jupyterlab/cells";

import { CodeMirrorEditor } from "@jupyterlab/codemirror";

import { NotebookInfo } from "./manager";

import { Manager, safe_css_name } from "./manager";

const CELL_LANGUAGE_DROPDOWN_CLASS = "jp-CelllanguageDropDown";

export function saveKernelInfo() {
  let panel = Manager.currentNotebook;
  let info = Manager.manager.get_info(panel);

  let used_kernels = new Set();
  let cells = panel.content.model.cells;
  for (var i = cells.length - 1; i >= 0; --i) {
    let cell = cells.get(i);
    if (cell.type === "code" && cell.metadata.get("kernel")) {
      used_kernels.add(cell.metadata.get("kernel") as string);
    }
  }
  (panel.content.model.metadata.get("sos") as any)["kernels"] = Array.from(
    used_kernels.values()
  )
    .sort()
    .map(function (x) {
      return [
        info.DisplayName.get(x as string),
        info.KernelName.get(x as string),
        info.LanguageName.get(x as string) || "",
        info.BackgroundColor.get(x as string) || "",
        info.CodeMirrorMode.get(x as string) || ""
      ];
    });
}

export function hideLanSelector(cell) {
  let nodes = cell.node.getElementsByClassName(
    CELL_LANGUAGE_DROPDOWN_CLASS
  ) as HTMLCollectionOf<HTMLElement>;
  if (nodes.length > 0) {
    nodes[0].style.display = "none";
  }
}

export function toggleDisplayOutput(cell) {
  if (cell.model.type === "markdown") {
    // switch between hide_output and ""
    if (
      cell.model.metadata.get("tags") &&
      (cell.model.metadata.get("tags") as Array<string>).indexOf(
        "hide_output"
      ) >= 0
    ) {
      // if report_output on, remove it
      remove_tag(cell, "hide_output");
    } else {
      add_tag(cell, "hide_output");
    }
  } else if (cell.model.type === "code") {
    // switch between report_output and ""
    if (
      cell.model.metadata.get("tags") &&
      (cell.model.metadata.get("tags") as Array<string>).indexOf(
        "report_output"
      ) >= 0
    ) {
      // if report_output on, remove it
      remove_tag(cell, "report_output");
    } else {
      add_tag(cell, "report_output");
    }
  }
}


export function toggleCellKernel(cell: Cell, panel: NotebookPanel) {

  if (cell.model.type === "markdown") {
    // markdown, to code
    // NotebookActions.changeCellType(panel.content, 'code');
    return;
  } else if (cell.model.type === "code") {
    // switch to the next used kernel
    let kernels = (panel.content.model.metadata.get("sos") as any)["kernels"];
    // current kernel
    let kernel = cell.model.metadata.get("kernel");

    if (kernels.length == 1) {
      return;
    }
    // index of kernel
    for (let i = 0; i < kernels.length; ++i) {
      if (kernels[i][0] === kernel) {
        let info: NotebookInfo = Manager.manager.get_info(panel);
        let next = (i + 1) % kernels.length;
        // notebook_1.NotebookActions.changeCellType(panel.content, 'markdown');
        changeCellKernel(cell, kernels[next][0], info);
        break;
      }
    }
  }
}


export function toggleMarkdownCell(cell: Cell, panel: NotebookPanel) {

  if (cell.model.type === "markdown") {
    // markdown, to code
    NotebookActions.changeCellType(panel.content, 'code');
  } else {
    NotebookActions.changeCellType(panel.content, 'markdown');
  }
}

function remove_tag(cell, tag) {
  let taglist = cell.model.metadata.get('tags') as string[];
  let new_list: string[] = [];
  for (let i = 0; i < taglist.length; i++) {
    if (taglist[i] != tag) {
      new_list.push(taglist[i]);
    }
  }
  cell.model.metadata.set('tags', new_list);
  let op = cell.node.getElementsByClassName(
    "jp-Cell-outputWrapper"
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < op.length; ++i) {
    op.item(i).classList.remove(tag);
  }
}

function add_tag(cell, tag) {
  let taglist = cell.model.metadata.get('tags') as string[];
  if (taglist) {
    taglist.push(tag);
  } else {
    taglist = [tag];
  }
  cell.model.metadata.set('tags', taglist);
  let op = cell.node.getElementsByClassName(
    "jp-Cell-outputWrapper"
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < op.length; ++i) {
    op.item(i).classList.add(tag);
  }
}

export function addLanSelector(cell: Cell, info: NotebookInfo) {
  if (!cell.model.metadata.has("kernel")) {
    cell.model.metadata.set("kernel", "SoS");
  }
  let kernel = cell.model.metadata.get("kernel") as string;

  let nodes = cell.node.getElementsByClassName(
    CELL_LANGUAGE_DROPDOWN_CLASS
  ) as HTMLCollectionOf<HTMLElement>;
  if (nodes.length === 0) {
    // if there is no selector, create one
    let select = document.createElement("select");
    for (let lan of info.KernelList) {
      let option = document.createElement("option");
      option.value = lan;
      option.id = lan;
      option.textContent = lan;
      select.appendChild(option);
    }
    select.className = CELL_LANGUAGE_DROPDOWN_CLASS + " sos-widget";

    let cell_should_be_hidden = false;
    if (cell.inputHidden) {
      // if the cell is collapsed, no jp-InputArea-editor could be found
      cell.inputHidden = false;
      cell_should_be_hidden = true;
      // cell.inputHidden = true;
    }

    let editor = cell.node.getElementsByClassName("jp-InputArea-editor")[0];
    editor.parentElement.insertBefore(select, editor);
    select.value = kernel;
    select.addEventListener("change", function (evt) {
      // set cell level meta data
      let kernel = (evt.target as HTMLOptionElement).value;
      cell.model.metadata.set("kernel", kernel);
      info.sos_comm.send({ "set-editor-kernel": kernel });
      // change style
      changeStyleOnKernel(cell, kernel, info);
      // set global meta data
      saveKernelInfo();
    });
    if (cell_should_be_hidden) {
      cell.inputHidden = true;
    }
  } else {
    // use the existing dropdown box
    let select = nodes.item(0) as HTMLSelectElement;
    // update existing
    for (let lan of info.KernelList) {
      // ignore if already exists
      if (select.options.namedItem(lan)) continue;
      let option = document.createElement("option");
      option.value = lan;
      option.id = lan;
      option.textContent = lan;
      select.appendChild(option);
    }
    select.value = kernel ? kernel : "SoS";
  }
}

export function changeCellKernel(
  cell: Cell,
  kernel: string,
  info: NotebookInfo
) {
  cell.model.metadata.set("kernel", kernel);
  let nodes = cell.node.getElementsByClassName(
    CELL_LANGUAGE_DROPDOWN_CLASS
  ) as HTMLCollectionOf<HTMLElement>;
  // use the existing dropdown box
  let select = nodes.item(0) as HTMLSelectElement;
  if (select) {
    select.value = kernel;
  }
  changeStyleOnKernel(cell, kernel, info);
}

export function changeStyleOnKernel(
  cell: Cell,
  kernel: string,
  info: NotebookInfo
) {
  // Note: JupyterLab does not yet support tags
  if (
    cell.model.metadata.get("tags") &&
    (cell.model.metadata.get("tags") as Array<string>).indexOf(
      "report_output"
    ) >= 0
  ) {
    let op = cell.node.getElementsByClassName(
      "jp-Cell-outputWrapper"
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < op.length; ++i)
      op.item(i).classList.add("report-output");
  } else {
    let op = cell.node.getElementsByClassName(
      "jp-Cell-outputWrapper"
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < op.length; ++i)
      op.item(i).classList.remove("report-output");
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
  let base_mode: string =
    info.CodeMirrorMode.get(kernel) ||
    info.LanguageName.get(kernel) ||
    info.KernelName.get(kernel) ||
    kernel;
  if (!base_mode || base_mode === "sos") {
    (cell.inputArea.editorWidget.editor as CodeMirrorEditor).setOption(
      "mode",
      "sos"
    );
  } else {
    (cell.inputArea.editorWidget.editor as CodeMirrorEditor).setOption("mode", {
      name: "sos",
      base_mode: base_mode
    });
  }
}

export function updateCellStyles(
  panel: NotebookPanel,
  info: NotebookInfo
): Array<string> {
  var cells = panel.content.widgets;

  // setting up background color and selection according to notebook metadata
  for (let i = 0; i < cells.length; ++i) {
    addLanSelector(cells[i], info);
    if (cells[i].model.type === "code") {
      changeStyleOnKernel(
        cells[i],
        cells[i].model.metadata.get("kernel") as string,
        info
      );
    }
  }

  let panels = Manager.consolesOfNotebook(panel);
  for (let i = 0; i < panels.length; ++i) {
    addLanSelector(panels[i].console.promptCell, info);
    changeStyleOnKernel(
      panels[i].console.promptCell,
      panels[i].console.promptCell.model.metadata.get("kernel") as string,
      info
    );
  }
  let tasks = document.querySelectorAll('[id^="task_status_"]');
  let unknownTasks = [];
  for (let i = 0; i < tasks.length; ++i) {
    // status_localhost_5ea9232779ca1959
    if (tasks[i].id.match("^task_status_icon_.*")) {
      tasks[i].className = "fa fa-fw fa-2x fa-refresh fa-spin";
      unknownTasks.push(tasks[i].id.substring(17));
    }
  }
  return unknownTasks;
}
