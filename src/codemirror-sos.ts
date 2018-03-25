import * as CodeMirror from 'codemirror';

import 'codemirror/mode/meta';
import 'codemirror/mode/python/python';

const SOS_MIME_TYPE = 'text/x-sos';

/* This is temporarily copied from JupyterLab ipython mode. Will be redefined
 * for SoS when the code works.
 */
CodeMirror.defineMode('sos', (config: CodeMirror.EditorConfiguration, modeOptions?: any) => {
    // languages should be {open, close, mode [, delimStyle] [, innerStyle]} objects
    var python_mode = CodeMirror.getMode(config, 'python')

    function get_sub_mode(action) {
        var predefined = [
            { open: 'pandoc', mode: CodeMirror.getMode(config, 'Markdown') },
            { open: 'report', mode: CodeMirror.getMode(config, 'Markdown') },
            { open: 'script', mode: CodeMirror.getMode(config, 'python') },
            { open: 'run', mode: CodeMirror.getMode(config, 'Shell') }
        ];
        // step 1: if predefined, returnEnd
        // step 2: found from action name (works for modes such as ruby)
        // step 3: find by MIME type text/x-Name
        // Otherwise, return a plain dummy mode
    }


    function indexOf(string, pattern, from, returnEnd) {
        if (typeof pattern == "string") {
            var found = string.indexOf(pattern, from);
            return returnEnd && found > -1 ? found + pattern.length : found;
        }
        var m = pattern.exec(from ? string.slice(from) : string);
        return m ? m.index + from + (returnEnd ? m[0].length : 0) : -1;
    }

    return {
        startState: function() {
            return {
                sos: {
                    state: null;
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

                var cutOff = Infinity, oldContent = stream.string;
                for (var i = 0; i < languages.length; ++i) {
                    var other = languages[i];
                    var found = indexOf(oldContent, other.open, stream.pos);
                    if (found == stream.pos) {
                        if (!other.parseDelimiters) stream.match(other.open);
                        state.innerActive = other;

                        // Get the sos indent, making sure to handle CodeMirror.Pass
                        var sosIndent = 0;
                        if (sos.indent) {
                            var possiblesosIndent = sos.indent(state.sos, "");
                            if (possiblesosIndent !== CodeMirror.Pass) sosIndent = possiblesosIndent;
                        }

                        state.inner = CodeMirror.startState(other.mode, sosIndent);
                        return other.delimStyle && (other.delimStyle + " " + other.delimStyle + "-open");
                    } else if (found != -1 && found < cutOff) {
                        cutOff = found;
                    }
                }
                if (cutOff != Infinity) stream.string = oldContent.slice(0, cutOff);
                var sosToken = sos.token(stream, state.sos);
                if (cutOff != Infinity) stream.string = oldContent;
                return sosToken;
            } else {
                var curInner = state.innerActive, oldContent = stream.string;
                if (!curInner.close && stream.sol()) {
                    state.innerActive = state.inner = null;
                    return this.token(stream, state);
                }
                var found = curInner.close ? indexOf(oldContent, curInner.close, stream.pos, curInner.parseDelimiters) : -1;
                if (found == stream.pos && !curInner.parseDelimiters) {
                    stream.match(curInner.close);
                    state.innerActive = state.inner = null;
                    return curInner.delimStyle && (curInner.delimStyle + " " + curInner.delimStyle + "-close");
                }
                if (found > -1) stream.string = oldContent.slice(0, found);
                var innerToken = curInner.mode.token(stream, state.inner);
                if (found > -1) stream.string = oldContent;

                if (found == stream.pos && curInner.parseDelimiters)
                    state.innerActive = state.inner = null;

                if (curInner.innerStyle) {
                    if (innerToken) innerToken = innerToken + " " + curInner.innerStyle;
                    else innerToken = curInner.innerStyle;
                }

                return innerToken;
            }
        },

        indent: function(state, textAfter) {
            var mode = state.innerActive ? state.innerActive.mode : sos;
            if (!mode.indent) return CodeMirror.Pass;
            return mode.indent(state.innerActive ? state.inner : state.sos, textAfter);
        },

        blankLine: function(state) {
            var mode = state.innerActive ? state.innerActive.mode : sos;
            if (mode.blankLine) {
                mode.blankLine(state.innerActive ? state.inner : state.sos);
            }
            if (!state.innerActive) {
                for (var i = 0; i < languages.length; ++i) {
                    var other = languages[i];
                    if (other.open === "\n") {
                        state.innerActive = other;
                        state.inner = CodeMirror.startState(other.mode, mode.indent ? mode.indent(state.sos, "") : 0);
                    }
                }
            } else if (state.innerActive.close === "\n") {
                state.innerActive = state.inner = null;
            }
        },

        electricChars: sos.electricChars,

        innerMode: function(state) {
            return state.inner ? { state: state.inner, mode: state.innerActive.mode } : { state: state.sos, mode: sos };
        }
    };
});


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
