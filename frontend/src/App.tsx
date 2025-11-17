import React from "react";
import { CameraCapture } from "./components/CameraCapture";

function App() {
  return (
    <div style={{ padding: 20, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1>ID Card Auto-Capture (TypeScript)</h1>
      <p>Place the ID inside the dashed rectangle. App will auto-capture when steady & sharp.</p>
      <CameraCapture />
    </div>
  );
}

export default App;
