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
  NotebookActions,
  NotebookPanel,
  INotebookModel
} from '@jupyterlab/notebook';


import '../style/index.css';

import * as $ from "jquery";
import * as codemirror_type from 'codemirror';
import 'codemirror/mode/meta';
import 'codemirror/mode/python/python';

const SOS_MIME_TYPE = 'text/x-sos'

function registerSoSFileType(app) {
  app.docRegistry.addFileType({
    name: 'sos',
    extensions: ['.sos'],
    mimeTypes: [SOS_MIME_TYPE],
    iconClass: 'sos_icon',
  });
}

function registerSoSCodeMirrorMode() {
  /* We should use
   *   import * as CodeMirror from 'codemirror' directly. However, the typefile
   *   from @types/codemirror https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/codemirror/index.d.ts
   *   is different from the one used by Jupyter
   *   (https://github.com/jupyterlab/jupyterlab/blob/3b4c1a3df53b7446516a4cb1138cc57ae91a7b80/packages/codemirror/typings/codemirror/codemirror.d.ts)
   * so I would get errors such as property "defineMIME" does not exist etc.
   *
   * The temporary walkaround is to define CodeMirror as any type and stop tsc from generating such errors.
   **/
  let CodeMirror: any = codemirror_type;

  CodeMirror.defineMode('sos', (config: CodeMirror.EditorConfiguration, modeOptions ? : any) => {
    let pythonConf: any = {};
    for (let prop in modeOptions) {
      if (modeOptions.hasOwnProperty(prop)) {
        pythonConf[prop] = modeOptions[prop];
      }
    }
    pythonConf.name = 'python';
    pythonConf.singleOperators = new RegExp('^[\\+\\-\\*/%&|@\\^~<>!\\?]');
    pythonConf.identifiers = new RegExp('^[_A-Za-z\u00A1-\uFFFF][_A-Za-z0-9\u00A1-\uFFFF]*');
    return CodeMirror.getMode(config, pythonConf);
  }, 'python');

  CodeMirror.defineMIME(SOS_MIME_TYPE, 'sos');
  CodeMirror.modeInfo.push({
    ext: ['.sos'],
    mime: SOS_MIME_TYPE,
    mode: 'sos',
    name: 'sos'
  });
}

/*
function is_sos(context: DocumentRegistry.IContext<INotebookModel>) {
    // when a new notebook is created with a sos kernel, session.kernelPreference would be sos
    // or an existing notebook with sos kernel is opened, model.metadata.kernelspec would be sos
    console.log(panel.context.session.kernelPreference.name);
    console.log(panel.notebook.model.metadata.get('kernelspec'));
    return  || panel.notebook.model.metadata.get('kernelspec')['name'] === 'sos';
}
*/

function displayButtons(panel: NotebookPanel) {}
}

export
class ButtonExtension implements DocumentRegistry.IWidgetExtension < NotebookPanel, INotebookModel > {
  /**
   * Create a new extension object.
   */
  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext < INotebookModel > ): IDisposable {
    let callback = () => {
      NotebookActions.runAll(panel.notebook, context.session);
    };

    // kernel might not be available at this time (e.g. when we open an existing notebook)
    // in this case, a button will be added. However, the button will be hidden and only 
    let nb_kernel = context.session.kernelPreference.name;
    if (nb_kernel && nb_kernel !== 'sos') {
      return;
    }

    let button = new ToolbarButton({
      className: 'sos_button',
      onClick: callback,
      tooltip: 'Run All'
    });

    let i = document.createElement('i');

    i.classList.add('fa', 'fa-fast-forward');
    button.node.appendChild(i);

    panel.toolbar.insertItem(0, 'runAll', button);

    if (!nb_kernel) {
      // if kernel information is not available, the buttons will be removed
      // when the kernel is ready. New buttons will not be created because by
      // that time the kernel information is clear
      context.session.ready.then(
        () => {
          displayButtons(panel);
          let cur_kernel = panel.context.session.kernelPreference.name;
          if (cur_kernel !== 'sos') {
            // if this is not a sos kernel, remove all buttons
            $('.sos_button', panel.node).remove();
          }
        }
      );
    }
    return new DisposableDelegate(() => {
      button.dispose();
    });
  }
}

function addLanguageSelector(app: JupyterLab) {
  app.docRegistry.addWidgetExtension('Notebook', new ButtonExtension());
}


/**
 * Initialization data for the sos-extension extension.
 */
const extension: JupyterLabPlugin < void > = {
  id: 'sos-extension',
  autoStart: true,
  activate: (app: JupyterLab) => {
    registerSoSCodeMirrorMode();
    registerSoSFileType(app);
    addLanguageSelector(app);
    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
