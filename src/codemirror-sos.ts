import * as CodeMirror from 'codemirror';

import 'codemirror/mode/meta';
import 'codemirror/lib/codemirror';
import 'codemirror/mode/python/python';
import 'codemirror/mode/r/r';
import 'codemirror/mode/markdown/markdown';


var sosKeywords = ["input", "output", "depends", "parameter"];
var sosActionWords = ["script", "download", "run", "bash", "sh", "csh",
    "tcsh", "zsh", "python", "python2", "python3", "R", "node", "julia",
    "matlab", "octave", "ruby", "perl", "report", "pandoc", "docker_build",
    "Rmarkdown"
];
var sosMagicWords = ['cd', 'capture', 'clear', 'debug', 'dict', 'expand', 'get',
    'matplotlib', 'paste', 'preview', 'pull', 'push', 'put', 'render',
    'rerun', 'run', 'save', 'sandbox', 'set', 'sessioninfo', 'sosrun',
    'sossave', 'shutdown', 'taskinfo', 'tasks', 'toc', 'use', 'with'
]
var sosFunctionWords = ["sos_run", "logger", "get_output"];

var hintWords = sosKeywords.concat(sosActionWords).concat(sosFunctionWords)
    .concat(sosMagicWords);

var sosDirectives = sosKeywords.map(x => x + ":");
var sosActions = sosActionWords.map(x => x + ":");
var sosMagics = sosMagicWords.map(x => '%' + x);

// hint word for SoS mode
CodeMirror.registerHelper("hintWords", "sos", hintWords);

var modeMap = {
    'run': 'bash',
    'python': {
        name: 'python',
        version: 3
    },
    'python2': {
        name: 'python',
        version: 2
    },
    'python3': {
        name: 'python',
        version: 3
    },
    'r': 'r',
    'report': 'markdown',
    'pandoc': 'markdown',
    'download': 'markdown'
}

function findMode(mode) {
    if (mode in modeMap) {
        return modeMap[mode];
    }
    return null;
}

CodeMirror.defineMode("sos", function(conf: CodeMirror.EditorConfiguration,
    parserConf: any) {
    let sosPythonConf: any = {};
    for (let prop in parserConf) {
        if (parserConf.hasOwnProperty(prop)) {
            sosPythonConf[prop] = parserConf[prop];
        }
    }
    sosPythonConf.name = 'python';
    sosPythonConf.version = 3;
    sosPythonConf.extra_keywords = sosActionWords.concat(sosFunctionWords);
    // this is the SoS flavored python mode with more identifiers
    var base_mode = CodeMirror.getMode(conf, sosPythonConf);

    function markExpr(sigil) {
        return {
            token: function(stream) {
                if (sigil.left === '{' && sigil.right === '}') {
                    if (stream.match(/\{[^}]*\}/))
                        return "searching";
                } else if (sigil.left === '${' && sigil.right === '}') {
                    if (stream.match(/\$\{[^}]*\}/))
                        return "searching";
                } else {
                    // string search
                    if (stream.match(sigil.left)) {
                        stream.eatWhile(x => x !== sigil.right);
                        stream.pos += sigil.right.length;
                        return "searching";
                    }
                }
                return null;
            }
        }
    }

    return {
        startState: function() {
            return {
                sos_state: null,
                sos_sigil: null,
                base_state: CodeMirror.startState(base_mode),
                inner_mode: null,
                inner_state: null
            };
        },

        copyState: function(state) {
            var copied = {
                sos_state: state.sos_state,
                sos_sigil: state.sos_sigil,
                base_state: CodeMirror.copyState(base_mode, state.base_state),
                inner_mode: state.inner_mode,
                inner_state: state.inner_mode && CodeMirror.copyState(state.inner_mode, state.inner_state)
            };
            return copied;
        },

        token: function(stream, state) {
            if (stream.sol()) {
                let sl = stream.peek();
                if (sl == '[') {
                    // header, move to the end
                    if (stream.match(/^\[.*\]$/, false)) {
                        // if there is no :, the easy case
                        if (stream.match(/^\[[^:]*\]$/)) {
                            // reset state
                            state.sos_state = null;
                            return "header";
                        } else {
                            // match up to :
                            stream.match(/^\[[^:]*:/);
                            state.sos_state = 'header_option';
                            return "header";
                        }
                    }
                } else if (sl == '!') {
                    stream.skipToEnd();
                    return "meta";
                } else if (sl == '%') {
                    stream.skipToEnd();
                    return "meta";
                }
                for (var i = 0; i < sosDirectives.length; i++) {
                    if (stream.match(sosDirectives[i]))
                        // the rest of the lines will be processed as Python code
                        return "keyword strong";
                }
                for (var i = 0; i < sosMagics.length; i++) {
                    if (stream.match(sosMagics[i]))
                        // the rest of the lines will be processed as Python code
                        return "meta strong";
                }
                for (var i = 0; i < sosActions.length; i++) {
                    if (stream.match(sosActions[i])) {
                        // switch to submode?
                        state.sos_state = 'start ' + stream.current().slice(0, -1);
                        state.sos_sigil = null;
                        return "builtin strong";
                    }
                }
            } else if (state.sos_state == 'header_option') {
                // stuff after :
                if (stream.peek() == ']') {
                    // move next
                    stream.next();
                    // ] is the last char
                    if (stream.eol()) {
                        state.sos_state = null;
                        return "header";
                    } else {
                        stream.backUp(1);
                        return base_mode.token(stream, state.base_state);
                    }
                } else {
                    return base_mode.token(stream, state.base_state);
                }
            } else if (state.sos_state && state.sos_state.startsWith("start ")) {
                let sl = stream.peek();
                let token = base_mode.token(stream, state.base_state);

                // try to understand option expand=
                if (stream.match(/expand\s*=\s*True/, false)) {
                    // highlight {}
                    state.sos_sigil = {
                        'left': '{',
                        'right': '}'
                    }
                } else {
                    let found = stream.match(/expand\s*=\s*"(\S+) (\S+)"/, false);
                    if (!found)
                        found = stream.match(/expand\s*=\s*'(\S+) (\S+)'/, false);
                    if (found)
                        state.sos_sigil = {
                            'left': found[1],
                            'right': found[2]
                        }
                }
                // if it is end of line, ending the starting switch mode
                if (stream.eol() && sl !== ',') {
                    // really
                    let mode = findMode(state.sos_state.slice(6).toLowerCase());
                    if (mode) {
                        state.sos_state = null;
                        state.inner_mode = CodeMirror.getMode(conf, mode);
                        state.inner_state = CodeMirror.startState(state.inner_mode);
                    } else {
                        state.sos_state = 'nomanland';
                    }
                }
                return token;
            }
            // can be start of line but not special
            if (state.sos_state == 'nomanland') {
                stream.skipToEnd();
                return null;
            } else if (state.inner_mode) {
                let it = state.sos_sigil ? markExpr(state.sos_sigil).token(stream) : '';
                if (!it)
                    it = state.inner_mode.token(stream, state.inner_state);
                return "em" + (it ? " " + it : "");
            } else {
                return base_mode.token(stream, state.base_state);
            }
        },

        indent: function(state, textAfter) {
            // inner indent
            if (state.inner_mode) {
                var mode = state.inner_mode.mode;
                if (!mode.indent) return CodeMirror.Pass;
                // inner mode will autoamtically indent + 4
                return mode.indent(state.inner_mode ? state.inner : state.outer, textAfter) + 4;
            } else {
                return 0;
            }
        },

        innerMode: function(state) {
            return state.inner_mode ? null : {
                state: state.base_state,
                mode: base_mode
            };
        },

        lineComment: "#",
        fold: "indent"
    };
}, "python");

CodeMirror.defineMIME("text/x-sos", "sos");

CodeMirror.modeInfo.push({
    ext: ['sos'],
    mime: "text/x-sos",
    mode: 'sos',
    name: 'SoS'
});
