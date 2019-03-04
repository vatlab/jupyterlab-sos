import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  each
} from '@phosphor/algorithm';

import {
  IDisposable,
  DisposableDelegate
} from '@phosphor/disposable';

import {
  Cell, CodeCell
} from '@jupyterlab/cells';

import { Session } from '@jupyterlab/services';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  KernelMessage
} from '@jupyterlab/services';

import {
  NotebookPanel,
  INotebookModel,
  INotebookTracker
} from '@jupyterlab/notebook';

import {
  IConsoleTracker
} from '@jupyterlab/console';

import * as CodeMirror from 'codemirror';

import {
  addLanSelector,
  updateCellStyles,
  changeCellKernel,
  changeStyleOnKernel,
  saveKernelInfo
} from './selectors';

import {
  wrapExecutor,
  wrapConsoleExecutor
} from './execute'

// define and register SoS CodeMirror mode
import './codemirror-sos'

import '../style/index.css';

import {
  Manager
} from "./manager"

/*
 * Define SoS File msg_type
 */
const SOS_MIME_TYPE = 'text/x-sos'

function registerSoSFileType(app: JupyterFrontEnd) {
  app.docRegistry.addFileType({
    name: 'SoS',
    displayName: 'SoS File',
    extensions: ['.sos'],
    mimeTypes: [SOS_MIME_TYPE],
    iconClass: 'jp-MaterialIcon sos_icon',
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
  setInterval(function() {
    document.querySelectorAll("[id^='status_duration_']").forEach(
      (item: HTMLElement) => {
        if (item.className != 'running') {
          return
        }
        item.innerText = 'Ran for ' + formatDuration(+new Date() - +new Date(parseFloat(item.getAttribute("datetime"))));
      }
    );
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
  for (let idx=0; idx < cell.outputArea.model.length; ++idx ) {
    let output = cell.outputArea.model.get(idx);
    if (output.type != 'display_data' || !output.data['text/html']) {
      continue;
    }
    // the HTML should look like
    // <table id="task_macpro_90775d4e30583c18" class="task_table running">
    if (!output.data || !output.data['text/html']) {
      continue;
    }
    let id = output.data['text/html'].match(/id="([^"]*)"/);
    if (!id || !id[1]) {
      continue;
    }
    let targets = cell.outputArea._displayIdMap.get(id[1]) || [];
    targets.push(idx);
    cell.outputArea._displayIdMap.set(id[1], targets);
  }
}


function add_data_to_cell(cell, data, display_id) {
  if (data.output_type === 'update_display_data') {
    fix_display_id(cell);
    let targets = cell.outputArea._displayIdMap.get(display_id);
    if (!targets) {
      // something wrong
      console.log('Failed to rebuild displayIdMap')
      return
    }
    data.output_type = 'display_data'
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
  let cell_id = info.cell_id
  let cell = panel.content.widgets.find(x => x.model.id == cell_id);
  if (!cell) {
      console.log(`Cannot find cell by ID ${info.cell_id}`)
      return;
  }

  // if there is an existing status table, try to retrieve its information
  // if the new data does not have it
  let has_status_table = document.getElementById(`workflow_${cell_id}`);
  if (!has_status_table && info.status != 'pending') {
    return;
  }
  let timer_text = '';
  if (info.start_time) {
    // convert from python time to JS time.
    info.start_time = info.start_time * 1000;
  }
  if (info.status == 'purged') {
    if (!has_status_table) {
      return;
    }
    let data = {
      'output_type': 'update_display_data',
      'transient': {'display_id': `workflow_${cell_id}`},
      'metadata': {},
      'data': {
          'text/html': ''
      }
    }
    add_data_to_cell(cell, data, `workflow_${cell_id}`);
  }
  if (has_status_table) {
    // if we already have timer, let us try to "fix" it in the notebook
    let timer = document.getElementById(`status_duration_${cell_id}`);
    timer_text = timer.innerText;
    if (timer_text === '' && (info.status === 'completed' || info.status === 'failed' || info.status === 'aborted')) {
      timer_text = 'Ran for < 5 seconds'
    }
    if (!info.start_time) {
      info.start_time = timer.getAttribute('datetime');
    }
    //
    if (!info.workflow_id) {
      info.workflow_id = document.getElementById(`workflow_id_${cell_id}`).innerText;
    }
    if (!info.workflow_name) {
      info.workflow_name = document.getElementById(`workflow_name_${cell_id}`).innerText;
    }
    if (!info.index) {
      info.index = document.getElementById(`workflow_index_${cell_id}`).innerText;
    }
  }
  // new and existing, check icon
  let status_class = {
      'pending': 'fa-square-o',
      'running': 'fa-spinner fa-pulse fa-spin',
      'completed': 'fa-check-square-o',
      'failed': 'fa-times-circle-o',
      'aborted': 'fa-frown-o',
  }

  // look for status etc and update them.
  let onmouseover = `onmouseover='this.classList="fa fa-2x fa-fw fa-trash"'`;
  let onmouseleave = `onmouseleave='this.classList="fa fa-2x fa-fw ${status_class[info.status]}"'`;
  let onclick = `onclick="cancel_workflow(this.id.substring(21))"`;

  let data = {
    'output_type': has_status_table ? 'update_display_data': 'display_data',
    'transient': {'display_id': `workflow_${cell_id}`},
    'metadata': {},
    'data': {
        'text/html': `
<table id="workflow_${cell_id}" class="workflow_table  ${info.status}">
<tr>
      <td class="workflow_icon">
        <i id="workflow_status_icon_${cell_id}" class="fa fa-2x fa-fw ${status_class[info.status]}"
        ${onmouseover} ${onmouseleave} ${onclick}></i>
      </td>
      <td class="workflow_name">
        <pre><span id="workflow_name_${cell_id}">${info.workflow_name}</span></pre>
      </td>
      <td class="workflow_id">
        <span>Workflow ID</span></br>
        <pre><i class="fa fa-fw fa-sitemap"></i><span id="workflow_id_${cell_id}">${info.workflow_id}</span></pre>
      </td>
      <td class="workflow_index">
        <span>Index</span></br>
        <pre>#<span id="workflow_index_${cell_id}">${info.index}</span></pre>
      </td>
      <td class="workflow_status">
        <span id="status_text_${cell_id}">${info.status}</span></br>
        <pre><i class="fa fa-fw fa-clock-o"></i><time id="status_duration_${cell_id}" class="${info.status}" datetime="${info.start_time}">${timer_text}</time></pre>
      </td>
</tr>
</table>
`   }
  }
  add_data_to_cell(cell, data, `workflow_${cell_id}`);
}


function update_task_status(info, panel) {
  // find the cell
  //console.log(info);
  // special case, purge by tag, there is no task_id
  if (!info.task_id && info.tag && info.status == 'purged') {
    // find all elements by tag
    let elems = document.getElementsByClassName(`task_tag_${info.tag}`);
    if (!elems) {
      return;
    }
    let cell_elems = Array.from(elems).map(x => x.closest('.code_cell'));
    let cells = cell_elems.map(cell_elem => panel.content.widgets.find(x => x.node[0] == cell_elem));
    let display_ids = Array.from(elems).map(x => x.closest('.task_table').id);

    for (let i = 0; i < cells.length; ++i) {
      let data = {
        'output_type': 'update_display_data',
        'transient': {'display_id': display_ids[i]},
        'metadata': {},
        'data': {
            'text/html': ''
        }
      }
      add_data_to_cell(cells[i], data, display_ids[i]);
    }
    return;
  }

  let elem_id = `${info.queue}_${info.task_id}`
  // convert between Python and JS float time
  if (info.start_time) {
    info.start_time = info.start_time * 1000;
  }
  // find the status table
  let has_status_table = document.getElementById(`task_${elem_id}`);
  if (info.update_only && !has_status_table) {
    return;
  }
  let cell_id = info.cell_id
  let cell = null;
  if (cell_id) {
    cell = panel.content.widgets.find(x => x.model.id == cell_id);
  } else if (has_status_table) {
    let elem = has_status_table.closest('.code_cell');
    cell = panel.content.widgets.find(x => x.node[0] == elem);
  }

  if (!cell) {
    console.log(`Cannot find cell by ID ${info.cell_id}`)
    return;
  }

  if (info.status == 'purged') {
    if (has_status_table) {
      let data = {
        'output_type': 'update_display_data',
        'transient': {'display_id': `task_${elem_id}`},
        'metadata': {},
        'data': {
            'text/html': ''
        }
      }
      add_data_to_cell(cell, data, `task_${elem_id}`);
    }
    return;
  }
  // if there is an existing status table, try to retrieve its information
  // the new data does not have it
  let timer_text = '';
  if (has_status_table) {
    // if we already have timer, let us try to "fix" it in the notebook
    let timer = document.getElementById(`status_duration_${elem_id}`);
    timer_text = timer.innerText;
    if (timer_text === '' && (info.status === 'completed' || info.status === 'failed' || info.status === 'aborted')) {
      timer_text = 'Ran for < 5 seconds'
    }
    if (!info.start_time) {
      info.start_time = timer.getAttribute('datetime');
    }
    if (!info.tags) {
      info.tags = document.getElementById(`status_tags_${elem_id}`).innerText;
    }
  }

  let status_class = {
      'pending': 'fa-square-o',
      'submitted': 'fa-spinner',
      'running': 'fa-spinner fa-pulse fa-spin',
      'completed': 'fa-check-square-o',
      'failed': 'fa-times-circle-o',
      'aborted': 'fa-frown-o',
      'missing': 'fa-question',
  }

  // look for status etc and update them.
  let id_elems = `<pre>${info.task_id}` +
    `<div class="task_id_actions">` +
    `<i class="fa fa-fw fa-refresh" onclick="task_action({action:'status', task:'${info.task_id}', queue: '${info.queue}'})"></i>` +
    `<i class="fa fa-fw fa-play" onclick="task_action({action:'execute', task:'${info.task_id}', queue: '${info.queue}'})"></i>` +
    `<i class="fa fa-fw fa-stop"" onclick="task_action({action:'kill', task:'${info.task_id}', queue: '${info.queue}'})"></i>` +
    `<i class="fa fa-fw fa-trash"" onclick="task_action({action:'purge', task:'${info.task_id}', queue: '${info.queue}'})"></i>` +
    `</div></pre>`;

  let tags = info.tags.split(/\s+/g);
  let tags_elems = ''
  for (let ti=0; ti < tags.length; ++ti) {
    let tag = tags[ti];
    if (!tag) {
      continue;
    }
    tags_elems += `<pre class="task_tags task_tag_${tag}">${tag}` +
      `<div class="task_tag_actions">` +
      `<i class="fa fa-fw fa-refresh" onclick="task_action({action:'status', tag:'${tag}', queue: '${info.queue}'})"></i>` +
      `<i class="fa fa-fw fa-stop"" onclick="task_action({action:'kill', tag:'${tag}', queue: '${info.queue}'})"></i>` +
      `<i class="fa fa-fw fa-trash"" onclick="task_action({action:'purge', tag:'${tag}', queue: '${info.queue}'})"></i>` +
      `</div></pre>`;
  }


  let data = {
    'output_type': has_status_table ? 'update_display_data': 'display_data',
    'transient': {'display_id': `task_${elem_id}`},
    'metadata': {},
    'data': {
        'text/html': `
<table id="task_${elem_id}" class="task_table ${info.status}">
<tr>
  <td class="task_icon">
    <i id="task_status_icon_${elem_id}" class="fa fa-2x fa-fw ${status_class[info.status]}"
    ${onmouseover} ${onmouseleave} ${onclick}></i>
  </td>
  <td class="task_id">
    <span><pre><i class="fa fa-fw fa-sitemap"></i></pre>${id_elems}</span>
  </td>
  <td class="task_tags">
    <span id="status_tags_${elem_id}"><pre><i class="fa fa-fw fa-info-circle"></i></pre>${tags_elems}</span>
  </td>
  <td class="task_timer">
    <pre><i class="fa fa-fw fa-clock-o"></i><time id="status_duration_${elem_id}" class="${info.status}" datetime="${info.start_time}">${timer_text}</time></pre>
  </td>
  <td class="task_status">
    <pre><i class="fa fa-fw fa-tasks"></i><span id="status_text_${elem_id}">${info.status}</span></pre>
  </td>
</tr>
</table>
`
    }
  }
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
      })
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
    if (cell.model.metadata.get('kernel') !== info.DisplayName.get(data[1])) {
      changeCellKernel(cell, info.DisplayName.get(data[1]), info);
      saveKernelInfo();
    } else if (cell.model.metadata.get('tags') &&
      (cell.model.metadata.get('tags') as Array<string>).indexOf("report_output") >= 0) {
      // #639
      // if kernel is different, changeStyleOnKernel would set report_output.
      // otherwise we mark report_output
      let op = cell.node.getElementsByClassName('jp-Cell-outputWrapper') as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < op.length; ++i) {
        op.item(i).classList.add('report-output');
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
      "mode": "sos"
    })
    // if in a regular notebook, we use static version of the HTML
    // to replace the codemirror js version.
    if (data[0]) {
      let cell = panel.content.widgets.find(x => x.model.id == data[0]);

      let cm_node = elem.parentElement.lastElementChild;
      add_data_to_cell(cell, {
        'output_type': 'update_display_data',
        'transient': {'display_id': data[1]},
        'metadata': {},
        'data': {
            'text/html': cm_node.outerHTML
        }
      }, data[1]);
      cm_node.remove();
    }
  } else if (msg_type === "tasks-pending") {
    let cell = panel.content.widgets[data[0]];
    info.pendingCells.set(cell.model.id, data[1]);
  } else if (msg_type === "remove-task") {
    let item = document.getElementById("table_" + data[0] + "_" + data[1]);
    if (item) {
      item.parentNode.removeChild(item);
    }
  } else if (msg_type === "task_status") {
    update_task_status(data, panel);
    if (data.status === 'running') {
      update_duration();
    }
  } else if (msg_type == 'workflow_status') {
    update_workflow_status(data, panel);
    if (data.status === 'running') {
      update_duration();
    }
    // if this is a terminal status, try to execute the
    // next pending workflow
    if (data.status === 'completed' || data.status === 'canceled' || data.status === 'failed') {
      // find all cell_ids with pending workflows
      let elems = document.querySelectorAll("[id^='status_duration_']");
      let pending = Array.from(elems).filter(
        (item) => {
          return  item.className == 'pending' && !   item.id.substring(16).includes('_');
        }
      ).map( (item) => {
        return item.id.substring(16);
      } )
      if (pending) {
        (<any>window).execute_workflow(pending);
      }
    }
  } else if (msg_type === "paste-table") {
    //let idx = panel.content.activeCellIndex;
    //let cm = panel.content.widgets[idx].editor;
    // cm.replaceRange(data, cm.getCursor());
  } else if (msg_type == 'print') {

    let cell = panel.content.widgets.find(x => x.model.id == data[0]);

    (cell as CodeCell).outputArea.model.add({
      'output_type': 'stream',
      'name': 'stdout',
      'text': data[1]
    })
  } else if (msg_type === 'alert') {
    alert(data);
  } else if (msg_type === 'notebook-version') {
    // right now no upgrade, just save version to notebook
    (panel.content.model.metadata.get("sos") as any)["version"] = data;
  } else if (msg_type === 'clear-output') {
    // console.log(data)
    let active: Cell[] = [];
    each(panel.content.widgets, child => {
      if (panel.content.isSelectedOrActive(child)) {
        active.push(child);
      }
    });

    let clear_task = function(cell: Cell, status: string) {
      let status_element = cell.node.getElementsByClassName(status);
      while (status_element.length > 0) {
        let table_element = status_element[0].parentNode.parentNode.parentNode.parentElement;
        // remove the table
        if (table_element.className == 'task_table') {
          table_element.parentElement.removeChild(table_element);
        }
      }
    }
    let clear_class = function(cell: Cell, element_class: string) {
      let elements = cell.node.getElementsByClassName(element_class);
      while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
        elements = cell.node.getElementsByClassName(element_class);
      }
    }
    // if remove all
    if (data[1]) {
      let cells = panel.content.widgets;
      let i;
      let j;
      for (i = 0; i < cells.length; ++i) {
        if (cells[i].model.type != "code")
          continue;
        if (data[2]) {
          for (j = 0; j < data[2].length; ++j) {
            clear_task(cells[i], data[2][j]);
          }
        } else if (data[3]) {
          for (j = 0; j < data[3].length; ++j) {
            clear_class(cells[i], data[3][j]);
          }
        } else {
          (cells[i] as CodeCell).outputArea.model.clear();
        }
      }
    } else if (data[0] === -1) {
      // clear output of selected cells
      let i;
      let j;
      for (i = 0; i < active.length; ++i) {
        if (active[i].model.type != "code")
          continue;
        if (data[2]) {
          for (j = 0; j < data[2].length; ++j) {
            clear_task(active[i], data[2][j]);
          }
        } else if (data[3]) {
          for (j = 0; j < data[3].length; ++j) {
            clear_class(active[i], data[3][j]);
          }
        } else {
          (active[i] as CodeCell).outputArea.model.clear();
        }
      }
    } else if (panel.content.widgets[data[0]].model.type === "code") {
      // clear current cell
      let j;
      if (data[2]) {
        for (j = 0; j < data[2].length; ++j) {
          clear_task(panel.content.widgets[data[0]], data[2][j]);
        }
      } else if (data[3]) {
        for (j = 0; j < data[3].length; ++j) {
          clear_class(panel.content.widgets[data[0]], data[3][j]);
        }
      } else {
        (panel.content.widgets[data[0]] as CodeCell).outputArea.model.clear();
      }
    }
    /*
    if (active.length > 0) {
        nb.select(active[0]);
     } else {
        // this is preview output
        cell = window.my_panel.cell;
        data.output_type = msg_type;
        cell.output_area.append_output(data);
    } */
  }
}

function connectSoSComm(panel: NotebookPanel, renew: boolean = false) {
  let info = Manager.manager.get_info(panel);
  if (info.sos_comm && !renew)
    return;

  let sos_comm = panel.context.session.kernel.connectToComm("sos_comm");

  Manager.manager.register_comm(sos_comm, panel);
  sos_comm.open('initial');
  sos_comm.onMsg = on_frontend_msg;

  if (panel.content.model.metadata.has('sos')) {
    sos_comm.send({
      "notebook-version": (panel.content.model.metadata.get('sos') as any)['version'],
      "list-kernel": (panel.content.model.metadata.get('sos') as any)['kernels']
    });
  } else {
    sos_comm.send({
      "notebook-version": "",
      "list-kernel": []
    });
  }

  console.log("sos comm registered");
}

function hideSoSWidgets(element: HTMLElement) {
  let sos_elements = element.getElementsByClassName('sos-widget') as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].style.display = 'none';
}

function showSoSWidgets(element: HTMLElement) {
  let sos_elements = element.getElementsByClassName('sos-widget') as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].style.display = '';
}

(<any>window).task_action = async function(param) {
  if (!param.action) {
    return;
  }

  let commands = Manager.commands;
  let path = Manager.currentNotebook.context.path;

  let code = `%task ${param.action}` +
    (param.task ? ` ${param.task}` : '') +
    (param.tag ? ` -t ${param.tag}` : '') +
    (param.queue ? ` -q ${param.queue}` : '');

  await commands.execute('console:open', {
    activate: false,
    insertMode: 'split-bottom',
    path
  });
  await commands.execute('console:inject', {
    activate: false,
    code,
    path
  });

};

(<any>window).cancel_workflow = function(cell_id) {
    console.log("Cancel workflow " + cell_id);
    let info = Manager.manager.get_info(Manager.currentNotebook);
    info.sos_comm.send({
      "cancel-workflow": [cell_id],
    });
  };

(<any>window).execute_workflow = function(cell_ids) {
    console.log("Run workflows " + cell_ids);
    let info = Manager.manager.get_info(Manager.currentNotebook);
    info.sos_comm.send({
      "execute-workflow": cell_ids,
    });
  };

export
  class SoSWidgets implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  /**
   * The createNew function does not return whatever created. It is just a registery that Will
   * be called when a notebook is created/opened, and the toolbar is created. it is therefore
   * a perfect time to insert SoS language selector and create comms during this time.
   */
  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
    // register notebook to get language info, or get existing info
    // unfortunately, for new notebook, language info is currently empty
    let info = Manager.manager.get_info(panel);

    // this is a singleton class
    context.session.ready.then(
      () => {
        // kernel information (for opened notebook) should be ready at this time.
        // However, when the notebook is created from File -> New Notebook -> Select Kernel
        // The kernelPreference.name is not yet set and we have to use kernelDisplayName
        // which is SoS (not sos)
        let cur_kernel = panel.context.session.kernelPreference.name || panel.context.session.kernelDisplayName;
        if (cur_kernel.toLowerCase() === 'sos') {
          console.log(`session ready with kernel sos`)
          // if this is not a sos kernel, remove all buttons
          if (panel.content.model.metadata.has('sos')) {
            info.updateLanguages((panel.content.model.metadata.get('sos') as any)['kernels']);
          } else {
            panel.content.model.metadata.set('sos',
              {
                'kernels': [['SoS', 'sos', '', '']],
                'version': ''
              })
          }
          // connectSoSComm(panel);
          // wrapExecutor(panel);
          // updateCellStyles(panel, info);
          showSoSWidgets(panel.node);
        } else {
          hideSoSWidgets(panel.node);
        }
      }
    );

    context.session.kernelChanged.connect((sender: any, args: Session.IKernelChangedArgs) => {
      console.log(`kernel changed to ${args.newValue.name}`)
      if (args.newValue.name === 'sos') {
        if (panel.content.model.metadata.has('sos')) {
          info.updateLanguages((panel.content.model.metadata.get('sos') as any)['kernels']);
        } else {
          panel.content.model.metadata.set('sos',
            {
              'kernels': [['SoS', 'sos', '', '']],
              'version': ''
            })
        }
        // connectSoSComm(panel);
        // wrapExecutor(panel);
        // updateCellStyles(panel, info);
        showSoSWidgets(panel.node);
      } else {
        // in this case, the .sos_widget should be hidden
        hideSoSWidgets(panel.node);
      }
    });

    context.session.statusChanged.connect((sender, status) => {
      // if a sos notebook is restarted
      if (status === 'connected' && panel.context.session.kernelDisplayName === "SoS") {
        console.log(`connected to sos kernel`)
        connectSoSComm(panel, true);
        wrapExecutor(panel);
      }
    });

    panel.content.model.cells.changed.connect((list, changed) => {
      let cur_kernel = panel.context.session.kernelPreference.name || panel.context.session.kernelDisplayName;
      if (cur_kernel.toLowerCase() === 'sos') {
        each(changed.newValues, cellmodel => {
          let idx = changed.newIndex; // panel.content.widgets.findIndex(x => x.model.id == cellmodel.id);
          let cell = panel.content.widgets[idx];

          if (changed.type !== 'add' && changed.type !== 'set') {
            return;
          }
          let kernel = 'SoS';
          if (cell.model.metadata.has('kernel')) {
            kernel = cell.model.metadata.get('kernel') as string;
          } else {
            // find the kernel of a cell before this one to determine the default
            // kernel of a new cell #18
            if (idx > 0) {
              for (idx = idx - 1; idx >= 0; --idx) {
                if (panel.content.widgets[idx].model.type === 'code') {
                  kernel = panel.content.widgets[idx].model.metadata.get('kernel') as string;
                  break;
                }
              }
            }
            cell.model.metadata.set('kernel', kernel);
          }
          addLanSelector(cell, info);
          changeStyleOnKernel(cell, kernel, info);
        });
      }
    });

    panel.content.activeCellChanged.connect((sender: any, cell: Cell) => {
      // this event is triggered both when a cell gets focus, and
      // also when a new notebook is created etc when cell does not exist
      if (cell && cell.model.type === 'code' && info.sos_comm) {
        let cell_kernel = cell.model.metadata.get('kernel');
        info.sos_comm.send({
          'set-editor-kernel': cell_kernel
        });
      }
    });

    return new DisposableDelegate(() => { });
  }
}

function registerSoSWidgets(app: JupyterFrontEnd) {
  app.docRegistry.addWidgetExtension('Notebook', new SoSWidgets());
}

/**
 * Initialization data for the sos-extension extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'vatlab/jupyterlab-extension:sos',
  autoStart: true,
  requires: [INotebookTracker, IConsoleTracker],
  activate: (app: JupyterFrontEnd, notebook_tracker: INotebookTracker, console_tracker: IConsoleTracker) => {
    registerSoSFileType(app);
    registerSoSWidgets(app);
    Manager.set_trackers(notebook_tracker, console_tracker);
    Manager.set_commands(app.commands);

    console_tracker.widgetAdded.connect((sender, panel) => {
      const labconsole = panel.console;
      labconsole.session.statusChanged.connect((sender, status) => {
        if (status === 'connected' && panel.console.session.kernelDisplayName === "SoS") {
          console.log(`connected to sos kernel`)
          // connectSoSComm(panel, true);
          wrapConsoleExecutor(panel);
        }
      });

    });

    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
