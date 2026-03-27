import Editor from "@monaco-editor/react";

interface Props {
  code: string;
  onChange: (value: string) => void;
  language: string;
}

export default function CodeEditor({ code, onChange, language }: Props) {
  // Map internal language names to Monaco identifiers
  const monacoLanguage = language === "cpp" ? "cpp" : language;

  const loadingFallback = (
    <div className='flex h-full w-full flex-col items-center justify-center bg-[#1e1e1e] font-sans'>
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-admin-orange/20 border-t-admin-orange" />
      <span className="text-[14px] font-medium text-slate-400">Initializing editor...</span>
    </div>
  );

  return (
    <div className='h-full w-full overflow-hidden bg-[#1e1e1e]'>
      <Editor
        height="100%"
        width="100%"
        theme="vs-dark"
        language={monacoLanguage}
        value={code}
        onChange={(val) => onChange(val ?? "")}
        loading={loadingFallback}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 20, bottom: 20 },
          wordWrap: "on",
          lineNumbers: "on",
          automaticLayout: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          formatOnPaste: true,
          formatOnType: true,
          renderLineHighlight: "all",
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "on",
          tabCompletion: "on",
          wordBasedSuggestions: "currentDocument",
          snippetSuggestions: "inline",
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoIndent: "full",
          matchBrackets: "always",
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showClasses: true,
            showMethods: true,
            showFunctions: true,
            showVariables: true,
          },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}
