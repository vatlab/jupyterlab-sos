import * as CodeMirror from 'codemirror';

import 'codemirror/mode/meta';
import 'codemirror/mode/python/python';

const SOS_MIME_TYPE = 'text/x-sos';

/* This is temporarily copied from JupyterLab ipython mode. Will be redefined
 * for SoS when the code works.
 */
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
    ext: ['sos'],
    mime: SOS_MIME_TYPE,
    mode: 'sos',
    name: 'SoS'
});
console.log("SoS Code mirror mode registered.")
console.log(CodeMirror.modeInfo.find(element => element.mode == 'ipython'))
console.log(CodeMirror.modeInfo.find(element => element.mode == 'python'))
