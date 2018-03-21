import {
  JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import '../style/index.css';


import * as codemirror_type from 'codemirror';
import define_sos_mode from './codemirror_sos';



/**
 * Initialization data for the sos-extension extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'sos-extension',
  autoStart: true,
  activate: (app: JupyterLab) => {
  /* We should use 
 *   import * as CodeMirror from 'codemirror' directly. However, the typefile
 *   from @types/codemirror https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/codemirror/index.d.ts
 *   is different from the one used by Jupyter 
 *   (https://github.com/jupyterlab/jupyterlab/blob/3b4c1a3df53b7446516a4cb1138cc57ae91a7b80/packages/codemirror/typings/codemirror/codemirror.d.ts)
 * so I would get errors such as property "defineMIME" does not exist etc.
 *
 * The temporary walkaround is to define CodeMirror as any type and stop tsc from generating such errors.
 */
let CodeMirror : any = codemirror_type;

define_sos_mode(CodeMirror, "text/x-sos");

    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
