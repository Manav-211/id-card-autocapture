import React from "react";
import { CameraCapture } from "./components/CameraCapture";

function App() {
  return (
    <div style={{ 
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px",
      fontFamily: "Inter, system-ui, sans-serif",
      backgroundColor: "#f8f9fa",
      boxSizing: "border-box"
    }}>
      <div style={{ 
        textAlign: "center", 
        marginBottom: "20px",
        width: "100%",
        maxWidth: "1200px"
      }}>
        <h1 style={{ 
          fontSize: "2.5rem", 
          fontWeight: "bold", 
          color: "#333",
          marginBottom: "10px"
        }}>
          ID Card Auto-Capture
        </h1>
        <p style={{ 
          fontSize: "1.1rem", 
          color: "#666",
          lineHeight: "1.5"
        }}>
          Place your ID card inside the dashed rectangle. The app will automatically capture when the image is steady and sharp.
        </p>
      </div>
      <CameraCapture />
    </div>
  );
}

export default App;
