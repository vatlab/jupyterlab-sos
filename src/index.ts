import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { each } from "@lumino/algorithm";

import { IDisposable, DisposableDelegate } from "@lumino/disposable";

import { Cell, CodeCell } from "@jupyterlab/cells";

import { Kernel, Session } from "@jupyterlab/services";

import { DocumentRegistry } from "@jupyterlab/docregistry";

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { KernelMessage } from "@jupyterlab/services";

import { ICommandPalette } from "@jupyterlab/apputils";

import {
  ICodeMirror
} from '@jupyterlab/codemirror';

import CodeMirror from 'codemirror';


import {
  NotebookPanel,
  INotebookModel,
  INotebookTracker
} from "@jupyterlab/notebook";

import { IConsoleTracker } from "@jupyterlab/console";

import {
  sosHintWords, sos_mode
} from "./codemirror-sos";

import {
  addLanSelector,
  updateCellStyles,
  changeCellKernel,
  changeStyleOnKernel,
  saveKernelInfo,
  toggleDisplayOutput,
  toggleCellKernel,
  toggleMarkdownCell,
} from "./selectors";

import { wrapExecutor, wrapConsoleExecutor } from "./execute";

// define and register SoS CodeMirror mode
import "./codemirror-sos";

import "../style/index.css";

import { Manager } from "./manager";

/*
 * Define SoS File msg_type
 */
const SOS_MIME_TYPE = "text/x-sos";

function registerSoSFileType(app: JupyterFrontEnd) {
  app.docRegistry.addFileType({
    name: "SoS",
    displayName: "SoS File",
    extensions: [".sos"],
    mimeTypes: [SOS_MIME_TYPE],
    iconClass: "jp-MaterialIcon sos_icon"
  });
}

function defineSoSCodeMirrorMode(code_mirror_singleton) {
  // hint word for SoS mode
  try {
    code_mirror_singleton.registerHelper("hintWords", "sos", sosHintWords);
  } catch (error) {
    console.log(`Failed to register hintWords for sos mode. ${error}`);
  }

  (code_mirror_singleton as any).defineMode(
    "sos",
    sos_mode,
    "python");

  (code_mirror_singleton as any).defineMIME("text/x-sos", "sos");

  (code_mirror_singleton as any).modeInfo.push({
    ext: ["sos"],
    mime: "text/x-sos",
    mode: "sos",
    name: "SoS"
  });
}

function formatDuration(ms: number): string {
  let res = [];
  let seconds: number = Math.floor(ms / 1000);
  let day: number = Math.floor(seconds / 86400);
  if (day > 0) {
    res.push(day + " day");
  }
  let hh = Math.floor((seconds % 86400) / 3600);
  if (hh > 0) {
    res.push(hh + " hr");
  }
  let mm = Math.floor((seconds % 3600) / 60);
  if (mm > 0) {
    res.push(mm + " min");
  }
  let ss = seconds % 60;
  if (ss > 0) {
    res.push(ss + " sec");
  }
  let ret = res.join(" ");
  if (ret === "") {
    return "0 sec";
  } else {
    return ret;
  }
}

function update_duration() {
  setInterval(function () {
    document
      .querySelectorAll("[id^='status_duration_']")
      .forEach((item: Element) => {
        if (item.className != "running") {
          return;
        }
        (item as HTMLElement).innerText =
          "Ran for " +
          formatDuration(
            +new Date() - +new Date(parseFloat(item.getAttribute("datetime")))
          );
      });
  }, 5000);
}

/* When a notebook is opened with multiple workflow or task tables,
 * the tables have display_id but the ID maps will not be properly
 * setup so that the tables cannot be updated with another
 * update_display_data message. To fix this problem, we will have
 * to manually populate the
 *   output_area._display_id_targets
 * structure.
 */
function fix_display_id(cell) {
  if (cell.outputArea._displayIdMap.size > 0) {
    return;
  }
  for (let idx = 0; idx < cell.outputArea.model.length; ++idx) {
    let output = cell.outputArea.model.get(idx);
    if (output.type != "display_data" || !output.data["text/html"]) {
      continue;
    }
    // the HTML should look like
    // <table id="task_macpro_90775d4e30583c18" class="task_table running">
    if (!output.data || !output.data["text/html"]) {
      continue;
    }
    let id = output.data["text/html"].match(/id="([^"]*)"/);
    if (!id || !id[1]) {
      continue;
    }
    let targets = cell.outputArea._displayIdMap.get(id[1]) || [];
    targets.push(idx);
    let target_id = id[1];
    if (target_id.match('^task_.*')) {
      target_id = target_id.split("_").slice(0, -1).join("_");
    }
    cell.outputArea._displayIdMap.set(target_id, targets);
  }
}

function add_data_to_cell(cell, data, display_id) {
  if (data.output_type === "update_display_data") {
    fix_display_id(cell);
    let targets = cell.outputArea._displayIdMap.get(display_id);
    if (!targets) {
      // something wrong
      console.log("Failed to rebuild displayIdMap");
      return;
    }
    data.output_type = "display_data";
    for (let index of targets) {
      cell.outputArea.model.set(index, data);
    }
  } else {
    cell.outputArea.model.add(data);
    let targets = cell.outputArea._displayIdMap.get(display_id) || [];
    targets.push(cell.outputArea.model.length - 1);
    cell.outputArea._displayIdMap.set(display_id, targets);
  }
}

// add workflow status indicator table
function update_workflow_status(info, panel) {
  // find the cell
  let cell_id = info.cell_id;
  let cell = panel.content.widgets.find(x => x.model.id == cell_id);
  if (!cell) {
    console.log(`Cannot find cell by ID ${info.cell_id}`);
    return;
  }

  // if there is an existing status table, try to retrieve its information
  // if the new data does not have it
  let has_status_table = document.getElementById(`workflow_${cell_id}`);
  if (!has_status_table && info.status != "pending") {
    return;
  }
  let timer_text = "";
  if (info.start_time) {
    // convert from python time to JS time.
    info.start_time = info.start_time * 1000;
  }
  if (info.status == "purged") {
    if (!has_status_table) {
      return;
    }
    let data = {
      output_type: "update_display_data",
      transient: { display_id: `workflow_${cell_id}` },
      metadata: {},
      data: {
        "text/html": ""
      }
    };
    add_data_to_cell(cell, data, `workflow_${cell_id}`);
  }
  if (has_status_table) {
    // if we already have timer, let us try to "fix" it in the notebook
    let timer = document.getElementById(`status_duration_${cell_id}`);
    timer_text = timer.innerText;
    if (
      timer_text === "" &&
      (info.status === "completed" ||
        info.status === "failed" ||
        info.status === "aborted")
    ) {
      timer_text = "Ran for < 5 seconds";
    }
    if (!info.start_time) {
      info.start_time = timer.getAttribute("datetime");
    }
    //
    if (!info.workflow_id) {
      info.workflow_id = document.getElementById(
        `workflow_id_${cell_id}`
      ).innerText;
    }
    if (!info.workflow_name) {
      info.workflow_name = document.getElementById(
        `workflow_name_${cell_id}`
      ).innerText;
    }
    if (!info.index) {
      info.index = document.getElementById(
        `workflow_index_${cell_id}`
      ).innerText;
    }
  }
  // new and existing, check icon
  let status_class = {
    pending: "fa-square-o",
    running: "fa-spinner fa-pulse fa-spin",
    completed: "fa-check-square-o",
    failed: "fa-times-circle-o",
    aborted: "fa-frown-o"
  };

  // look for status etc and update them.
  let onmouseover = `onmouseover='this.classList="fa fa-2x fa-fw fa-trash"'`;
  let onmouseleave = `onmouseleave='this.classList="fa fa-2x fa-fw ${status_class[info.status]
    }"'`;
  let onclick = `onclick="cancel_workflow(this.id.substring(21))"`;

  let data = {
    output_type: has_status_table ? "update_display_data" : "display_data",
    transient: { display_id: `workflow_${cell_id}` },
    metadata: {},
    data: {
      "text/html": `
<table id="workflow_${cell_id}" class="workflow_table  ${info.status}">
<tr>
      <td class="workflow_icon">
        <i id="workflow_status_icon_${cell_id}" class="fa fa-2x fa-fw ${status_class[info.status]
        }"
        ${onmouseover} ${onmouseleave} ${onclick}></i>
      </td>
      <td class="workflow_name">
        <pre><span id="workflow_name_${cell_id}">${info.workflow_name
        }</span></pre>
      </td>
      <td class="workflow_id">
        <span>Workflow ID</span></br>
        <pre><i class="fa fa-fw fa-sitemap"></i><span id="workflow_id_${cell_id}">${info.workflow_id
        }</span></pre>
      </td>
      <td class="workflow_index">
        <span>Index</span></br>
        <pre>#<span id="workflow_index_${cell_id}">${info.index}</span></pre>
      </td>
      <td class="workflow_status">
        <span id="status_text_${cell_id}">${info.status}</span></br>
        <pre><i class="fa fa-fw fa-clock-o"></i><time id="status_duration_${cell_id}" class="${info.status
        }" datetime="${info.start_time}">${timer_text}</time></pre>
      </td>
</tr>
</table>
`
    }
  };
  add_data_to_cell(cell, data, `workflow_${cell_id}`);
}

function update_task_status(info, panel) {
  // find the cell
  //console.log(info);
  // special case, purge by tag, there is no task_id
  if (!info.task_id && info.tag && info.status == "purged") {
    // find all elements by tag
    let elems = document.getElementsByClassName(`task_tag_${info.tag}`);
    if (!elems) {
      return;
    }
    let cell_elems = Array.from(elems).map(x => x.closest(".jp-CodeCell"));
    let cells = cell_elems.map(cell_elem =>
      panel.content.widgets.find(x => x.node == cell_elem)
    );
    let display_ids = Array.from(elems).map(x => x.closest(".task_table").id.split('_').slice(0, -1).join('_'));

    for (let i = 0; i < cells.length; ++i) {
      let data = {
        output_type: "update_display_data",
        transient: { display_id: display_ids[i] },
        metadata: {},
        data: {
          "text/html": ""
        }
      };
      add_data_to_cell(cells[i], data, display_ids[i]);
    }
    return;
  }

  let elem_id = `${info.queue}_${info.task_id}`;
  // convert between Python and JS float time
  if (info.start_time) {
    info.start_time = info.start_time * 1000;
  }
  // find the status table
  let cell_id = info.cell_id;
  let cell = null;
  let has_status_table;

  if (cell_id) {
    cell = panel.content.widgets.find(x => x.model.id == cell_id);
    has_status_table = document.getElementById(`task_${elem_id}_${cell_id}`);
    if (!has_status_table && info.status != 'pending') {
      // if there is already a table inside, with cell_id that is different from before...
      has_status_table = document.querySelector(
        `[id^="task_${elem_id}"]`
      );
      if (has_status_table) {
        cell_id = has_status_table.id.split("_").slice(-1)[0];
        cell = panel.content.widgets.find(x => x.model.id == cell_id);
      }
    }
    if (info.update_only && !has_status_table) {
      console.log(
        `Cannot find cell by cell ID ${info.cell_id} or task ID ${info.task_id} to update`
      );
      return;
    }
  } else {
    has_status_table = document.querySelector(`[id^="task_${elem_id}"]`);
    let elem = has_status_table.closest(".jp-CodeCell");
    cell = panel.content.widgets.find(x => x.node == elem);
    cell_id = cell.model.id;
  }

  if (!cell) {
    console.log(`Cannot find cell by ID ${info.cell_id}`);
    return;
  }

  if (info.status == "purged") {
    if (has_status_table) {
      let data = {
        output_type: "update_display_data",
        transient: { display_id: `task_${elem_id}` },
        metadata: {},
        data: {
          "text/html": ""
        }
      };
      add_data_to_cell(cell, data, `task_${elem_id}`);
    }
    return;
  }
  // if there is an existing status table, try to retrieve its information
  // the new data does not have it
  let timer_text = "";
  if (has_status_table) {
    // if we already have timer, let us try to "fix" it in the notebook
    let timer = document.getElementById(`status_duration_${elem_id}_${cell_id}`);
    if (!timer) {
      // we could be opening an previous document with different cell_id
      timer = document.querySelector(`[id^="status_duration_${elem_id}"]`)
    }
    if (timer) {
      timer_text = timer.innerText;
      if (
        timer_text === "" &&
        (info.status === "completed" ||
          info.status === "failed" ||
          info.status === "aborted")
      ) {
        timer_text = "Ran for < 5 seconds";
      }
      if (!info.start_time) {
        info.start_time = timer.getAttribute("datetime");
      }
      if (!info.tags) {
        let tags = document.getElementById(`status_tags_${elem_id}_${cell_id}`);
        if (!tags) {
          tags = document.querySelector(`[id^="status_tags_${elem_id}"]`)
        }
        if (tags) {
          info.tags = tags.innerText;
        }
      }
    }
  }

  let status_class = {
    pending: "fa-square-o",
    submitted: "fa-spinner",
    running: "fa-spinner fa-pulse fa-spin",
    completed: "fa-check-square-o",
    failed: "fa-times-circle-o",
    aborted: "fa-frown-o",
    missing: "fa-question"
  };

  // look for status etc and update them.
  let id_elems =
    `<pre>${info.task_id}` +
    `<div class="task_id_actions">` +
    `<i class="fa fa-fw fa-refresh" onclick="task_action({action:'status', task:'${info.task_id
    }', queue: '${info.queue}'})"></i>` +
    `<i class="fa fa-fw fa-play" onclick="task_action({action:'execute', task:'${info.task_id
    }', queue: '${info.queue}'})"></i>` +
    `<i class="fa fa-fw fa-stop"" onclick="task_action({action:'kill', task:'${info.task_id
    }', queue: '${info.queue}'})"></i>` +
    `<i class="fa fa-fw fa-trash"" onclick="task_action({action:'purge', task:'${info.task_id
    }', queue: '${info.queue}'})"></i>` +
    `</div></pre>`;

  let tags = info.tags.split(/\s+/g);
  let tags_elems = "";
  for (let ti = 0; ti < tags.length; ++ti) {
    let tag = tags[ti];
    if (!tag) {
      continue;
    }
    tags_elems +=
      `<pre class="task_tags task_tag_${tag}">${tag}` +
      `<div class="task_tag_actions">` +
      `<i class="fa fa-fw fa-refresh" onclick="task_action({action:'status', tag:'${tag}', queue: '${info.queue
      }'})"></i>` +
      `<i class="fa fa-fw fa-stop"" onclick="task_action({action:'kill', tag:'${tag}', queue: '${info.queue
      }'})"></i>` +
      `<i class="fa fa-fw fa-trash"" onclick="task_action({action:'purge', tag:'${tag}', queue: '${info.queue
      }'})"></i>` +
      `</div></pre>`;
  }

  let data = {
    output_type: has_status_table ? "update_display_data" : "display_data",
    transient: { display_id: `task_${elem_id}` },
    metadata: {},
    data: {
      "text/html": `
<table id="task_${elem_id}_${cell_id}" class="task_table ${info.status}">
<tr>
  <td class="task_icon">
    <i id="task_status_icon_${elem_id}_${cell_id}" class="fa fa-2x fa-fw ${status_class[info.status]
        }"
    ${onmouseover} ${onmouseleave} ${onclick}></i>
  </td>
  <td class="task_id">
    <span><pre><i class="fa fa-fw fa-sitemap"></i></pre>${id_elems}</span>
  </td>
  <td class="task_tags">
    <span id="status_tags_${elem_id}_${cell_id}"><pre><i class="fa fa-fw fa-info-circle"></i></pre>${tags_elems}</span>
  </td>
  <td class="task_timer">
    <pre><i class="fa fa-fw fa-clock-o"></i><time id="status_duration_${elem_id}_${cell_id}" class="${info.status
        }" datetime="${info.start_time}">${timer_text}</time></pre>
  </td>
  <td class="task_status">
    <pre><i class="fa fa-fw fa-tasks"></i><span id="status_text_${elem_id}_${cell_id}">${info.status
        }</span></pre>
  </td>
</tr>
</table>
`
    }
  };
  add_data_to_cell(cell, data, `task_${elem_id}`);
}

/*
 * SoS frontend Comm
 */
function on_frontend_msg(msg: KernelMessage.ICommMsgMsg) {
  let data: any = msg.content.data;
  let panel = Manager.manager.notebook_of_comm(msg.content.comm_id);
  let msg_type = msg.metadata.msg_type;
  let info = Manager.manager.get_info(panel);
  console.log(`Received ${msg_type}`);

  if (msg_type === "kernel-list") {
    info.updateLanguages(data);
    let unknownTasks = updateCellStyles(panel, info);
    if (unknownTasks) {
      info.sos_comm.send({
        "update-task-status": unknownTasks
      });
    }
    console.log("kernel list updated");
  } else if (msg_type === "cell-kernel") {
    // jupyter lab does not yet handle panel cell
    if (data[0] === "") {
      return;
    }
    let cell = panel.content.widgets.find(x => x.model.id == data[0]);
    if (!cell) {
      return;
    }
    if (cell.model.metadata.get("kernel") !== info.DisplayName.get(data[1])) {
      changeCellKernel(cell, info.DisplayName.get(data[1]), info);
      saveKernelInfo();
    } else if (
      cell.model.metadata.get("tags") &&
      (cell.model.metadata.get("tags") as Array<string>).indexOf(
        "report_output"
      ) >= 0
    ) {
      // #639
      // if kernel is different, changeStyleOnKernel would set report_output.
      // otherwise we mark report_output
      let op = cell.node.getElementsByClassName(
        "jp-Cell-outputWrapper"
      ) as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < op.length; ++i) {
        op.item(i).classList.add("report-output");
      }
    }
    /* } else if (msg_type === "preview-input") {
     cell = window.my_panel.cell;
     cell.clear_input();
     cell.set_text(data);
     cell.clear_output();
   } else if (msg_type === "preview-kernel") {
     changeStyleOnKernel(window.my_panel.cell, data);
   */
  } else if (msg_type === "highlight-workflow") {
    let elem = document.getElementById(data[1]) as HTMLTextAreaElement;
    CodeMirror.fromTextArea(elem, {
      mode: "sos"
    });
    // if in a regular notebook, we use static version of the HTML
    // to replace the codemirror js version.
    if (data[0]) {
      let cell = panel.content.widgets.find(x => x.model.id == data[0]);

      let cm_node = elem.parentElement.lastElementChild;
      add_data_to_cell(
        cell,
        {
          output_type: "update_display_data",
          transient: { display_id: data[1] },
          metadata: {},
          data: {
            "text/html": cm_node.outerHTML
          }
        },
        data[1]
      );
      cm_node.remove();
    }
  } else if (msg_type === "tasks-pending") {
    let cell = panel.content.widgets[data[0]];
    info.pendingCells.set(cell.model.id, data[1]);
  } else if (msg_type === "remove-task") {
    let item = document.querySelector(`[id^="table_${data[0]}_${data[1]}"]`);
    if (item) {
      item.parentNode.removeChild(item);
    }
  } else if (msg_type === "task_status") {
    update_task_status(data, panel);
    if (data.status === "running") {
      update_duration();
    }
  } else if (msg_type == "workflow_status") {
    update_workflow_status(data, panel);
    if (data.status === "running") {
      update_duration();
    }
    // if this is a terminal status, try to execute the
    // next pending workflow
    if (
      data.status === "completed" ||
      data.status === "canceled" ||
      data.status === "failed"
    ) {
      // find all cell_ids with pending workflows
      let elems = document.querySelectorAll("[id^='status_duration_']");
      let pending = Array.from(elems)
        .filter(item => {
          return (
            item.className == "pending" && !item.id.substring(16).includes("_")
          );
        })
        .map(item => {
          return item.id.substring(16);
        });
      if (pending) {
        (<any>window).execute_workflow(pending);
      }
    }
  } else if (msg_type === "paste-table") {
    //let idx = panel.content.activeCellIndex;
    //let cm = panel.content.widgets[idx].editor;
    // cm.replaceRange(data, cm.getCursor());
  } else if (msg_type == "print") {
    let cell = panel.content.widgets.find(x => x.model.id == data[0]);

    (cell as CodeCell).outputArea.model.add({
      output_type: "stream",
      name: "stdout",
      text: data[1]
    });
  } else if (msg_type === "alert") {
    alert(data);
  } else if (msg_type === "notebook-version") {
    // right now no upgrade, just save version to notebook
    (panel.content.model.metadata.get("sos") as any)["version"] = data;
  }
}

function connectSoSComm(panel: NotebookPanel, renew: boolean = false) {
  let info = Manager.manager.get_info(panel);
  if (info.sos_comm && !renew) return;

  try {
    let sos_comm = panel.context.sessionContext.session?.kernel.createComm("sos_comm");
    if (!sos_comm) {
      console.log(`Failed to connect to sos_comm. Will try later.`)
      return null;
    }
    Manager.manager.register_comm(sos_comm, panel);
    sos_comm.open("initial");
    sos_comm.onMsg = on_frontend_msg;

    if (panel.content.model.metadata.has("sos")) {
      sos_comm.send({
        "notebook-version": (panel.content.model.metadata.get("sos") as any)[
          "version"
        ],
        "list-kernel": (panel.content.model.metadata.get("sos") as any)["kernels"]
      });
    } else {
      sos_comm.send({
        "notebook-version": "",
        "list-kernel": []
      });
    }

    console.log("sos comm registered");
  } catch (err) {
    // if the kernel is for the notebook console, an exception
    // 'Comms are disabled on this kernel connection' will be thrown
    console.log(err);
    return;
  }
}

function hideSoSWidgets(element: HTMLElement) {
  let sos_elements = element.getElementsByClassName(
    "sos-widget"
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].style.display = "none";
}

function showSoSWidgets(element: HTMLElement) {
  let sos_elements = element.getElementsByClassName(
    "sos-widget"
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].style.display = "";
}

(<any>window).task_action = async function (param) {
  if (!param.action) {
    return;
  }

  let commands = Manager.commands;
  let path = Manager.currentNotebook.context.path;

  let code =
    `%task ${param.action}` +
    (param.task ? ` ${param.task}` : "") +
    (param.tag ? ` -t ${param.tag}` : "") +
    (param.queue ? ` -q ${param.queue}` : "");

  await commands.execute("console:open", {
    activate: false,
    insertMode: "split-bottom",
    path
  });
  await commands.execute("console:inject", {
    activate: false,
    code,
    path
  });
};

(<any>window).cancel_workflow = function (cell_id) {
  console.log("Cancel workflow " + cell_id);
  let info = Manager.manager.get_info(Manager.currentNotebook);
  info.sos_comm.send({
    "cancel-workflow": [cell_id]
  });
};

(<any>window).execute_workflow = function (cell_ids) {
  console.log("Run workflows " + cell_ids);
  let info = Manager.manager.get_info(Manager.currentNotebook);
  info.sos_comm.send({
    "execute-workflow": cell_ids
  });
};

export class SoSWidgets
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  /**
   * The createNew function does not return whatever created. It is just a registery that Will
   * be called when a notebook is created/opened, and the toolbar is created. it is therefore
   * a perfect time to insert SoS language selector and create comms during this time.
   */
  createNew(
    panel: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): IDisposable {
    // register notebook to get language info, or get existing info
    // unfortunately, for new notebook, language info is currently empty
    let info = Manager.manager.get_info(panel);

    // this is a singleton class
    context.sessionContext.ready.then(() => {
      // kernel information (for opened notebook) should be ready at this time.
      // However, when the notebook is created from File -> New Notebook -> Select Kernel
      // The kernelPreference.name is not yet set and we have to use kernelDisplayName
      // which is SoS (not sos)
      let cur_kernel =
        panel.context.sessionContext.kernelPreference.name ||
        panel.context.sessionContext.kernelDisplayName;
      if (cur_kernel.toLowerCase() === "sos") {
        console.log(`session ready with kernel sos`);
        // if this is not a sos kernel, remove all buttons
        if (panel.content.model.metadata.has("sos")) {
          info.updateLanguages(
            (panel.content.model.metadata.get("sos") as any)["kernels"]
          );
        } else {
          panel.content.model.metadata.set("sos", {
            kernels: [["SoS", "sos", "", ""]],
            version: ""
          });
        }
        // connectSoSComm(panel);
        // wrapExecutor(panel);
        // updateCellStyles(panel, info);
        showSoSWidgets(panel.node);
      } else {
        hideSoSWidgets(panel.node);
      }
    });

    context.sessionContext.kernelChanged.connect(
      (sender: any, args: Session.ISessionConnection.IKernelChangedArgs) => {
        // somehow when the kernelChanged is sent, there could be no newValue?
        if (!args.newValue) {
          return;
        }
        console.log(`kernel changed to ${args.newValue.name}`);
        if (args.newValue.name === "sos") {
          if (panel.content.model.metadata.has("sos")) {
            info.updateLanguages(
              (panel.content.model.metadata.get("sos") as any)["kernels"]
            );
          } else {
            panel.content.model.metadata.set("sos", {
              kernels: [["SoS", "sos", "", ""]],
              version: ""
            });
          }
          // connectSoSComm(panel);
          // wrapExecutor(panel);
          // updateCellStyles(panel, info);
          showSoSWidgets(panel.node);
        } else {
          // in this case, the .sos_widget should be hidden
          hideSoSWidgets(panel.node);
        }
      }
    );

    context.sessionContext.statusChanged.connect((sender, status) => {
      // if a sos notebook is restarted
      if (
        (status === "busy" || status === "starting") &&
        panel.context.sessionContext.kernelDisplayName === "SoS"
      ) {
        connectSoSComm(panel);
        wrapExecutor(panel);
      }
    });

    panel.content.model.cells.changed.connect((list, changed) => {
      let cur_kernel =
        panel.context.sessionContext.kernelPreference.name ||
        panel.context.sessionContext.kernelDisplayName;
      if (cur_kernel.toLowerCase() === "sos") {
        each(changed.newValues, cellmodel => {
          let idx = changed.newIndex; // panel.content.widgets.findIndex(x => x.model.id == cellmodel.id);
          let cell = panel.content.widgets[idx];

          if (changed.type !== "add" && changed.type !== "set") {
            return;
          }
          let kernel = "SoS";
          if (cell.model.metadata.has("kernel")) {
            kernel = cell.model.metadata.get("kernel") as string;
          } else {
            // find the kernel of a cell before this one to determine the default
            // kernel of a new cell #18
            if (idx > 0) {
              for (idx = idx - 1; idx >= 0; --idx) {
                if (panel.content.widgets[idx].model.type === "code") {
                  kernel = panel.content.widgets[idx].model.metadata.get(
                    "kernel"
                  ) as string;
                  break;
                }
              }
            }
            cell.model.metadata.set("kernel", kernel);
          }
          addLanSelector(cell, info);
          changeStyleOnKernel(cell, kernel, info);
        });
      }
    });

    panel.content.activeCellChanged.connect((sender: any, cell: Cell) => {
      // this event is triggered both when a cell gets focus, and
      // also when a new notebook is created etc when cell does not exist
      if (cell && cell.model.type === "code" && info.sos_comm) {
        if (info.sos_comm.isDisposed) {
          // this happens after kernel restart #53
          connectSoSComm(panel, true);
        }
        let cell_kernel = cell.model.metadata.get("kernel") as string;
        info.sos_comm.send({
          "set-editor-kernel": cell_kernel
        });
      }
    });

    return new DisposableDelegate(() => { });
  }
}

function registerSoSWidgets(app: JupyterFrontEnd) {
  app.docRegistry.addWidgetExtension("Notebook", new SoSWidgets());
}


(<any>window).filterDataFrame = function (id) {
  var input = document.getElementById("search_" + id) as HTMLInputElement;;
  var filter = input.value.toUpperCase();
  var table = document.getElementById("dataframe_" + id) as HTMLTableElement;
  var tr = table.getElementsByTagName("tr");

  // Loop through all table rows, and hide those who do not match the search query
  for (var i = 1; i < tr.length; i++) {
    for (var j = 0; j < tr[i].cells.length; ++j) {
      var matched = false;
      if (tr[i].cells[j].innerHTML.toUpperCase().indexOf(filter) !== -1) {
        tr[i].style.display = "";
        matched = true;
        break;
      }
      if (!matched) {
        tr[i].style.display = "none";
      }
    }
  }
};

(<any>window).sortDataFrame = function (id, n, dtype) {
  var table = document.getElementById("dataframe_" + id) as HTMLTableElement;

  var tb = table.tBodies[0]; // use `<tbody>` to ignore `<thead>` and `<tfoot>` rows
  var tr = Array.prototype.slice.call(tb.rows, 0); // put rows into array

  var fn =
    dtype === "numeric"
      ? function (a, b) {
        return parseFloat(a.cells[n].textContent) <=
          parseFloat(b.cells[n].textContent)
          ? -1
          : 1;
      }
      : function (a, b) {
        var c = a.cells[n].textContent
          .trim()
          .localeCompare(b.cells[n].textContent.trim());
        return c > 0 ? 1 : c < 0 ? -1 : 0;
      };
  var isSorted = function (array, fn) {
    if (array.length < 2) {
      return 1;
    }
    var direction = fn(array[0], array[1]);
    for (var i = 1; i < array.length - 1; ++i) {
      var d = fn(array[i], array[i + 1]);
      if (d === 0) {
        continue;
      } else if (direction === 0) {
        direction = d;
      } else if (direction !== d) {
        return 0;
      }
    }
    return direction;
  };

  var sorted = isSorted(tr, fn);
  var i;

  if (sorted === 1 || sorted === -1) {
    // if sorted already, reverse it
    for (i = tr.length - 1; i >= 0; --i) {
      tb.appendChild(tr[i]); // append each row in order
    }
  } else {
    tr = tr.sort(fn);
    for (i = 0; i < tr.length; ++i) {
      tb.appendChild(tr[i]); // append each row in order
    }
  }
};

/**
 * Initialization data for the sos-extension extension.
 */
const PLUGIN_ID = 'jupyterlab-sos:plugin';
const extension: JupyterFrontEndPlugin<void> = {
  id: "vatlab/jupyterlab-extension:sos",
  autoStart: true,
  requires: [INotebookTracker, IConsoleTracker, ICommandPalette, ICodeMirror, ISettingRegistry],
  activate: async (
    app: JupyterFrontEnd,
    notebook_tracker: INotebookTracker,
    console_tracker: IConsoleTracker,
    palette: ICommandPalette,
    codeMirror: ICodeMirror,
    settingRegistry: ISettingRegistry | null,
  ) => {
    registerSoSFileType(app);
    registerSoSWidgets(app);
    Manager.set_trackers(notebook_tracker, console_tracker);
    Manager.set_commands(app.commands);

    if (settingRegistry) {
      const setting = await settingRegistry.load(PLUGIN_ID);
      Manager.manager.update_config(setting);
    }

    console_tracker.widgetAdded.connect((sender, panel) => {
      const labconsole = panel.console;

      labconsole.promptCellCreated.connect(panel => {
        if (Manager.currentNotebook) {
          let info = Manager.manager.get_info(Manager.currentNotebook);
          addLanSelector(panel.promptCell, info);
        }
      });
      labconsole.sessionContext.statusChanged.connect((sender, status: Kernel.Status) => {
        if (
          status == "busy" &&
          panel.console.sessionContext?.kernelDisplayName === "SoS"
        ) {
          console.log(`connected to sos kernel`);
          // connectSoSComm(panel, true);
          wrapConsoleExecutor(panel);
        }
      });
    });

    defineSoSCodeMirrorMode(codeMirror.CodeMirror);

    // add an command to toggle output
    const command_toggle_output: string = "sos:toggle_output";
    app.commands.addCommand(command_toggle_output, {
      label: "Toggle cell output tags",
      execute: () => {
        // get current notebook and toggle current cell
        toggleDisplayOutput(notebook_tracker.activeCell);
      }
    });

    // add an command to toggle output
    const command_toggle_kernel: string = "sos:toggle_kernel";
    app.commands.addCommand(command_toggle_kernel, {
      label: "Toggle cell kernel",
      execute: () => {
        // get current notebook and toggle current cell
        toggleCellKernel(notebook_tracker.activeCell,
          notebook_tracker.currentWidget);
      }
    });

    // add an command to toggle output
    const command_toggle_markdown: string = "sos:toggle_markdown";
    app.commands.addCommand(command_toggle_markdown, {
      label: "Toggle cell kernel",
      execute: () => {
        // get current notebook and toggle current cell
        toggleMarkdownCell(notebook_tracker.activeCell,
          notebook_tracker.currentWidget);
      }
    });
    // app.commands.addKeyBinding({
    //   keys: ["Ctrl Shift O"],
    //   selector: ".jp-Notebook.jp-mod-editMode",
    //   command: "sos:toggle_output"
    // });
    // app.commands.addKeyBinding({
    //   keys: ["Ctrl Shift Enter"],
    //   selector: ".jp-Notebook.jp-mod-editMode",
    //   command: "notebook:run-in-console"
    // });

    // Add the command to the palette.
    palette.addItem({ command: command_toggle_output, category: "Cell output" });
    palette.addItem({ command: command_toggle_kernel, category: "Toggle kernel" });
    palette.addItem({ command: command_toggle_markdown, category: "Toggle markdown" });

    console.log("JupyterLab extension sos-extension is activated!");
  }
};

export default extension;
