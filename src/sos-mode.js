(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("codemirror/lib/codemirror"),
            require("codemirror/mode/python/python"),
            require("codemirror/mode/r/r"),
            require("codemirror/mode/octave/octave"),
            require("codemirror/mode/ruby/ruby"),
            require("codemirror/mode/sas/sas"),
            require("codemirror/mode/javascript/javascript"),
            require("codemirror/mode/shell/shell"),
            require("codemirror/mode/julia/julia"),
            require("codemirror/mode/markdown/markdown"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["codemirror/lib/codemirror", "codemirror/mode/python/python",
            "codemirror/mode/markdown/markdown", "codemirror/mode/r/r"
        ], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
    "use strict";

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
        'run': 'shell',
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
        'download': 'markdown',
        // from kernel named, r, ruby, sas, javascript etc are fine
        'bash': 'shell',
        'sh': 'shell',
        'typescript': {
            name: "javascript",
            typescript: true
        },
        'matlab': 'octave',
    }

    function findMode(mode) {
        if (mode in modeMap) {
            return modeMap[mode];
        }
        return null;
    }

    function markExpr(sigil, python_mode) {
        return {
            startState: function() {
                return {
                    in_python: false,
                    end_pos: null,
                    python_state: CodeMirror.startState(python_mode),
                };
            },

            copyState: function(state) {
                return {
                    in_python: state.in_python,
                    end_pos: state.end_pos,
                    python_state: CodeMirror.copyState(python_mode, state.python_state)
                };
            },

            token: function(stream, state) {
                if (state.in_python) {
                    if (stream.pos == state.end_pos - sigil.right.length) {
                        state.in_python = false;
                        stream.pos += sigil.right.length;
                        return "searching";
                    }

                    let it = null;
                    try {
                        it = python_mode.token(stream, state);
                    } catch (error) {
                        console.log(error);
                        state.in_python = false;
                        stream.pos = state.end_pos;
                        return "searching";
                    }
                    if (stream.pos >= state.end_pos)
                        state.in_python = false;
                    if (it == 'variable' || it == 'builtin') {
                        let ct = stream.current();
                        // warn users in the use of input and output in {}
                        if (ct === 'input' || ct === 'output')
                            it += ' error';
                    }
                    return it ? ("searching " + it) : "searching";
                } else {
                    if (sigil.left === '{' && sigil.right === '}') {
                        // remove the double brace case
                        if (stream.match(/\{\{[^{}}]*\}\}/))
                            return null;
                        if (stream.match(/\{[^{}}]*\}/)) {
                            state.in_python = true;
                            state.end_pos = stream.pos;
                            stream.backUp(stream.current().length - 1);
                            return "searching";
                        }
                    } else if (sigil.left === '${' && sigil.right === '}') {
                        if (stream.match(/\$\{[^}]*\}/)) {
                            state.in_python = true;
                            state.end_pos = stream.pos;
                            stream.backUp(stream.current().length - 2);
                            return "searching";
                        }
                    } else {
                        // string search
                        if (stream.match(sigil.left)) {
                            stream.eatWhile(x => x !== sigil.right);
                            stream.pos += sigil.right.length;
                            state.end_pos = stream.pos;
                            state.in_python = true;
                            stream.backUp(stream.current().length - 2);
                            return "searching";
                        }
                    }
                    while (stream.next() && !stream.match(sigil.left, false)) {}
                    return null;
                }
            }
        }
    }

    CodeMirror.defineMode("sos", function(conf, parserConf) {
        let sosPythonConf = {};
        for (let prop in parserConf) {
            if (parserConf.hasOwnProperty(prop)) {
                sosPythonConf[prop] = parserConf[prop];
            }
        }
        sosPythonConf.name = 'python';
        sosPythonConf.version = 3;
        sosPythonConf.extra_keywords = sosActionWords.concat(sosFunctionWords);
        // this is the SoS flavored python mode with more identifiers
        var base_mode = null;
        if ('base_mode' in conf) {
            let mode = findMode(conf.base_mode.toLowerCase());
            if (mode) {
                base_mode = CodeMirror.getMode(conf, mode);
            } else {
                console.log(`No base mode is found for ${conf.base_mode}. Python mode used.`);
            }
        }
        // if there is a user specified base mode, this is the single cell mode
        if (base_mode) {
            var python_mode = CodeMirror.getMode({}, {
                name: 'python',
                version: 3
            });
            return {
                startState: function() {
                    return {
                        sos_sigil: null,
                        sos_mode: true,
                        base_state: CodeMirror.startState(base_mode),
                        overlay_state: CodeMirror.startState(base_mode),
                        // for overlay
                        basePos: 0,
                        baseCur: null,
                        overlayPos: 0,
                        overlayCur: null,
                        streamSeen: null
                    };
                },

                copyState: function(state) {
                    return {
                        sos_sigil: state.sos_sigil,
                        sos_mode: state.sos_mode,
                        base_state: CodeMirror.copyState(base_mode, state.base_state),
                        overlay_state: CodeMirror.copyState(base_mode, state.overlay_state),
                        // for overlay
                        basePos: state.basePos,
                        baseCur: null,
                        overlayPos: state.overlayPos,
                        overlayCur: null
                    };
                },

                token: function(stream, state) {
                    if (state.sos_mode) {
                        if (stream.sol()) {
                            let sl = stream.peek();
                            if (sl == '!') {
                                stream.skipToEnd();
                                return "meta";
                            } else if (sl == '#') {
                                stream.skipToEnd();
                                return 'comment'
                            }
                            for (var i = 0; i < sosMagics.length; i++) {
                                if (stream.match(sosMagics[i])) {
                                    if (sosMagics[i] === "%expand") {
                                        // if there is no :, the easy case
                                        if (stream.eol() || stream.match(/\s*$/, false)) {
                                            state.sos_sigil = {
                                                'left': '{',
                                                'right': '}'
                                            }
                                        } else {
                                            let found = stream.match(/\s+(\S+)\s+(\S+)$/, false);
                                            if (found) {
                                                state.sos_sigil = {
                                                    'left': found[1],
                                                    'right': found[2]
                                                }
                                            } else {
                                                state.sos_sigil = null;
                                            }
                                        }
                                    }
                                    // the rest of the lines will be processed as Python code
                                    return "meta strong";
                                }
                            }
                            state.sos_mode = false;
                        } else {
                            stream.skipToEnd();
                            return null;
                        }
                    }

                    if (state.sos_sigil) {
                        if (stream != state.streamSeen ||
                            Math.min(state.basePos, state.overlayPos) < stream.start) {
                            state.streamSeen = stream;
                            state.basePos = state.overlayPos = stream.start;
                        }

                        if (stream.start == state.basePos) {
                            state.baseCur = base_mode.token(stream, state.base_state);
                            state.basePos = stream.pos;
                        }
                        if (stream.start == state.overlayPos) {
                            stream.pos = stream.start;
                            state.overlayCur = markExpr(state.sos_sigil, python_mode).token(stream, state.overlay_state);
                            state.overlayPos = stream.pos;
                        }
                        stream.pos = Math.min(state.basePos, state.overlayPos);

                        // state.overlay.combineTokens always takes precedence over combine,
                        // unless set to null
                        return state.overlayCur ? state.overlayCur : state.baseCur;
                    } else {
                        return base_mode.token(stream, state.base_state);
                    }
                },

                indent: function(state, textAfter) {
                    // inner indent
                    if (!state.sos_mode) {
                        if (!base_mode.indent) return CodeMirror.Pass;
                        // inner mode will autoamtically indent + 4
                        return base_mode.indent(state.base_state, textAfter);
                    } else {
                        // sos mode has no indent
                        return 0;
                    }
                },

                innerMode: function(state) {
                    return state.sos_mode ? {
                        state: state.base_state,
                        mode: base_mode
                    } : null;
                },

                lineComment: "#",
                fold: "indent"
            };
        } else {
            // this is SoS mode
            base_mode = CodeMirror.getMode(conf, sosPythonConf);
            return {
                startState: function() {
                    return {
                        sos_state: null,
                        sos_sigil: null,
                        base_state: CodeMirror.startState(base_mode),
                        overlay_state: CodeMirror.startState(base_mode),
                        inner_mode: null,
                        inner_state: null,
                        // for overlay
                        basePos: 0,
                        baseCur: null,
                        overlayPos: 0,
                        overlayCur: null,
                        streamSeen: null
                    };
                },

                copyState: function(state) {
                    return {
                        sos_state: state.sos_state,
                        sos_sigil: state.sos_sigil,
                        base_state: CodeMirror.copyState(base_mode, state.base_state),
                        overlay_state: CodeMirror.copyState(base_mode, state.overlay_state),
                        inner_mode: state.inner_mode,
                        inner_state: state.inner_mode && CodeMirror.copyState(state.inner_mode, state.inner_state),
                        // for overlay
                        basePos: state.basePos,
                        baseCur: null,
                        overlayPos: state.overlayPos,
                        overlayCur: null
                    };
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
                                    state.inner_mode = null;
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
                                state.inner_mode = null;
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
                        let it = 'em ';
                        if (!state.sos_sigil) {
                            let st = state.inner_mode.token(stream, state.inner_state);
                            return st ? it + st : null;
                        } else {
                            // overlay mode, more complicated
                            if (stream != state.streamSeen ||
                                Math.min(state.basePos, state.overlayPos) < stream.start) {
                                state.streamSeen = stream;
                                state.basePos = state.overlayPos = stream.start;
                            }

                            if (stream.start == state.basePos) {
                                state.baseCur = state.inner_mode.token(stream, state.inner_state);
                                state.basePos = stream.pos;
                            }
                            if (stream.start == state.overlayPos) {
                                stream.pos = stream.start;
                                state.overlayCur = markExpr(state.sos_sigil, base_mode).token(stream, state.overlay_state);
                                state.overlayPos = stream.pos;
                            }
                            stream.pos = Math.min(state.basePos, state.overlayPos);
                            console.log(stream.current())
                            // state.overlay.combineTokens always takes precedence over combine,
                            // unless set to null
                            return (state.overlayCur ? state.overlayCur : state.baseCur) + " em";
                        }
                    } else {
                        return base_mode.token(stream, state.base_state);
                    }
                },

                indent: function(state, textAfter) {
                    // inner indent
                    if (state.inner_mode) {
                        return state.inner_mode.indent(state.inner_mode, textAfter) + 4;
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
        };
    }, "python");

    CodeMirror.defineMIME("text/x-sos", "sos");
});