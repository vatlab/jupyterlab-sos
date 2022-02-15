import CodeMirror from 'codemirror';

import "codemirror/lib/codemirror";
import "codemirror/mode/python/python";
import "codemirror/mode/r/r";
import "codemirror/mode/markdown/markdown";
import "codemirror/addon/mode/loadmode"

import { Manager } from "./manager";

var sosKeywords = ["input", "output", "depends", "parameter"];
var sosActionWords = [
  "script",
  "download",
  "run",
  "bash",
  "sh",
  "csh",
  "tcsh",
  "zsh",
  "python",
  "python2",
  "python3",
  "R",
  "node",
  "julia",
  "matlab",
  "octave",
  "ruby",
  "perl",
  "report",
  "pandoc",
  "docker_build",
  "Rmarkdown"
];
var sosMagicWords = [
  "cd",
  "capture",
  "clear",
  "debug",
  "dict",
  "expand",
  "get",
  "matplotlib",
  "paste",
  "preview",
  "pull",
  "push",
  "put",
  "render",
  "rerun",
  "run",
  "save",
  "sandbox",
  "set",
  "sessioninfo",
  "sosrun",
  "sossave",
  "shutdown",
  "taskinfo",
  "tasks",
  "toc",
  "use",
  "with"
];
var sosFunctionWords = ["sos_run", "logger", "get_output"];

export const sosHintWords = sosKeywords
  .concat(sosActionWords)
  .concat(sosFunctionWords)
  .concat(sosMagicWords);

var sosDirectives = sosKeywords.map(x => x + ":");
var sosActions = sosActionWords.map(x => new RegExp("^\\s*" + x + ":"));
var sosMagics = sosMagicWords.map(x => "%" + x);


function findMode(mode: string): any {
  let modeMap = Manager.manager.get_config('sos.kernel_codemirror_mode');
  if (modeMap) {
    if (mode in modeMap) {
      return modeMap[mode];
    } else if (typeof mode === 'string' && mode.toLowerCase() in modeMap) {
      return modeMap[mode.toLowerCase()]
    }
  }
  return null;
}

function findModeFromFilename(filename: string): any {
  var val = filename, m, mode;
  if (m = /.+\.([^.]+)$/.exec(val)) {
    var info = (CodeMirror as any).findModeByExtension(m[1]);
    if (info) {
      mode = info.mode;
    }
  } else if (/\//.test(val)) {
    var info = (CodeMirror as any).findModeByMIME(val);
    if (info) {
      mode = info.mode;
    }
  } else {
    mode = val;
  }
  return mode;
}

function markExpr(python_mode: any) {
  return {
    startState: function () {
      return {
        in_python: false,
        sigil: false,
        matched: true,
        python_state: (CodeMirror as any).startState(python_mode)
      };
    },

    copyState: function (state: any) {
      return {
        in_python: state.in_python,
        sigil: state.sigil,
        matched: state.matched,
        python_state: (CodeMirror as any).copyState(
          python_mode,
          state.python_state
        )
      };
    },

    token: function (stream: any, state: any) {
      if (state.in_python) {
        if (stream.match(state.sigil.right)) {
          state.in_python = false;
          state.python_state = (CodeMirror as any).startState(python_mode);
          return "sos-sigil";
        }
        let it = null;
        try {
          it = python_mode.token(stream, state.python_state);
        } catch (error) {
          return (
            "sos-interpolated error" + (state.matched ? "" : " sos-unmatched")
          );
        }
        if (it == "variable" || it == "builtin") {
          let ct = stream.current();
          // warn users in the use of input and output in {}
          if (ct === "input" || ct === "output") it += " error";
        }
        return (
          (it ? "sos-interpolated " + it : "sos-interpolated") +
          (state.matched ? "" : " sos-unmatched")
        );
      } else {
        // remove the double brace case, the syntax highlighter
        // does not have to worry (highlight) }}, although it would
        // probably mark an error for single }
        if (state.sigil.left === "{" && stream.match(/\{\{/)) return null;
        if (stream.match(state.sigil.left)) {
          state.in_python = true;
          // let us see if there is any right sigil till the end of the editor.
          try {
            let rest = stream.string.slice(stream.pos);
            if (!rest.includes(state.sigil.right)) {
              state.matched = false;
              for (let idx = 1; idx < 5; ++idx) {
                if (stream.lookAhead(idx).includes(state.sigil.right)) {
                  state.matched = true;
                  break;
                }
              }
            }
          } catch (error) {
            // only codemirror 5.27.0 supports this function
          }
          return "sos-sigil" + (state.matched ? "" : " sos-unmatched");
        }
        while (stream.next() && !stream.match(state.sigil.left, false)) { }
        return null;
      }
    }
  };
}

(CodeMirror as any).modeURL = "codemirror/mode/%N/%N";

export function sos_mode(conf: CodeMirror.EditorConfiguration, parserConf: any) {
  let sosPythonConf: any = {};
  for (let prop in parserConf) {
    if (parserConf.hasOwnProperty(prop)) {
      sosPythonConf[prop] = parserConf[prop];
    }
  }
  sosPythonConf.name = "python";
  sosPythonConf.version = 3;
  sosPythonConf.extra_keywords = sosActionWords.concat(sosFunctionWords);
  // this is the SoS flavored python mode with more identifiers
  let base_mode: any = null;
  if ("base_mode" in parserConf && parserConf.base_mode) {
    let spec = findMode(parserConf.base_mode);
    if (spec) {
      let modename = spec;
      if (typeof spec != "string") {
        modename = spec.name;
      }
      if (!CodeMirror.modes.hasOwnProperty(modename)) {
        console.log(`Load codemirror mode ${modename}`);
        (CodeMirror as any).requireMode(modename, function () { }, {});
      }
      base_mode = CodeMirror.getMode(conf, spec);
      // base_mode = CodeMirror.getMode(conf, mode);
    } else {
      base_mode = CodeMirror.getMode(conf, parserConf.base_mode);
    }
    // } else {
    //   console.log(
    //     `No base mode is found for ${parserConf.base_mode}. Python mode used.`
    //   );
  }

  // if there is a user specified base mode, this is the single cell mode
  if (base_mode) {
    var python_mode = (CodeMirror as any).getMode(
      {},
      {
        name: "python",
        version: 3
      }
    );
    var overlay_mode = markExpr(python_mode);
    return {
      startState: function () {
        return {
          sos_mode: true,
          base_state: (CodeMirror as any).startState(base_mode),
          overlay_state: (CodeMirror as any).startState(overlay_mode),
          // for overlay
          basePos: 0,
          baseCur: null,
          overlayPos: 0,
          overlayCur: null,
          streamSeen: null
        };
      },

      copyState: function (state) {
        return {
          sos_mode: state.sos_mode,
          base_state: (CodeMirror as any).copyState(
            base_mode,
            state.base_state
          ),
          overlay_state: (CodeMirror as any).copyState(
            overlay_mode,
            state.overlay_state
          ),
          // for overlay
          basePos: state.basePos,
          baseCur: null,
          overlayPos: state.overlayPos,
          overlayCur: null
        };
      },

      token: function (stream, state) {
        if (state.sos_mode) {
          if (stream.sol()) {
            let sl = stream.peek();
            if (sl == "!") {
              stream.skipToEnd();
              return "meta";
            } else if (sl == "#") {
              stream.skipToEnd();
              return "comment";
            }
            for (var i = 0; i < sosMagics.length; i++) {
              if (stream.match(sosMagics[i])) {
                if (sosMagics[i] === "%expand") {
                  // %expand, %expand --in R
                  if (stream.eol() || stream.match(/\s*(-i\s*\S+|--in\s*\S+)?$/, false)) {
                    state.overlay_state.sigil = {
                      left: "{",
                      right: "}"
                    };
                  } else {
                    let found = stream.match(/\s+(\S+)\s+(\S+)\s*(-i\s*\S+|--in\s*\S+)?$/, false);
                    if (found) {
                      state.overlay_state.sigil = {
                        left: found[1].match(/^.*[A-Za-z]$/) ? found[1] + ' ' : found[1],
                        right: found[2].match(/^[A-Za-z].*$/) ? ' ' + found[2] : found[2]
                      };
                    } else {
                      state.overlay_state.sigil = false;
                    }
                  }
                }
                // the rest of the lines will be processed as Python code
                return "meta";
              }
            }
            state.sos_mode = false;
          } else {
            stream.skipToEnd();
            return null;
          }
        }

        if (state.overlay_state.sigil) {
          if (
            stream != state.streamSeen ||
            Math.min(state.basePos, state.overlayPos) < stream.start
          ) {
            state.streamSeen = stream;
            state.basePos = state.overlayPos = stream.start;
          }

          if (stream.start == state.basePos) {
            state.baseCur = base_mode.token(stream, state.base_state);
            state.basePos = stream.pos;
          }
          if (stream.start == state.overlayPos) {
            stream.pos = stream.start;
            state.overlayCur = overlay_mode.token(
              stream,
              state.overlay_state
            );
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

      indent: function (state, textAfter) {
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

      innerMode: function (state: any) {
        return state.sos_mode
          ? {
            state: state.base_state,
            mode: base_mode
          }
          : null;
      },

      lineComment: "#",
      fold: "indent"
    };
  } else {
    // this is SoS mode
    base_mode = (CodeMirror as any).getMode(conf, sosPythonConf);
    overlay_mode = markExpr(base_mode);
    return {
      startState: function () {
        return {
          sos_state: null,
          base_state: (CodeMirror as any).startState(base_mode),
          overlay_state: (CodeMirror as any).startState(overlay_mode),
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

      copyState: function (state) {
        return {
          sos_state: state.sos_state,
          base_state: (CodeMirror as any).copyState(
            base_mode,
            state.base_state
          ),
          overlay_state: (CodeMirror as any).copyState(
            overlay_mode,
            state.overlay_state
          ),
          inner_mode: state.inner_mode,
          inner_state:
            state.inner_mode &&
            (CodeMirror as any).copyState(
              state.inner_mode,
              state.inner_state
            ),
          // for overlay
          basePos: state.basePos,
          baseCur: null,
          overlayPos: state.overlayPos,
          overlayCur: null
        };
      },

      token: function (stream, state) {
        if (stream.sol()) {
          let sl = stream.peek();
          if (sl == "[") {
            // header, move to the end
            if (stream.match(/^\[.*\]$/, false)) {
              // if there is :
              if (stream.match(/^\[[\s\w_,-]+:/)) {
                state.sos_state = "header_option";
                return "header line-section-header";
              } else if (stream.match(/^\[[\s\w,-]+\]$/)) {
                // reset state
                state.sos_state = null;
                state.inner_mode = null;
                return "header line-section-header";
              }
            }
          } else if (sl == "!") {
            stream.eatWhile(/\S/);
            return "meta";
          } else if (sl == "#") {
            stream.skipToEnd();
            return "comment";
          } else if (sl == "%") {
            stream.eatWhile(/\S/);
            return "meta";
          } else if (
            state.sos_state &&
            state.sos_state.startsWith("entering ")
          ) {
            // the second parameter is starting column
            let mode = findMode(state.sos_state.slice(9).toLowerCase());
            state.inner_mode = CodeMirror.getMode(conf, mode);
            state.inner_state = (CodeMirror as any).startState(
              state.inner_mode,
              stream.indentation()
            );
            state.sos_state = null;
          }
          for (var i = 0; i < sosDirectives.length; i++) {
            if (stream.match(sosDirectives[i])) {
              // the rest of the lines will be processed as Python code
              state.sos_state = "directive_option";
              return "keyword strong";
            }
          }
          for (var i = 0; i < sosActions.length; i++) {
            if (stream.match(sosActions[i])) {
              // switch to submode?
              if (stream.eol()) {
                // really
                let mode = findMode(stream.current().slice(0, -1));
                if (mode) {
                  state.sos_state =
                    "entering " + stream.current().slice(0, -1);
                } else {
                  state.sos_state = "unknown_language";
                }
              } else {
                state.sos_state = "start " + stream.current().slice(0, -1);
              }
              state.overlay_state.sigil = false;
              return "builtin strong";
            }
          }
          // if unknown action
          if (stream.match(/\w+:/)) {
            state.overlay_state.sigil = false;
            state.sos_state = "start " + stream.current().slice(0, -1);
            return "builtin strong";
          }
        } else if (state.sos_state == "header_option") {
          // stuff after :
          if (stream.peek() == "]") {
            // move next
            stream.next();
            // ] is the last char
            if (stream.eol()) {
              state.sos_state = null;
              state.inner_mode = null;
              return "header line-section-header";
            } else {
              stream.backUp(1);
              let it = base_mode.token(stream, state.base_state);
              return it ? it + " sos-option" : null;
            }
          } else {
            let it = base_mode.token(stream, state.base_state);
            return it ? it + " sos-option" : null;
          }
        } else if (state.sos_state == "directive_option") {
          // stuff after input:, R: etc
          if (stream.peek() == ",") {
            // move next
            stream.next();
            // , is the last char, continue option line
            if (stream.eol()) {
              stream.backUp(1);
              let it = base_mode.token(stream, state.base_state);
              return it ? it + " sos-option" : null;
            }
            stream.backUp(1);
          } else if (stream.eol()) {
            // end of line stops option mode
            state.sos_state = null;
            state.inner_mode = null;
          }
          let it = base_mode.token(stream, state.base_state);
          return it ? it + " sos-option" : null;
        } else if (state.sos_state && state.sos_state.startsWith("start ")) {
          // try to understand option expand=
          if (stream.match(/^.*expand\s*=\s*True/, false)) {
            // highlight {}
            state.overlay_state.sigil = {
              left: "{",
              right: "}"
            };
          } else {
            let found = stream.match(/^.*expand\s*=\s*"(\S+) (\S+)"/, false);
            if (!found)
              found = stream.match(/^.*expand\s*=\s*'(\S+) (\S+)'/, false);
            if (found) {
              state.overlay_state.sigil = {
                left: found[1].match(/^.*[A-Za-z]$/) ? found[1] + ' ' : found[1],
                right: found[2].match(/^[A-Za-z].*$/) ? ' ' + found[2] : found[2]
              };
            }
          }
          let mode_string = state.sos_state.slice(6).toLowerCase();
          // for report, we need to find "output" option
          if (mode_string === "report" &&
            stream.match(/^.*output\s*=\s*/, false)) {
            let found = stream.match(/^.*output\s*=\s*[rRbufF]*"""([^"]+)"""/, false);
            if (!found)
              found = stream.match(/^.*output\s*=\s*[rRbufF]*'''([^.]+)'''/, false);
            if (!found)
              found = stream.match(/^.*output\s*=\s*[rRbufF]*"([^"]+)"/, false);
            if (!found)
              found = stream.match(/^.*output\s*=\s*[rRbufF]*'([^']+)'/, false);

            // found[1] is the filename
            state.sos_state = 'start ' + findModeFromFilename(found ? found[1] : found);
          }
          let token = base_mode.token(stream, state.base_state);
          // if it is end of line, ending the starting switch mode
          if (stream.eol() && stream.peek() !== ",") {
            // really
            let mode = findMode(state.sos_state.slice(6).toLowerCase());
            if (mode) {
              state.sos_state = "entering " + state.sos_state.slice(6);
            } else {
              state.sos_state = "unknown_language";
            }
          }
          return token + " sos-option";
        }
        // can be start of line but not special
        if (state.sos_state == "unknown_language") {
          // we still handle {} in no man unknown_language
          if (state.overlay_state.sigil) {
            return overlay_mode.token(stream, state.overlay_state);
          } else {
            stream.skipToEnd();
            return null;
          }
        } else if (state.inner_mode) {
          let it = "sos_script ";
          if (!state.overlay_state.sigil) {
            let st = state.inner_mode.token(stream, state.inner_state);
            return st ? it + st : null;
          } else if (stream.indentation() < state.inner_state.indent) {
            state.inner_mode = null;
            state.sos_state = null;
            return "existing mode";
          } else {
            // overlay mode, more complicated
            if (
              stream != state.streamSeen ||
              Math.min(state.basePos, state.overlayPos) < stream.start
            ) {
              state.streamSeen = stream;
              state.basePos = state.overlayPos = stream.start;
            }

            if (stream.start == state.basePos) {
              state.baseCur = state.inner_mode.token(
                stream,
                state.inner_state
              );
              state.basePos = stream.pos;
            }
            if (stream.start == state.overlayPos) {
              stream.pos = stream.start;
              state.overlayCur = overlay_mode.token(
                stream,
                state.overlay_state
              );
              state.overlayPos = stream.pos;
            }
            stream.pos = Math.min(state.basePos, state.overlayPos);
            // state.overlay.combineTokens always takes precedence over combine,
            // unless set to null
            return (
              (state.overlayCur ? state.overlayCur : state.baseCur) +
              " sos-script"
            );
          }
        } else {
          return base_mode.token(stream, state.base_state);
        }
      },

      indent: function (state, textAfter) {
        // inner indent
        if (state.inner_mode) {
          if (!state.inner_mode.indent) return CodeMirror.Pass;
          return state.inner_mode.indent(state.inner_mode, textAfter) + 2;
        } else {
          return base_mode.indent(state.base_state, textAfter);
        }
      },

      innerMode: function (state: any) {
        return state.inner_mode
          ? null
          : {
            state: state.base_state,
            mode: base_mode
          };
      },

      lineComment: "#",
      fold: "indent",
      electricInput: /^\s*[\}\]\)]$/
    };
  }
};
