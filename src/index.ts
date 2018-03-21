import {
  JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import '../style/index.css';


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
  let CodeMirror : any = codemirror_type;

  CodeMirror.defineMode('sos', (config: CodeMirror.EditorConfiguration, modeOptions?: any) => {
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

/**
 * Initialization data for the sos-extension extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'sos-extension',
  autoStart: true,
  activate: (app: JupyterLab) => {
    registerSoSCodeMirrorMode();
    registerSoSFileType(app);
    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
