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

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  KernelMessage
} from '@jupyterlab/services';

import {
  NotebookPanel,
  INotebookModel
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

function formatDuration(start_date: Date): string {
  let ms: number = +new Date() - +start_date;
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
    let cell = panel.notebook.widgets.find(x => x.model.id == data[0]);
    if (cell.model.metadata.get('kernel') !== info.DisplayName[data[1]]) {
      changeCellKernel(cell, info.DisplayName[data[1]], info);
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
    let cell = panel.notebook.widgets[data[0]];
    info.pendingCells.set(cell.model.id, data[1]);
  } else if (msg_type === "remove-task") {
    let item = document.getElementById("table_" + data[0] + "_" + data[1]);
    if (item) {
      item.parentNode.removeChild(item);
    }
  } else if (msg_type === "update-duration") {
    setInterval(function() {
      let tasks = document.querySelectorAll('[id^="duration_"]');
      for (let i = 0; i < tasks.length; ++i) {
        if (!tasks[i].classList.contains("running")) {
          continue;
        }
        tasks[i].innerHTML = formatDuration(new Date(parseFloat(tasks[i].getAttribute("datetime"))));
      }
    }, 5000);
  } else if (msg_type === "task-status") {
    // console.log(data);
    let item = document.getElementById("status_" + data[0] + "_" + data[1]);
    if (!item) {
      return;
    } else {
      // id, status, status_class, action_class, action_func
      item.className = "fa fa-fw fa-2x " + data[3];
      item.setAttribute("onmouseover", "$('#status_" + data[0] + "_" + data[1] + "').addClass('" + data[4] + " task_hover').removeClass('" + data[3] + "')");
      item.setAttribute("onmouseleave", "$('#status_" + data[0] + "_" + data[1] + "').addClass('" + data[3] + "').removeClass('" + data[4] + " task_hover')");
      item.setAttribute("onClick", data[5] + "('" + data[1] + "', '" + data[0] + "')");
    }
    item = document.getElementById("duration_" + data[0] + "_" + data[1]);
    if (item) {
      item.className = data[2];
      // stop update and reset time ...
      if (data[2] != "running") {
        let curTime = new Date();
        item.innerHTML = formatDuration(new Date(parseFloat(item.getAttribute("datetime"))));
        item.setAttribute('datetime', curTime.getTime().toString());
      }
    }
    if (data[2] === "completed") {
      for (let cell in info.pendingCells) {
        // remove task from pendingCells
        for (let idx = 0; idx < info.pendingCells[cell].length; ++idx) {
          if (info.pendingCells[cell][idx][0] !== data[0] ||
            info.pendingCells[cell][idx][1] !== data[1]) {
            continue;
          }
          info.pendingCells[cell].splice(idx, 1);
          if (info.pendingCells[cell].length === 0) {
            delete info.pendingCells[cell];
            // if the does not have any pending one, re-run it.
            let cells = panel.notebook.widgets;
            let rerun = null;
            for (let i = 0; i < cells.length; ++i) {
              if (cells[i].id === cell) {
                rerun = cells[i];
                break;
              }
            }
            if (rerun) {
              info.autoResume = true;
              rerun.execute();
            }
            break;
          }
        }
      }
    }
    /*  } else if (msg_type === "show_toc") {
    show_toc();
    */
  } else if (msg_type === "paste-table") {
    //let idx = panel.notebook.activeCellIndex;
    //let cm = panel.notebook.widgets[idx].editor;
    // cm.replaceRange(data, cm.getCursor());
  } else if (msg_type === 'alert') {
    alert(data);
  } else if (msg_type === 'notebook-version') {
    // right now no upgrade, just save version to notebook
    panel.notebook.model.metadata.get("sos")["version"] = data;
  } else if (msg_type === 'clear-output') {
    // console.log(data)
    let active: Cell[] = [];
    each(panel.notebook.widgets, child => {
      if (panel.notebook.isSelectedOrActive(child)) {
        active.push(child);
      }
    });

    let clear_task = function(cell, status) {
      let status_element = cell.node.getElementsByClassName(status);
      while (status_element.length > 0) {
        let table_element = status_element[0].parentNode.parentNode.parentNode.parentNode;
        // remove the table
        if (table_element.className == 'task_table') {
          table_element.parentElement.remove(table_element);
        }
      }
    }
    let clear_class = function(cell, element_class) {
      let elements = cell.node.getElementsByClassName(element_class);
      while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
        elements = cell.node.getElementsByClassName(element_class);
      }
    }
    // if remove all
    if (data[1]) {
      let cells = panel.notebook.widgets;
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
    } else if (panel.notebook.widgets[data[0]].model.type === "code") {
      // clear current cell
      let j;
      if (data[2]) {
        for (j = 0; j < data[2].length; ++j) {
          clear_task(panel.notebook.widgets[data[0]], data[2][j]);
        }
      } else if (data[3]) {
        for (j = 0; j < data[3].length; ++j) {
          clear_class(panel.notebook.widgets[data[0]], data[3][j]);
        }
      } else {
        (panel.notebook.widgets[data[0]] as CodeCell).outputArea.model.clear();
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

function connectSoSComm(panel: NotebookPanel, renew: boolean=false) {
  let info = Manager.manager.get_info(panel);
  if (info.sos_comm && !renew)
    return;
  panel.context.session.kernel.connectToComm("sos_comm").then(
    sos_comm => {
      Manager.manager.register_comm(sos_comm, panel);
      sos_comm.open('initial');
      sos_comm.onMsg = on_frontend_msg;

      if (panel.notebook.model.metadata.has('sos')) {
        sos_comm.send({
          "notebook-version": panel.notebook.model.metadata.get('sos')['version'],
          "list-kernel": panel.notebook.model.metadata.get('sos')['kernels']
        });
      } else {
        sos_comm.send({
          "notebook-version": "",
          "list-kernel": []
        });
      }
    }
  ).catch((error) => {
      console.log(error);
  });

  console.log("sos comm registered");
}

function hideSoSWidgets(element) {
  let sos_elements = element.getElementsByClassName('sos-widget') as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].style.display = 'none';
}

function showSoSWidgets(element) {
  let sos_elements = element.getElementsByClassName('sos-widget') as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].style.display = '';
}

(<any>window).kill_task = function(task_id : string, task_queue:string) {
  console.log("Kill " + task_id);
  // send_kernel_msg({
  //   "kill-task": [task_id, task_queue],
  // });
};

(<any>window).resume_task = function(task_id: string, task_queue: string) {
  console.log("Resume " + task_id);
  // send_kernel_msg({
  //   "resume-task": [task_id, task_queue],
  // });
};

(<any>window).task_info = function(task_id: string, task_queue: string) {
  // step 1: find the item with task_id, then the panel that contains the element
  let panel = document.getElementById('table_' + task_queue + '_' + task_id).closest('.jp-Document');
  // step 2: find the notebook that contains this table
  console.log("Request info on " + task_id);
  // send_kernel_msg({
  //   "task-info": [task_id, task_queue],
  // });
  // var cell = window.my_panel.cell;
  // cell.clear_input();
  // cell.set_text("%taskinfo " + task_id + " -q " + task_queue);
  // cell.clear_output();
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
          if (panel.notebook.model.metadata.has('sos')) {
            info.updateLanguages(panel.notebook.model.metadata.get('sos')['kernels']);
          } else {
            panel.notebook.model.metadata.set('sos',
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

    context.session.kernelChanged.connect((sender, kernel) => {
      console.log(`kernel changed to ${kernel.name}`)
      if (kernel.name === 'sos') {
        if (panel.notebook.model.metadata.has('sos')) {
          info.updateLanguages(panel.notebook.model.metadata.get('sos')['kernels']);
        } else {
          panel.notebook.model.metadata.set('sos',
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

    panel.notebook.model.cells.changed.connect((list, changed) => {
      let cur_kernel = panel.context.session.kernelPreference.name || panel.context.session.kernelDisplayName;
      if (cur_kernel.toLowerCase() === 'sos') {
        each(changed.newValues, cellmodel => {
          let idx = changed.newIndex; // panel.notebook.widgets.findIndex(x => x.model.id == cellmodel.id);
          let cell = panel.notebook.widgets[idx];

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
                if (panel.notebook.widgets[idx].model.type === 'code') {
                  kernel = panel.notebook.widgets[idx].model.metadata.get('kernel') as string;
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

    panel.notebook.activeCellChanged.connect((sender, cell) => {
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
  activate: (app: JupyterLab) => {
    registerSoSFileType(app);
    registerSoSWidgets(app);
    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
