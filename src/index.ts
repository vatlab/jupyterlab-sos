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
  updateCellStyles,
  changeStyleOnKernel,
  DefaultLanguageSwitcher,
  saveKernelInfo
} from './selectors';

import {
  prepareContext
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

  if (msg_type === "kernel-list") {
    info.updateLanguages(data);
    info.languageSelector.updateOptions(info.KernelList);
    updateCellStyles(panel, info);
    console.log("kernel list updated");
  } else if (msg_type === "default-kernel") {

    if (data in info.DisplayName) {
      info.languageSelector.setDefault(info.DisplayName[data])
    } else {
      console.log(`WARN: Unrecognized default kernel ${data}`)
    }
  } else if (msg_type === "cell-kernel") {
    // jupyter lab does not yet handle panel cell
    if (data[0] === -1)
      return;
    let cell = panel.notebook.widgets[data[0]];
    if (cell.model.metadata.get('kernel') !== info.DisplayName[data[1]]) {
      cell.model.metadata.set('kernel', info.DisplayName[data[1]]);
      // set meta information
      changeStyleOnKernel(cell, info.DisplayName[data[1]], info);
      saveKernelInfo();
    } else if (cell.model.metadata.get('tags') &&
      (cell.model.metadata.get('tags') as Array<string>).indexOf("report_output") >= 0) {
      // #639
      // if kernel is different, changeStyleOnKernel would set report_output.
      // otherwise we mark report_output
      let op = cell.node.getElementsByClassName('jp-Cell-outputWrapper') as HTMLCollectionOf<HTMLElement>;
      for (let i = 0; i < op.length; ++i)
        op.item(i).classList.add('report-output');
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
    /*} else if (msg_type === "update-duration") {
        if (!info._duration_updater) {
            info._duration_updater = setInterval(function() {
                $("[id^=duration_]").text(function() {
                    if ($(this).attr("class") != "running")
                        return $(this).text();
                    return window.durationFormatter($(this).attr("datetime"));
                });
            }, 5000);
        }*/
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
        item.innerText = formatDuration(new Date(item.getAttribute("datetime")));
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

function connectSoSComm(panel: NotebookPanel) {
  if (Manager.manager.get_info(panel).sos_comm)
    return;
  let sos_comm = panel.context.session.kernel.connectToComm("sos_comm");
  Manager.manager.register_comm(sos_comm, panel);
  sos_comm.open('initial');
  sos_comm.onMsg = on_frontend_msg;

  let kernels = panel.notebook.model.metadata.has('sos') ? panel.notebook.model.metadata.get('sos')['kernels'] : [];
  console.log(kernels);
  sos_comm.send({
    "list-kernel": kernels,
    /* "update-task-status": window.unknown_tasks,
    "notebook-version": nb.metadata["sos"]["version"] || "undefined",
    */
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

    // we add SoS widget for all panels because the panel could be switched to SoS kernel later
    let lanSelector = new DefaultLanguageSwitcher(panel.notebook, info);
    info.languageSelector = lanSelector;
    panel.toolbar.insertItem(0, "defaultLanguage", lanSelector);
    // this is a singleton class
    context.session.ready.then(
      () => {
        // kernel information (for opened notebook) should be ready
        // at this time. We can remove all sos_widget from the panel
        // if it is not sos.
        let cur_kernel = panel.context.session.kernelPreference.name;
        if (cur_kernel === 'sos') {
          // if this is not a sos kernel, remove all buttons
          if (panel.notebook.model.metadata.has('sos')) {
            info.updateLanguages(panel.notebook.model.metadata.get('sos')['kernels']);
            info.languageSelector.setDefault(panel.notebook.model.metadata.get('sos')['default_kernel']);
          } else {
            panel.notebook.model.metadata.set('sos',
              {
                'kernels': [['SoS', 'sos', '', '']],
                'default_kernel': 'SoS'
              })
          }
          info.languageSelector.updateOptions(info.KernelList);
          connectSoSComm(panel);
          panel.session.kernel.registerPreprocessor(prepareContext);
          updateCellStyles(panel, info);
          showSoSWidgets(panel.node);
        } else {
          hideSoSWidgets(panel.node);
        }
      }
    );

    context.session.kernelChanged.connect((sender, kernel) => {
      if (kernel.name === 'sos') {
        if (panel.notebook.model.metadata.has('sos')) {
          info.updateLanguages(panel.notebook.model.metadata.get('sos')['kernels']);
          info.languageSelector.setDefault(panel.notebook.model.metadata.get('sos')['default_kernel']);
        } else {
          panel.notebook.model.metadata.set('sos',
            {
              'kernels': [['SoS', 'sos', '', '']],
              'default_kernel': 'SoS'
            })
        }
        connectSoSComm(panel);
        panel.session.kernel.registerPreprocessor(prepareContext);
        info.languageSelector.updateOptions(info.KernelList);
        updateCellStyles(panel, info);
        showSoSWidgets(panel.node);
      } else {
        // in this case, the .sos_widget should be hidden
        hideSoSWidgets(panel.node);
      }
    });

    panel.notebook.model.cells.changed.connect((list, changed) => {
      let cur_kernel = panel.context.session.kernelPreference.name;
      if (cur_kernel === 'sos' && changed.type == 'add') {
        each(changed.newValues, cellmodel => {
          let cell = panel.notebook.widgets.find(x => x.model.id == cellmodel.id);
          changeStyleOnKernel(cell, info.defaultKernel, info);
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
 * Command used by SoS Plugin
 */

function registerRunSelectedCommand(app: JupyterLab) {

  const { commands } = app;
  let selector: string = '.jp-NotebookPanel';

  let command: string = 'notebook:run-in-console';
  commands.addCommand(command, {
    label: 'Run current line or selected code in console',
    execute: args => {
      const widget = Manager.currentNotebook;
      const path = widget.context.path;

      if (!widget) {
        return;
      }
      let cell: Cell = widget.notebook.activeCell;
      if (!cell)
        return;

      let code = '';
      const editor = cell.editor;
      const selection = editor.getSelection();
      const { start, end } = selection;
      let selected = start.column !== end.column || start.line !== end.line;

      if (selected) {
        // Get the selected code from the editor.
        const start = editor.getOffsetAt(selection.start);
        const end = editor.getOffsetAt(selection.end);
        code = editor.model.value.text.substring(start, end);
      } else {
        // no selection, submit whole line and advance
        code = editor.getLine(selection.start.line);
        const cursor = editor.getCursorPosition();
        if (cursor.line + 1 !== editor.lineCount) {
          editor.setCursorPosition({ line: cursor.line + 1, column: cursor.column });
        }
      }
      // open a console, create if needed, the problem is that
      // console.open will activate the console window, which we do not need
      if (code) {
        return commands.execute('console:open', { path, insertMode: 'split-bottom', activate: false }).then(() => {
          commands.execute('console:inject', { activate: false, code, path });
        });
      } else {
        return Promise.resolve(void 0);
      }
    }
  });
  commands.addKeyBinding(
    { command, selector, keys: ['Ctrl Shift Enter'] }
  )
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
    registerRunSelectedCommand(app);
    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
