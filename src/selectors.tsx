import { NotebookPanel, NotebookActions } from '@jupyterlab/notebook';

import { Cell } from '@jupyterlab/cells';

// import { CodeMirrorEditor } from '@jupyterlab/codemirror';

import { NotebookInfo } from './manager';

import { Manager, safe_css_name } from './manager';

import { HTMLSelect } from '@jupyterlab/ui-components';

import { ReactWidget } from '@jupyterlab/apputils';

import React from 'react';

const CELL_LANGUAGE_DROPDOWN_CLASS = 'jp-CelllanguageDropDown';
const CELL_HIDDEN_LANGUAGE_DROPDOWN_CLASS = 'jp-Hidden'

export function showSoSWidgets(element: HTMLElement) {
  let sos_elements = element.getElementsByClassName(
    CELL_LANGUAGE_DROPDOWN_CLASS
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < sos_elements.length; ++i)
    sos_elements[i].classList.remove(CELL_HIDDEN_LANGUAGE_DROPDOWN_CLASS);
}

export function saveKernelInfo() {
  let panel = Manager.currentNotebook;
  let info = Manager.manager.get_info(panel);

  let used_kernels = new Set();
  let cells = panel.content.model.cells;
  for (var i = cells.length - 1; i >= 0; --i) {
    let cell = cells.get(i);
    if (cell.type === 'code' && cell.getMetadata('kernel')) {
      used_kernels.add(cell.getMetadata('kernel') as string);
    }
  }
  let sos_info = panel.content.model.getMetadata('sos');
  sos_info['kernels'] = Array.from(used_kernels.values())
    .sort()
    .map(function (x) {
      return [
        info.DisplayName.get(x as string),
        info.KernelName.get(x as string),
        info.LanguageName.get(x as string) || '',
        info.BackgroundColor.get(x as string) || '',
        info.CodeMirrorMode.get(x as string) || ''
      ];
    });
  panel.content.model.setMetadata('sos', sos_info);
}

export function hideLanSelector(cell) {
  let nodes = cell.node.getElementsByClassName(
    CELL_LANGUAGE_DROPDOWN_CLASS
  ) as HTMLCollectionOf<HTMLElement>;
  if (nodes.length > 0) {
    nodes[0].style.display = 'none';
  }
}

export function toggleDisplayOutput(cell) {
  if (cell.model.type === 'markdown') {
    // switch between hide_output and ""
    if (
      cell.model.metadata['tags'] &&
      (cell.model.metadata['tags'] as Array<string>).indexOf('hide_output') >= 0
    ) {
      // if report_output on, remove it
      remove_tag(cell, 'hide_output');
    } else {
      add_tag(cell, 'hide_output');
    }
  } else if (cell.model.type === 'code') {
    // switch between report_output and ""
    if (
      cell.model.metadata['tags'] &&
      (cell.model.metadata['tags'] as Array<string>).indexOf('report_output') >=
      0
    ) {
      // if report_output on, remove it
      remove_tag(cell, 'report_output');
    } else {
      add_tag(cell, 'report_output');
    }
  }
}

export function toggleCellKernel(cell: Cell, panel: NotebookPanel) {
  if (cell.model.type === 'markdown') {
    // markdown, to code
    // NotebookActions.changeCellType(panel.content, 'code');
    return;
  } else if (cell.model.type === 'code') {
    // switch to the next used kernel
    let kernels = (panel.content.model.metadata['sos'] as any)['kernels'];
    // current kernel
    let kernel = cell.model.getMetadata('kernel');

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
  if (cell.model.type === 'markdown') {
    // markdown, to code
    NotebookActions.changeCellType(panel.content, 'code');
  } else {
    NotebookActions.changeCellType(panel.content, 'markdown');
  }
}

function remove_tag(cell, tag) {
  let taglist = cell.model.metadata['tags'] as string[];
  let new_list: string[] = [];
  for (let i = 0; i < taglist.length; i++) {
    if (taglist[i] != tag) {
      new_list.push(taglist[i]);
    }
  }
  cell.model.metadata.set('tags', new_list);
  let op = cell.node.getElementsByClassName(
    'jp-Cell-outputWrapper'
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < op.length; ++i) {
    op.item(i).classList.remove(tag);
  }
}

function add_tag(cell, tag) {
  let taglist = cell.model.metadata['tags'] as string[];
  if (taglist) {
    taglist.push(tag);
  } else {
    taglist = [tag];
  }
  cell.model.metadata.set('tags', taglist);
  let op = cell.node.getElementsByClassName(
    'jp-Cell-outputWrapper'
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < op.length; ++i) {
    op.item(i).classList.add(tag);
  }
}

export function addLanSelector(cell: Cell, info: NotebookInfo) {
  if (!cell.model.getMetadata('kernel')) {
    cell.model.setMetadata('kernel', 'SoS');
  }
  let kernel = cell.model.getMetadata('kernel') as string;

  let nodes = cell.node.getElementsByClassName(
    CELL_LANGUAGE_DROPDOWN_CLASS
  ) as HTMLCollectionOf<HTMLElement>;
  if (nodes.length > 0) {
    // use the existing dropdown box
    let select = nodes
      .item(0)
      .getElementsByTagName('select')[0] as HTMLSelectElement;
    // update existing
    for (let lan of info.KernelList) {
      // ignore if already exists
      if (select.options.namedItem(lan)) continue;
      let option = document.createElement('option');
      option.value = lan;
      option.id = lan;
      option.textContent = lan;
      select.appendChild(option);
    }
    select.value = kernel ? kernel : 'SoS';
  }
}

export function changeCellKernel(
  cell: Cell,
  kernel: string,
  info: NotebookInfo
) {
  cell.model.setMetadata('kernel', kernel);
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
    cell.model.metadata['tags'] &&
    (cell.model.metadata['tags'] as Array<string>).indexOf('report_output') >= 0
  ) {
    let op = cell.node.getElementsByClassName(
      'jp-Cell-outputWrapper'
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < op.length; ++i)
      op.item(i).classList.add('report-output');
  } else {
    let op = cell.node.getElementsByClassName(
      'jp-Cell-outputWrapper'
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < op.length; ++i)
      op.item(i).classList.remove('report-output');
  }
  for (let className of Array.from(cell.node.classList)) {
    if (className.startsWith('sos_lan_')) {
      cell.node.classList.remove(className);
    }
  }
  cell.node.classList.add(safe_css_name(`sos_lan_${kernel}`));
  // cell.user_highlight = {
  //     name: 'sos',
  //     base_mode: info.LanguageName[kernel] || info.KernelName[kernel] || kernel,
  // };
  // //console.log(`Set cell code mirror mode to ${cell.user_highlight.base_mode}`)
  // let base_mode: string =
  //   info.CodeMirrorMode.get(kernel) ||
  //   info.LanguageName.get(kernel) ||
  //   info.KernelName.get(kernel) ||
  //   kernel;
  // if (!base_mode || base_mode === 'sos') {
  //   (cell.inputArea.editorWidget.editor as CodeMirrorEditor).setOption(
  //     'mode',
  //     'sos'
  //   );
  // } else {
  //   (cell.inputArea.editorWidget.editor as CodeMirrorEditor).setOption('mode', {
  //     name: 'sos',
  //     base_mode: base_mode,
  //   });
  // }
}

export function updateCellStyles(
  panel: NotebookPanel,
  info: NotebookInfo
): Array<string> {
  var cells = panel.content.widgets;

  // setting up background color and selection according to notebook metadata
  for (let i = 0; i < cells.length; ++i) {
    addLanSelector(cells[i], info);
    if (cells[i].model.type === 'code') {
      changeStyleOnKernel(
        cells[i],
        cells[i].model.getMetadata('kernel') as string,
        info
      );
    }
  }

  let panels = Manager.consolesOfNotebook(panel);
  for (let i = 0; i < panels.length; ++i) {
    addLanSelector(panels[i].console.promptCell, info);
    changeStyleOnKernel(
      panels[i].console.promptCell,
      panels[i].console.promptCell.model.getMetadata('kernel') as string,
      info
    );
  }
  let tasks = document.querySelectorAll('[id^="task_status_"]');
  let unknownTasks = [];
  for (let i = 0; i < tasks.length; ++i) {
    // status_localhost_5ea9232779ca1959
    if (tasks[i].id.match('^task_status_icon_.*')) {
      tasks[i].className = 'fa fa-fw fa-2x fa-refresh fa-spin';
      unknownTasks.push(tasks[i].id.substring(17));
    }
  }
  return unknownTasks;
}

export class KernelSwitcher extends ReactWidget {
  constructor() {
    super();
    // this.state = {
    //   is_sos: false;
    // }
  }

  handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    let cell = Manager.currentNotebook.content.activeCell;

    let kernel = event.target.value;
    cell.model.setMetadata('kernel', kernel);
    let panel = Manager.currentNotebook;
    let info: NotebookInfo = Manager.manager.get_info(panel);
    info.sos_comm.send({ 'set-editor-kernel': kernel });
    // change style
    changeStyleOnKernel(cell, kernel, info);
    // set global meta data
    saveKernelInfo();
    this.update();
  };

  handleKeyDown = (event: React.KeyboardEvent): void => { };

  render(): JSX.Element {
    let panel = Manager.currentNotebook;
    let info = Manager.manager.get_info(panel);

    let cell = panel.content.activeCell;

    const optionChildren = info.KernelList.map(lan => {
      return (
        <option key={lan} value={lan} id={lan}>
          {lan}
        </option>
      );
    });
    let kernel = cell.model.getMetadata('kernel') as string;

    return (
      <HTMLSelect
        className={CELL_LANGUAGE_DROPDOWN_CLASS + " " + CELL_HIDDEN_LANGUAGE_DROPDOWN_CLASS}
        onChange={this.handleChange}
        onKeyDown={this.handleKeyDown}
        value={kernel ? kernel : 'SoS'}
        aria-label="Kernel"
        title={'Select the cell kernel'}
      >
        {optionChildren}
      </HTMLSelect>
    );
  }
}
