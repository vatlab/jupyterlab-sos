import {
  JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import '../style/index.css';


/**
 * Initialization data for the sos-extension extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'sos-extension',
  autoStart: true,
  activate: (app: JupyterLab) => {
    console.log('JupyterLab extension sos-extension is activated!');
  }
};

export default extension;
