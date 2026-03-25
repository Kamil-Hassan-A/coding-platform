import React from "react";
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
    <div style={{
      width: "100%",
      height: "100%",
      background: "#1e1e1e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#888",
      fontSize: "14px",
      fontFamily: "sans-serif"
    }}>
      Loading editor...
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
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
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          automaticLayout: true,
        }}
      />
    </div>
  );
}
