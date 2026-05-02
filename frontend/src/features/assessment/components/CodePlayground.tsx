import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';

interface CodePlaygroundProps {
  code?: string;
  onChange?: (val: string) => void;
  runSignal?: number;
  onRunResult?: (result: { ok: boolean; message: string; sandboxUrl?: string }) => void;
}

type FrameMessage = {
  source: "code-playground";
  type: "console" | "runtime-error";
  payload: string;
};

const CodePlayground: React.FC<CodePlaygroundProps> = ({
  code = "{}",
  onChange,
  runSignal,
  onRunResult,
}) => {
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [jsCode, setJsCode] = useState('');
  const [sandboxMessage, setSandboxMessage] = useState('');
  const [initialized, setInitialized] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastRunSignalRef = useRef<number | undefined>(runSignal);
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [runtimeError, setRuntimeError] = useState<string>("");

  useEffect(() => {
    if (!initialized && code) {
      try {
        const parsed = JSON.parse(code || "{}");
        if (parsed.html !== undefined) setHtmlCode(parsed.html);
        if (parsed.css !== undefined) setCssCode(parsed.css);
        if (parsed.javascript !== undefined) setJsCode(parsed.javascript);
        else if (parsed.js !== undefined) setJsCode(parsed.js);
      } finally {
        setInitialized(true);
      }
    }
  }, [code, initialized]);

  const htmlReady = htmlCode.trim().length > 0;
  const cssReady = cssCode.trim().length > 0;
  const jsReady = jsCode.trim().length > 0;
  const canEditCss = htmlReady;
  const canEditJs = htmlReady && cssReady;

  const handleEditorChange = (type: 'html' | 'css' | 'js', val: string) => {
    if (type === 'css' && !canEditCss) {
      return;
    }
    if (type === 'js' && !canEditJs) {
      return;
    }

    let newHtml = htmlCode;
    let newCss = cssCode;
    let newJs = jsCode;

    if (type === 'html') {
      newHtml = val;
      setHtmlCode(val);
    }
    if (type === 'css') {
      newCss = val;
      setCssCode(val);
    }
    if (type === 'js') {
      newJs = val;
      setJsCode(val);
    }

    onChange?.(JSON.stringify({ html: newHtml, css: newCss, js: newJs }));
  };

  const safeJsCode = useMemo(() => jsCode.replace(/<\/script>/gi, "<\\/script>"), [jsCode]);

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

  const executeInCodeSandbox = useCallback(async () => {
    if (!htmlReady) {
      const message = "Enter HTML code first.";
      setSandboxMessage(message);
      onRunResult?.({ ok: false, message });
      return;
    }
    if (!cssReady) {
      const message = "Enter CSS code after HTML.";
      setSandboxMessage(message);
      onRunResult?.({ ok: false, message });
      return;
    }
    if (!jsReady) {
      const message = "Enter JavaScript code after CSS.";
      setSandboxMessage(message);
      onRunResult?.({ ok: false, message });
      return;
    }

    const indexHtml = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <link rel="stylesheet" href="./style.css" />\n  </head>\n  <body>\n${htmlCode}\n    <script src="./script.js"></script>\n  </body>\n</html>`;

    const sandboxPayload = {
      files: {
        "index.html": { content: indexHtml },
        "style.css": { content: cssCode },
        "script.js": { content: jsCode },
        "sandbox.config.json": { content: JSON.stringify({ template: "static" }) },
      },
    };

    try {
      const response = await fetch("https://codesandbox.io/api/v1/sandboxes/define?json=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sandboxPayload),
      });

      if (!response.ok) {
        throw new Error(`CodeSandbox request failed (${response.status})`);
      }

      const data = (await response.json()) as { sandbox_id?: string };
      if (!data?.sandbox_id) {
        throw new Error("CodeSandbox did not return a sandbox id");
      }

      const sandboxUrl = `https://codesandbox.io/s/${data.sandbox_id}?file=/index.html`;
      window.open(sandboxUrl, "_blank", "noopener,noreferrer");
      handleRunCode();

      const message = "Executed in CodeSandbox. Check the opened sandbox for output.";
      setSandboxMessage(message);
      onRunResult?.({ ok: true, message, sandboxUrl });
      window.setTimeout(() => setSandboxMessage(""), 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to execute in CodeSandbox";
      setSandboxMessage(message);
      onRunResult?.({ ok: false, message });
    }
  }, [cssCode, cssReady, handleRunCode, htmlCode, htmlReady, jsCode, jsReady, onRunResult]);

  useEffect(() => {
    if (runSignal === undefined) {
      return;
    }
    if (lastRunSignalRef.current === runSignal) {
      return;
    }
    lastRunSignalRef.current = runSignal;
    void executeInCodeSandbox();
  }, [executeInCodeSandbox, runSignal]);

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
    if (initialized) {
      handleRunCode();
    }
  }, [handleRunCode, initialized]);

  return (
    <div className="flex h-full w-full bg-[#1e1e1e] font-sans">
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
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on", readOnly: !canEditCss }}
            />
          </div>
          {!canEditCss && (
            <div className="border-t border-[#3a2d2d] bg-[#241919] px-3 py-1 text-[11px] text-[#f0b3b3]">
              Complete HTML first to unlock CSS.
            </div>
          )}
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
              options={{ minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: "on", readOnly: !canEditJs }}
            />
          </div>
          {!canEditJs && (
            <div className="border-t border-[#3a2d2d] bg-[#241919] px-3 py-1 text-[11px] text-[#f0b3b3]">
              Complete CSS after HTML to unlock JavaScript.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-[#1e1e1e]">
        <div className="flex items-center justify-between border-b border-[#333] bg-[#2d2d2d] px-4 py-2">
          <div className="text-[13px] font-semibold tracking-wider text-[#ccc] uppercase">
            Live Preview
          </div>
          <button
            onClick={() => void executeInCodeSandbox()}
            className="rounded border border-[#2f7f61] bg-[#1d4f3d] px-3 py-1.5 text-[12px] font-bold text-[#ccf6df] transition-colors hover:bg-[#225c47]"
          >
            Execute in CodeSandbox
          </button>
        </div>
        {sandboxMessage && (
          <div className="border-b border-[#2d5645] bg-[#10281f] px-4 py-2 text-[12px] text-[#9fe5c2]">
            {sandboxMessage}
          </div>
        )}
        <div className="border-b border-[#333] bg-[#1a2331] px-4 py-2 text-[11px] text-[#b8c7de]">
          Required order: HTML -&gt; CSS -&gt; JavaScript. Run Code executes in CodeSandbox.
        </div>

        <div className="flex flex-1 flex-col overflow-hidden relative bg-white">
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
                Console is empty. Click Run Code to execute.
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
