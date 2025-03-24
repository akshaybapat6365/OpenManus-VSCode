/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="vite/client" />

// This file contains declarations for modules that don't have type declarations
// or to extend existing modules with additional types

declare module "*.svg" {
  import * as React from "react";
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

// Declare JSX namespace to fix JSX element implicitly has type 'any' errors
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

// Declare the vscode webview API
interface Window {
  acquireVsCodeApi: () => {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
}

// Extend the React namespace to accommodate TypeScript strict checking
declare namespace React {
  interface HTMLAttributes<T> {
    type?: string;
  }
} 