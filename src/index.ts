import {
    JupyterLab,
    JupyterLabPlugin
} from '@jupyterlab/application';

import {
    IDisposable,
    DisposableDelegate
} from '@phosphor/disposable';

import {
    ToolbarButton
} from '@jupyterlab/apputils';

import {
    DocumentRegistry
} from '@jupyterlab/docregistry';

import {
    KernelMessage
} from '@jupyterlab/services';

import {
    NotebookActions,
    NotebookPanel,
    INotebookModel
} from '@jupyterlab/notebook';

// define and register SoS CodeMirror mode
import './codemirror-sos'

import '../style/index.css';

import * as $ from "jquery";

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

/*
 * SoS frontend Comm
 */
function on_frontend_msg(msg: KernelMessage.ICommMsgMsg) {
    let data = msg.content.data;
    console.log(data);
	/*
  var msg_type = msg.metadata.msg_type;
  var i, j;
  var k_idx;
  var cell;

  if (msg_type === "kernel-list") {
    for (i = 0; i < data.length; i++) {
      // BackgroundColor is color
      window.BackgroundColor[data[i][0]] = data[i][3];
      // by kernel name? For compatibility ...
      if (!(data[i][1] in window.BackgroundColor)) {
        window.BackgroundColor[data[i][1]] = data[i][3];
      }
      // DisplayName
      window.DisplayName[data[i][0]] = data[i][0];
      if (!(data[i][1] in window.DisplayName)) {
        window.DisplayName[data[i][1]] = data[i][0];
      }
      // Name
      window.KernelName[data[i][0]] = data[i][1];
      if (!(data[i][1] in window.KernelName)) {
        window.KernelName[data[i][1]] = data[i][1];
      }
      // Language Name
      window.LanguageName[data[i][0]] = data[i][2];
      if (!(data[i][2] in window.LanguageName)) {
        window.LanguageName[data[i][2]] = data[i][2];
      }
      // KernelList, use displayed name
      if (window.KernelList.findIndex((item) => item[0] === data[i][0]) === -1) {
        window.KernelList.push([data[i][0], data[i][0]]);
      }
      // if options ...
      if (data[i].length > 4) {
        window.KernelOptions[data[i][0]] = data[i][4];
      }

      // if the kernel is in metadata, check conflict
      k_idx = nb.metadata["sos"]["kernels"].findIndex((item) => item[0] === data[i][0]);
      if (k_idx !== -1) {
        var r;
        // if kernel exist update the rest of the information, but warn users first on
        // inconsistency
        if (nb.metadata["sos"]["kernels"][k_idx][1] !== data[i][1] && nb.metadata["sos"]["kernels"][k_idx][1]) {
          r = confirm("This notebook used Jupyter kernel " + nb.metadata["sos"]["kernels"][k_idx][1] + " for subkernel " + data[i][0] + ". Do you want to switch to " + data[i][1] + " instead?");
          if (!r) {
            window.KernelName[data[i][0]] = nb.metadata["sos"]["kernels"][k_idx][1];
          }
        }
        if (nb.metadata["sos"]["kernels"][k_idx][2] !== data[i][2] && nb.metadata["sos"]["kernels"][k_idx][2]) {
          if (data[i][2] !== "") {
            r = confirm("This notebook used language definition " + nb.metadata["sos"]["kernels"][k_idx][2] + " for subkernel " + data[i][0] + ". Do you want to switch to " + data[i][2] + " instead?");
            if (!r) {
              window.LanguageName[data[i]][0] = nb.metadata["sos"]["kernels"][k_idx][2];
            }
          }
        }
      }
    }
    //add dropdown menu of kernels in frontend
    load_select_kernel();
    console.log("kernel list updated");
  } else if (msg_type === "default-kernel") {
    // update the cells when the notebook is being opened.
    // we also set a global kernel to be used for new cells
    $("#kernel_selector").val(window.DisplayName[data]);
    // a side effect of change is cells without metadata kernel info will change background
    $("#kernel_selector").change();
  } else if (msg_type === "cell-kernel") {
    // get cell from passed cell index, which was sent through the
    // %frontend magic

    cell = data[0] === -1 ? window.my_panel.cell : nb.get_cell(data[0]);
    if (cell.metadata.kernel !== window.DisplayName[data[1]]) {
      cell.metadata.kernel = window.DisplayName[data[1]];
      // set meta information
      changeStyleOnKernel(cell, data[1]);
      save_kernel_info();
    } else if (cell.metadata.tags && cell.metadata.tags.indexOf("report_output") >= 0) {
      // #639
      // if kernel is different, changeStyleOnKernel would set report_output.
      // otherwise we mark report_output
      $(".output_wrapper", cell.element).addClass("report_output");
    }
  } else if (msg_type === "preview-input") {
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
  } else if (msg_type === "tasks-pending") {
    cell = nb.get_cell(data[0]);
    window.pending_cells[cell.cell_id] = data[1];
  } else if (msg_type === "remove-task") {
    var item = document.getElementById("table_" + data[0] + "_" + data[1]);
    if (item) {
      item.parentNode.removeChild(item);
    }
  } else if (msg_type === "update-duration") {
    if (!window._duration_updater) {
      window._duration_updater = window.setInterval(function() {
        $("[id^=duration_]").text(function() {
          if ($(this).attr("class") != "running")
            return $(this).text();
          return window.durationFormatter($(this).attr("datetime"));
        });
      }, 5000);
    }
  } else if (msg_type === "task-status") {
    // console.log(data);
    var item = document.getElementById("status_" + data[0] + "_" + data[1]);
    if (!item) {
      return;
    } else {
      // id, status, status_class, action_class, action_func
      item.className = "fa fa-fw fa-2x " + data[3];
      item.setAttribute("onmouseover", "$('#status_" + data[0] + "_" + data[1] + "').addClass('" + data[4] + " task_hover').removeClass('" + data[3] + "')");
      item.setAttribute("onmouseleave", "$('#status_" + data[0] + "_" + data[1] + "').addClass('" + data[3] + "').removeClass('" + data[4] + " task_hover')");
      item.setAttribute("onClick", data[5] + "('" + data[1] + "', '" + data[0] + "')");
    }
    var item = document.getElementById("duration_" + data[0] + "_" + data[1]);
    if (item) {
      item.className = data[2];
      // stop update and reset time ...
      if (data[2] != "running") {
        var curTime = new Date();
        item.innerText = window.durationFormatter(item.getAttribute("datetime"));
        item.setAttribute('datetime', curTime.getTime());
      }
    }
    if (data[2] === "completed") {
      for (cell in window.pending_cells) {
				// remove task from pending_cells
        for (var idx = 0; idx < window.pending_cells[cell].length; ++idx) {
          if (window.pending_cells[cell][idx][0] !== data[0] ||
            window.pending_cells[cell][idx][1] !== data[1]) {
            continue;
          }
          window.pending_cells[cell].splice(idx, 1);
          if (window.pending_cells[cell].length === 0) {
            delete window.pending_cells[cell];
						// if the does not have any pending one, re-run it.
            var cells = nb.get_cells();
            var rerun = null;
            for (i = 0; i < cells.length; ++i) {
              if (cells[i].cell_id === cell) {
                rerun = cells[i];
                break;
              }
            }
            if (rerun) {
              window._auto_resume = true;
              rerun.execute();
            }
            break;
          }
        }
      }
    }
  } else if (msg_type === "show_toc") {
    show_toc();
  } else if (msg_type === "paste-table") {
    var cm = nb.get_selected_cell().code_mirror;
    cm.replaceRange(data, cm.getCursor());
  } else if (msg_type === 'alert') {
    alert(data);
  } else if (msg_type === 'notebook-version') {
    // right now no upgrade, just save version to notebook
    nb.metadata["sos"]["version"] = data;
  } else if (msg_type === 'clear-output') {
    // console.log(data)
    var active = nb.get_selected_cells_indices();
    var clear_task = function(cell, status) {
      var status_element = cell.element[0].getElementsByClassName(status);
      while (status_element.length > 0) {
        var table_element = status_element[0].parentNode.parentNode.parentNode.parentNode;
        // remove the table
        if (table_element.className == 'task_table') {
          table_element.parentElement.remove(table_element);
        }
      }
    }
    var clear_class = function(cell, element_class) {
      var elements = cell.element[0].getElementsByClassName(element_class);
      while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
        elements = cell.element[0].getElementsByClassName(element_class);
      }
    }
    // if remove all
    if (data[1]) {
      var cells = nb.get_cells();
      var i;
      var j;
      for (i = 0; i < cells.length; ++i) {
        if (cells[i].cell_type != "code")
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
          cells[i].clear_output();
        }
      }
    } else if (data[0] === -1) {
      // clear output of selected cells
      var i;
      var j;
      for (i = 0; i < active.length; ++i) {
        if (nb.get_cell(active[i]).cell_type != "code")
          continue;
        if (data[2]) {
          for (j = 0; j < data[2].length; ++j) {
            clear_task(nb.get_cell(active[i]), data[2][j]);
          }
        } else if (data[3]) {
          for (j = 0; j < data[3].length; ++j) {
            clear_class(nb.get_cell(active[i]), data[3][j]);
          }
        } else {
          nb.get_cell(active[i]).clear_output();
        }
      }
    } else if (nb.get_cell(data[0]).cell_type === "code") {
      // clear current cell
      var j;
      if (data[2]) {
        for (j = 0; j < data[2].length; ++j) {
          clear_task(nb.get_cell(data[0]), data[2][j]);
        }
      } else if (data[3]) {
        for (j = 0; j < data[3].length; ++j) {
          clear_class(nb.get_cell(data[0]), data[3][j]);
        }
      } else {
        nb.get_cell(data[0]).clear_output();
      }
    }
    if (active.length > 0) {
      nb.select(active[0]);
    }
  } else {
    // this is preview output
    cell = window.my_panel.cell;
    data.output_type = msg_type;
    cell.output_area.append_output(data);
		} */
}

function connectSoSComm(panel: NotebookPanel) {
    let sos_comm = panel.context.session.kernel.connectToComm("sos_comm");
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

function addGlobalLanguageSelector(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): ToolbarButton {

    let button = new ToolbarButton({
        className: 'sos_widget',
        onClick: () => {
            NotebookActions.runAll(panel.notebook, context.session);
        },
        tooltip: 'Run All'
    });

    let i = document.createElement('i');

    i.classList.add('fa', 'fa-fast-forward');
    button.node.appendChild(i);

    panel.toolbar.insertItem(0, 'runAll', button);
    return button;
}

function addCellLevelLanguageSelector(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>) {

}

export
    class SoSWidgets implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    /**
     * The createNew function does not return whatever created. It is just a registery that Will
     * be called when a notebook is created/opened, and the toolbar is created. it is therefore
     * a perfect time to insert SoS language selector and create comms during this time.
     */
    createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
        // we add SoS widget for all panels because the panel could be switched to SoS kernel later
        let button = addGlobalLanguageSelector(panel, context);
        addCellLevelLanguageSelector(panel, context);

        context.session.ready.then(
            () => {
                // kernel information (for opened notebook) should be ready
                // at this time. We can remove all sos_widget from the panel
                // if it is not sos.
                let cur_kernel = panel.context.session.kernelPreference.name;
                if (cur_kernel === 'sos') {
                    // if this is not a sos kernel, remove all buttons
                    $('.sos_widget', panel.node).show();
                    connectSoSComm(panel);
                } else {
                    // in this case, the .sos_widget should be hidden
                    $('.sos_widget', panel.node).hide();
                }
            }
        );
        return new DisposableDelegate(() => {
            button.dispose();
        });
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
