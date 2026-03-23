import { useState } from "react";

export const useEditor = (initialCode: string = "") => {
  const [code, setCode] = useState(initialCode);

  return {
    code,
    setCode,
  };
};
