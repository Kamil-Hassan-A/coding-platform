import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';

interface CodePlaygroundProps {
  code?: string;
  onChange?: (val: string) => void;
  onPaste?: () => void;
}

type FrameMessage = {
  source: "code-playground";
  type: "console" | "runtime-error";
  payload: string;
};

const CodePlayground: React.FC<CodePlaygroundProps> = ({ code = "{}", onChange, onPaste }) => {
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [jsCode, setJsCode] = useState('');
  
  // Track if we've initialized from props to avoid overwriting during edits
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && code) {
      try {
        const parsed = JSON.parse(code || "{}");
        if (parsed.html !== undefined) setHtmlCode(parsed.html);
        if (parsed.css !== undefined) setCssCode(parsed.css);
        if (parsed.javascript !== undefined) setJsCode(parsed.javascript);
        else if (parsed.js !== undefined) setJsCode(parsed.js);
        setInitialized(true);
      } catch (e) {
        // Fallback or ignore
        setInitialized(true);
      }
    }
  }, [code, initialized]);

  const handleEditorChange = (type: 'html' | 'css' | 'js', val: string) => {
    let newHtml = htmlCode;
    let newCss = cssCode;
    let newJs = jsCode;
    if (type === 'html') { newHtml = val; setHtmlCode(val); }
    if (type === 'css') { newCss = val; setCssCode(val); }
    if (type === 'js') { newJs = val; setJsCode(val); }
    
    onChange?.(JSON.stringify({ html: newHtml, css: newCss, js: newJs }));
  };

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [runtimeError, setRuntimeError] = useState<string>("");

  const safeJsCode = useMemo(() => jsCode.replace(/<\/script>/gi, "<\\/script>"), [jsCode]);

  const handleMount = useCallback<OnMount>((editor) => {
    const disposables = [] as { dispose: () => void }[];

    if (typeof editor.onDidPaste === "function") {
      disposables.push(editor.onDidPaste(() => onPaste?.()));
    } else {
      disposables.push(
        editor.onDidChangeModelContent((event) => {
          if (event.isFlush) return;
          if (event.changes.some((change) => change.text.length > 5)) {
            onPaste?.();
          }
        }),
      );
    }

    return () => {
      disposables.forEach((disposable) => disposable.dispose());
    };
  }, [onPaste]);

  const buildSrcDoc = useCallback((html: string, css: string, js: string) => {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>
      (function () {
        var parentOrigin = window.location.origin;
        var send = function (type, payload) {
          try {
            window.parent.postMessage(
              { source: "code-playground", type: type, payload: String(payload) },
              parentOrigin
            );
          } catch (e) {
            window.parent.postMessage(
              { source: "code-playground", type: type, payload: String(payload) },
              "*"
            );
          }
        };

        var originalLog = console.log;
        console.log = function () {
          var args = Array.prototype.slice.call(arguments);
          var message = args
            .map(function (arg) {
              if (typeof arg === "object") {
                try {
                  return JSON.stringify(arg);
                } catch (err) {
                  return String(arg);
                }
              }
              return String(arg);
            })
            .join(" ");
          send("console", message);
          originalLog.apply(console, arguments);
        };

        var originalError = console.error;
        console.error = function () {
          var args = Array.prototype.slice.call(arguments);
          var message = args
            .map(function (arg) {
              return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
            })
            .join(" ");
          send("runtime-error", message);
          originalError.apply(console, arguments);
        };

        window.addEventListener("error", function (event) {
          var msg = event && event.message ? event.message : "Unknown runtime error";
          var line = event.lineno ? "Line " + event.lineno + ": " : "";
          send("runtime-error", line + msg);
        });

        window.addEventListener("unhandledrejection", function (event) {
          var reason = event && event.reason ? event.reason : "Unhandled promise rejection";
          var text = typeof reason === "string" ? reason : JSON.stringify(reason);
          send("runtime-error", text);
        });

        try {
          ${js}
        } catch (err) {
          send("runtime-error", err && err.message ? err.message : String(err));
        }
      })();
    </script>
  </body>
</html>`;
  }, []);

  const handleRunCode = useCallback(() => {
    setLogs([]);
    setRuntimeError("");
    setSrcDoc(buildSrcDoc(htmlCode, cssCode, safeJsCode));
  }, [buildSrcDoc, cssCode, htmlCode, safeJsCode]);

  const handleMessage = useCallback((event: MessageEvent<FrameMessage>) => {
    if (event.source !== iframeRef.current?.contentWindow) return;
    if (!event.data || event.data.source !== "code-playground") return;

    if (event.data.type === "console") {
      setLogs((prev) => [...prev, event.data.payload]);
    } else if (event.data.type === "runtime-error") {
      setRuntimeError(event.data.payload || "Unknown runtime error");
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    // Optional: auto-run when completely loaded first time
    if (initialized) {
      handleRunCode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  return (
    <div className="flex h-full w-full bg-[#1e1e1e] font-sans">
      {/* Editors Panel (Left) */}
      <div className="flex flex-1 flex-col border-r border-[#333]">
        <div className="flex flex-1 flex-col border-b border-[#333]">
          <div className="bg-[#2d2d2d] px-4 py-2 text-[13px] font-semibold tracking-wider text-[#ccc] uppercase">
            HTML
          </div>
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language="html"
              theme="vs-dark"
              value={htmlCode}
              onChange={(val) => handleEditorChange('html', val || '')}
              onMount={handleMount}
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on" }}
            />
          </div>
        </div>
        
        <div className="flex flex-1 flex-col border-b border-[#333]">
          <div className="bg-[#2d2d2d] px-4 py-2 text-[13px] font-semibold tracking-wider text-[#ccc] uppercase">
            CSS
          </div>
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language="css"
              theme="vs-dark"
              value={cssCode}
              onChange={(val) => handleEditorChange('css', val || '')}
              onMount={handleMount}
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on" }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="bg-[#2d2d2d] px-4 py-2 text-[13px] font-semibold tracking-wider text-[#ccc] uppercase">
            JavaScript
          </div>
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={jsCode}
              onChange={(val) => handleEditorChange('js', val || '')}
              onMount={handleMount}
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on" }}
            />
          </div>
        </div>
      </div>

      {/* Preview & Console Panel (Right) */}
      <div className="flex flex-1 flex-col bg-[#1e1e1e]">
        <div className="flex items-center justify-between border-b border-[#333] bg-[#2d2d2d] px-4 py-2">
          <div className="text-[13px] font-semibold tracking-wider text-[#ccc] uppercase">
            Live Preview
          </div>
          <button
            onClick={handleRunCode}
            className="rounded bg-[#007acc] px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-[#0062a3]"
          >
            Refresh Preview
          </button>
        </div>
        
        <div className="flex flex-1 flex-col bg-white overflow-hidden relative">
          {runtimeError && (
            <div className="absolute top-0 left-0 right-0 z-10 border-b border-red-200 bg-red-50 p-3 text-[13px] text-red-700 whitespace-pre-wrap font-mono shadow-sm">
              {runtimeError}
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="preview"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="h-full w-full border-none"
          />
        </div>

        <div className="flex max-h-[30%] min-h-[150px] flex-col border-t border-[#333] bg-[#1e1e1e]">
          <div className="border-b border-[#333] bg-[#2d2d2d] px-4 py-2 text-[13px] font-semibold tracking-wider text-[#ccc] uppercase">
            Console Output
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[13px] text-[#d4d4d4]">
            {logs.length === 0 ? (
              <span className="italic text-[#888] opacity-50">
                Console is empty. Click "Refresh Preview" to execute.
              </span>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1.5 break-words">
                  <span className="mr-2 text-[#888] opacity-50">&gt;</span>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePlayground;
