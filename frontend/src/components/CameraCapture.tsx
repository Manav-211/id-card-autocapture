import React, { useEffect, useRef, useState } from "react";
import { useVideoStream } from "../hooks/useVideoStream";
import { getImageDataFromVideo, grayFromImageData, sobelMagnitude, sharpnessMetric, edgeAreaPercent } from "../utils/imageProcessing";
import axios from "axios";

export const CameraCapture: React.FC = () => {
  const videoRef = useVideoStream();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("init");
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [captures, setCaptures] = useState<string[]>([]);
  const [isReadyToCapture, setIsReadyToCapture] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // stability buffer: store last N sharpness/edge metrics
  const bufferRef = useRef<{ sharpness: number; edgePercent: number; imageHash?: number }[]>([]);
  const lastCaptureRef = useRef<number>(0);
  const FRAME_INTERVAL = 200; // ms between checks
  const BUFFER_SIZE = 5; // need stable across last 5 frames
  const CAPTURE_COOLDOWN = 5000; // 5 seconds between auto-captures

  useEffect(() => {
    canvasRef.current = canvasRef.current ?? document.createElement("canvas");
    processingCanvasRef.current = processingCanvasRef.current ?? document.createElement("canvas");
    let interval: number | undefined;
    function startProcessing() {
      interval = window.setInterval(async () => {
        const video = videoRef.current;
        const canvas = processingCanvasRef.current!;
        if (!video || video.readyState < 2) return;
        const img = getImageDataFromVideo(video, canvas);
        if (!img) return;
        const { gray, width, height } = grayFromImageData(img);
        const sharp = sharpnessMetric(gray, width, height);
        const mag = sobelMagnitude(gray, width, height);
        const edgePercent = edgeAreaPercent(mag, width, height, 30);

        // keep buffer
        bufferRef.current.push({ sharpness: sharp, edgePercent });
        if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift();

        // tuned heuristics based on actual ID card readings:
        //  - sharpness threshold based on your good ID card (S:49)
        //  - edge range based on your ID card (E:5.3)
        //  - stability adjusted for natural hand movement
        const requiredSharpness = 30; // lower to match your ID card quality
        const minEdge = 4; // slightly lower to catch your card
        const maxEdge = 25; // keep same range

        const meanSharp = bufferRef.current.reduce((s, x) => s + x.sharpness, 0) / bufferRef.current.length;
        const varSharp = bufferRef.current.reduce((s, x) => s + Math.pow(x.sharpness - meanSharp, 2), 0) / bufferRef.current.length;
        const meanEdge = bufferRef.current.reduce((s, x) => s + x.edgePercent, 0) / bufferRef.current.length;

        const isSharp = meanSharp > requiredSharpness;
        const isEdgeOk = meanEdge > minEdge && meanEdge < maxEdge;
        const isSteady = varSharp < (requiredSharpness * 0.25); // more permissive for hand movement

        const now = Date.now();
        const canAutoCapture = now - lastCaptureRef.current > CAPTURE_COOLDOWN;
        const readyToCapture = autoCaptureEnabled && isSharp && isEdgeOk && isSteady && bufferRef.current.length >= BUFFER_SIZE && canAutoCapture;

        const autoStatus = autoCaptureEnabled ?
          (bufferRef.current.length >= BUFFER_SIZE ?
            `${readyToCapture ? '🟢 READY TO CAPTURE!' : '🟡 ANALYZING'} ${isSharp ? '✓' : '✗'}Sharp(need>${requiredSharpness}) ${isEdgeOk ? '✓' : '✗'}Edge(need ${minEdge}-${maxEdge}%) ${isSteady ? '✓' : '✗'}Steady${!canAutoCapture ? ' (cooldown)' : ''}` :
            `🔄 Analyzing frames... (${bufferRef.current.length}/${BUFFER_SIZE})`) :
          '⏸️ Auto-capture disabled - Enable checkbox to start';
        const steadyThreshold = requiredSharpness * 0.25;
        setStatus(`${autoStatus} | S:${Math.round(meanSharp)} V:${Math.round(varSharp)}(need<${steadyThreshold.toFixed(1)}) E:${meanEdge.toFixed(1)}`);
        setIsReadyToCapture(readyToCapture);

        if (readyToCapture) {
          // trigger capture
          lastCaptureRef.current = now;
          bufferRef.current = []; // reset buffer to prevent immediate re-capture
          captureFrame();
        }
      }, FRAME_INTERVAL);
    }
    startProcessing();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoRef, autoCaptureEnabled]);

  const captureFrame = async () => {
    const video = videoRef.current!;
    if (!video) return;
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCaptures((c) => [dataUrl, ...c].slice(0, 5)); // keep last 5 captures
    // optionally send to backend
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append("file", blob, "capture.jpg");
      setStatus("uploading");
      // change backend URL if needed
      const res = await axios.post("http://localhost:8000/process", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 20000,
      });
      // res.data can include processed cropped image or metadata
      if (res.data && res.data.cropped_base64) {
        setCaptures((c) => [res.data.cropped_base64, ...c].slice(0, 5));
        setLastError(null); // Clear any previous errors on success
      }
      setStatus("✅ ID card captured and processed!");
    } catch (err: any) {
      console.warn("backend not available or failed:", err);
      if (err.response?.status === 422) {
        setStatus("❌ No ID card detected in image");
        setLastError("No ID card detected in the captured image. Please ensure your ID card is clearly visible within the green rectangle.");
      } else {
        setStatus("⚠️ Backend error - captured locally");
        setLastError("Backend processing failed. Image saved locally.");
        // Still save the image locally even if backend fails
        setCaptures((c) => [dataUrl, ...c].slice(0, 5));
      }
      // Clear error after 5 seconds
      setTimeout(() => setLastError(null), 5000);
    }
  };

  const downloadImage = (imageData: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `id-card-${Date.now()}-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "0 20px"
    }}>
      <div style={{ position: "relative", background: "#000", width: "100%", maxWidth: "800px" }}>
        <video ref={videoRef} style={{ width: "100%", height: "auto", borderRadius: 8 }} playsInline muted />
        {/* alignment guide overlay */}
        <div style={{
          position: "absolute",
          left: "10%",
          top: "30%",
          width: "80%",
          height: "40%",
          border: `3px dashed ${isReadyToCapture ? '#00ff00' : autoCaptureEnabled ? '#ffff00' : '#00ff00'}`,
          borderRadius: 8,
          pointerEvents: "none",
          backgroundColor: isReadyToCapture ? 'rgba(0, 255, 0, 0.1)' : 'transparent',
          boxShadow: isReadyToCapture ? '0 0 20px rgba(0, 255, 0, 0.5)' : 'none',
          transition: 'all 0.3s ease'
        }} />
      </div>

      <div style={{
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => captureFrame()}
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            📸 Manual Capture
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "16px" }}>
            <input
              type="checkbox"
              checked={autoCaptureEnabled}
              onChange={(e) => setAutoCaptureEnabled(e.target.checked)}
              style={{ transform: "scale(1.2)" }}
            />
            🤖 Auto Capture
          </label>
        </div>
        <div style={{
          fontSize: "14px",
          color: "#666",
          textAlign: "center",
          padding: "8px 12px",
          backgroundColor: "#f8f9fa",
          borderRadius: "6px",
          border: "1px solid #dee2e6",
          maxWidth: "100%",
          wordBreak: "break-all"
        }}>
          {status}
        </div>

        {lastError && (
          <div style={{
            fontSize: "14px",
            color: "#dc3545",
            textAlign: "center",
            padding: "12px 16px",
            backgroundColor: "#f8d7da",
            borderRadius: "6px",
            border: "1px solid #f5c6cb",
            maxWidth: "100%",
            marginTop: "8px"
          }}>
            ⚠️ {lastError}
          </div>
        )}
      </div>

      {captures.length > 0 && (
        <div style={{ marginTop: 20, width: "100%" }}>
          <h3 style={{ textAlign: "center", color: "#333", marginBottom: "15px" }}>
            📸 Captured ID Cards ({captures.length})
          </h3>
          <div style={{ display: "flex", gap: 15, overflowX: "auto", padding: "10px 0", justifyContent: "center" }}>
            {captures.map((c, idx) => (
              <div key={idx} style={{
                position: "relative",
                minWidth: 220,
                height: 140,
                border: "2px solid #ddd",
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "#f5f5f5",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
              }}>
                <img
                  src={c}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    backgroundColor: "white"
                  }}
                  alt={`ID Card ${idx + 1}`}
                />
                <button
                  onClick={() => downloadImage(c, idx)}
                  style={{
                    position: "absolute",
                    bottom: "8px",
                    right: "8px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                  }}
                  title="Download ID Card"
                >
                  💾 Save
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* offscreen canvases used for processing */}
      <canvas ref={processingCanvasRef as any} style={{ display: "none" }} />
      <canvas ref={canvasRef as any} style={{ display: "none" }} />
    </div>
  );
};
