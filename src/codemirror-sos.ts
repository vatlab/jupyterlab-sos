import * as CodeMirror from 'codemirror';

import 'codemirror/mode/meta';

// this module defines codemirror mode of SoS. It is written in JS because it
// will be used by jupyter sos-notebook as well.
import 'sos-mode.js'

CodeMirror.modeInfo.push({
    ext: ['sos'],
    mime: "text/x-sos",
    mode: 'sos',
    name: 'SoS'
});
