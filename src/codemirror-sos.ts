import * as CodeMirror from 'codemirror';

import 'codemirror/mode/meta';
import 'codemirror/mode/python/python';

const SOS_MIME_TYPE = 'text/x-sos';

/* This is temporarily copied from JupyterLab ipython mode. Will be redefined
 * for SoS when the code works.
 */
CodeMirror.defineMode('sos', (config: CodeMirror.EditorConfiguration, modeOptions?: any) => {
    // languages should be {open, close, mode [, delimStyle] [, innerStyle]} objects
    var python_mode = CodeMirror.getMode(config, 'python');

    return {
        startState: function() {
            return {
                sos: {
                    state: null,
                },
                innerActive: null,
                inner: null
            };
        },

        copyState: function(state) {
            return {
                sos: state.sos,
                innerActive: state.innerActive,
                inner: state.innerActive && CodeMirror.copyState(state.innerActive.mode, state.inner)
            };
        },

        token: function(stream, state) {
            // if in SoS mode
            if (!state.innerActive) {
                return null;
            } else {
                return null;
            }
        },
    };
});


CodeMirror.defineMIME(SOS_MIME_TYPE, 'sos');
CodeMirror.modeInfo.push({
    ext: ['sos'],
    mime: SOS_MIME_TYPE,
    mode: 'sos',
    name: 'SoS'
});

// for testing, let us call runmode on SoS textarea

console.log("SoS Code mirror mode registered.")
