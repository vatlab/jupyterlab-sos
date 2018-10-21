import {
  JupyterLab,
  JupyterLabPlugin
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
  addLanSelector,
  updateCellStyles,
  changeCellKernel,
  changeStyleOnKernel,
  saveKernelInfo
} from './selectors';

import {
  wrapExecutor
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

function registerSoSFileType(app: JupyterLab) {
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

// add workflow status indicator table
function update_workflow_status(info, panel) {
    console.log(info);

    // find the cell
    let cell_id = info.cell_id
    let cell = panel.content.widgets.find(x => x.model.id == cell_id);
    if (!cell) {
        console.log(`Cannot find cell by ID ${info.cell_id}`)
        return;
    }

    // find the status table
    let status_table = document.getElementById(`workflow_${cell_id}`);
    // if there is no status table, create one
    // the easiest method seems to be adding display_data
    if (!status_table) {
        let data = {
            'output_type': 'display_data',
            'metadata': {},
            'data': {
                'text/html': `
<table id="workflow_${cell_id}" class="workflow_table  ${info.status}">
  <tr>
        <td class="workflow_icon">
          <i id="workflow_status_icon_${cell_id}" class="fa fa-2x fa-fw fa-square-o"></i>
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
          <pre><i class="fa fa-fw fa-clock-o"></i><time id="status_duration_${cell_id}" class="${info.status}" datetime="${info.start_time}"></time></pre>
        </td>
  </tr>
</table>
` }
        }
        cell.outputArea.model.add(data);
    } else {
      // existing table ...
      let table = document.getElementById(`workflow_${cell_id}`);
      if (table) {
          table.className = `workflow_table ${info.status}`;
      }
      let timer = document.getElementById(`status_duration_${cell_id}`);
      if (timer) {
          timer.className = info.status;
          if (info.start_time) {
            timer.setAttribute('datetime', (info.start_time * 1000).toString());
          }
          if (timer.innerText === '' && (info.status === 'completed' || info.status === 'failed' || info.status === 'aborted')) {
            timer.innerText = 'Ran for < 5 seconds'
          }
      }
      let text = document.getElementById(`status_text_${cell_id}`);
      if (text) {
          text.innerText = info.status;
      }
      // if new id is specified
      if (info.workflow_id) {
        let wid = document.getElementById(`workflow_id_${cell_id}`);
        if (wid) {
            wid.innerText = info.workflow_id;
        }
      }
      if (info.workflow_name) {
        let wname = document.getElementById(`workflow_name_${cell_id}`);
        if (wname) {
            wname.innerText = info.workflow_name;
        }
      }
      // if there is additional message, put it under timer.
      if (info.index) {
        let index = document.getElementById(`workflow_index_${cell_id}`);
        if (index) {
            index.innerText = info.index;
        }
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
    let icon = document.getElementById(`workflow_status_icon_${cell_id}`);
    if (icon) {
      icon.className = `fa fa-2x fa-fw ${status_class[info.status]}`;

      if (info.status === 'running') {
          icon.onmouseover = function(e) {
            e.srcElement.className = `fa fa-2x fa-fw fa-stop`;
          };
          icon.onmouseleave = function(e) {
            e.srcElement.className = `fa fa-2x fa-fw ${status_class["running"]}`;
          };
          icon.onclick = function(e) {
              (<any>window).cancel_workflow(e.srcElement.id.substring(21));
          };
      } else {
        icon.onmouseover = function() {};
        icon.onmouseleave = function() {};
        icon.onclick = function() {};
      }
    }
}


function update_task_status(info, panel) {
  // find the cell
  //console.log(info);

  let elem_id = `${info.queue}_${info.task_id}`

  // find the status table
  let status_table = document.getElementById(`task_${elem_id}`);

  if (!status_table) {
      let cell_id = info.cell_id
      if (!cell_id) {
        return;
      }
      let cell = panel.content.widgets.find(x => x.model.id == cell_id);
      if (!cell) {
        console.log(`Cannot find cell by ID ${info.cell_id}`)
        return;
      }

      let data = {
          'output_type': 'display_data',
          'metadata': {},
          'data': {
              'text/html': `
<table id="task_${elem_id}" class="task_table  ${info.status}">
  <tr>
        <td class="task_icon">
          <i id="task_status_icon_${elem_id}" class="fa fa-2x fa-fw fa-square-o"></i>
        </td>
        <td class="task_id">
          <a href='#' onclick="task_info('${info.task_id}', '${info.queue}')">
          <pre><i class="fa fa-fw fa-sitemap"></i>${info.task_id}</pre>
          </a>
        </td>
        <td class="task_timer">
          <pre><i class="fa fa-fw fa-clock-o"></i><time id="status_duration_${elem_id}" class="${info.status}" datetime="${info.start_time}"></time></pre>
        </td>
        <td class="task_status">
          <pre><i class="fa fa-fw fa-tasks"></i><span id="status_text_${elem_id}">${info.status}</span></pre>
        </td>
  </tr>
</table>
`
          }
      }
      cell.outputArea.model.add(data);
  } else {
    // existing table ...
    let table = document.getElementById(`task_${elem_id}`);
    if (table) {
        table.className = `task_table ${info.status}`;
    }
    let timer = document.getElementById(`status_duration_${elem_id}`);
    if (timer) {
        timer.className = info.status;
        if (info.start_time) {
          timer.setAttribute('datetime', (info.start_time * 1000).toString());
        }
        if (timer.innerText === '' && (info.status === 'completed' || info.status === 'failed' || info.status === 'aborted')) {
          timer.innerText = 'Ran for < 5 seconds'
        }
    }
    let text = document.getElementById(`status_text_${elem_id}`);
    if (text) {
        text.innerText = info.status;
    }
  }

  let action_class = {
      'pending': 'fa-stop',
      'submitted': 'fa-stop',
      'running': 'fa-stop',
      'completed': 'fa-play',
      'failed': 'fa-play',
      'aborted': 'fa-play',
      'missing': 'fa-question',
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

  let action_func = {
      'pending': (<any>window).kill_task,
      'submitted': (<any>window).kill_task,
      'running': (<any>window).kill_task,
      'completed': (<any>window).resume_task,
      'failed': (<any>window).resume_task,
      'aborted': (<any>window).resume_task,
      'missing': function(){},
  }

  // look for status etc and update them.
  let icon = document.getElementById(`task_status_icon_${elem_id}`);
  if (icon) {
    icon.className = `fa fa-2x fa-fw ${status_class[info.status]}`;

    icon.onmouseover = function(e) {
      let status = document.getElementById('status_duration_' + e.srcElement.id.substring(17)).className;
      e.srcElement.className = `fa fa-2x fa-fw ${action_class[status]}`;
    };
    icon.onmouseleave = function(e) {
      let status = document.getElementById('status_duration_' + e.srcElement.id.substring(17)).className;
      console.log(`laving ${status}`)
      e.srcElement.className = `fa fa-2x fa-fw ${status_class[status]}`;
    };
    icon.onclick = function(e) {
      let status = document.getElementById('status_duration_' + e.srcElement.id.substring(17)).className;
      let elem_id = e.srcElement.id.substring(17)
      let task_id = elem_id.split('_').pop()
      let task_queue = elem_id.split('_').slice(0, -1).join('_');
      action_func[status](task_id, task_queue);
    };
  }
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
    if (data[0] === "")
      return;
    let cell = panel.content.widgets.find(x => x.model.id == data[0]);
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
   } else if (msg_type === "highlight-workflow") {
     //cell = window.my_panel.cell;
     //cell.clear_input();
     //cell.set_text("%preview --workflow");
     //cell.clear_output();
     //cell.output_area.append_output({
     //    "output_type": "display_data",
     //    "metadata": {},
     //    "data": {
     //             "text/html": "<textarea id='panel_preview_workflow'>" + data + "</textarea>"
     //    }
     //});
     // <textarea id="side_panel_code">{}</textarea>'
     CodeMirror.fromTextArea(document.getElementById(data), {
       "mode": "sos",
       "theme": "ipython"
     })
    */
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

(<any>window).kill_task = function(task_id: string, task_queue: string) {
  console.log("Kill " + task_id);
  let info = Manager.manager.get_info(Manager.currentNotebook);
  info.sos_comm.send({
    "kill-task": [task_id, task_queue],
  });
};

(<any>window).resume_task = function(task_id: string, task_queue: string) {
  console.log("Resume " + task_id);
  let info = Manager.manager.get_info(Manager.currentNotebook);
  info.sos_comm.send({
    "resume-task": [task_id, task_queue],
  });
};

(<any>window).task_info = function(task_id: string, task_queue: string) {
  // step 1: find the item with task_id, then the panel that contains the element
  console.log("Task info " + task_id);
  let info = Manager.manager.get_info(Manager.currentNotebook);
  info.sos_comm.send({
    "task-info": [task_id, task_queue],
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

function registerSoSWidgets(app: JupyterLab) {
  app.docRegistry.addWidgetExtension('Notebook', new SoSWidgets());
}

/**
 * Initialization data for the sos-extension extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'sos-extension',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterLab, tracker: INotebookTracker) => {
    registerSoSFileType(app);
    registerSoSWidgets(app);
    Manager.set_tracker(tracker);
    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
