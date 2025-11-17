import React, { useEffect, useRef, useState } from "react";
import { useVideoStream } from "../hooks/useVideoStream";
import { getImageDataFromVideo, grayFromImageData, sobelMagnitude, sharpnessMetric, edgeAreaPercent } from "../utils/imageProcessing";
import axios from "axios";

export const CameraCapture: React.FC = () => {
  const videoRef = useVideoStream();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("init");
  const [autoCaptureEnabled] = useState(true);
  const [captures, setCaptures] = useState<string[]>([]);

  // stability buffer: store last N sharpness/edge metrics
  const bufferRef = useRef<{ sharpness: number; edgePercent: number; imageHash?: number }[]>([]);
  const FRAME_INTERVAL = 200; // ms between checks
  const BUFFER_SIZE = 5; // need stable across last 5 frames

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

        // simple heuristics:
        //  - sharpness above threshold (tunable)
        //  - edgePercent within a range indicating an object (not too noisy)
        //  - low variance across buffer -> steady
        const requiredSharpness = 60; // tune
        const minEdge = 1;
        const maxEdge = 30;

        const meanSharp = bufferRef.current.reduce((s, x) => s + x.sharpness, 0) / bufferRef.current.length;
        const varSharp = bufferRef.current.reduce((s, x) => s + Math.pow(x.sharpness - meanSharp, 2), 0) / bufferRef.current.length;
        const meanEdge = bufferRef.current.reduce((s, x) => s + x.edgePercent, 0) / bufferRef.current.length;

        setStatus(`sharp:${Math.round(meanSharp)} var:${Math.round(varSharp)} edge:${meanEdge.toFixed(1)}`);

        const isSharp = meanSharp > requiredSharpness;
        const isEdgeOk = meanEdge > minEdge && meanEdge < maxEdge;
        const isSteady = varSharp < (requiredSharpness * 0.2); // if variance low -> steady

        if (autoCaptureEnabled && isSharp && isEdgeOk && isSteady && bufferRef.current.length >= BUFFER_SIZE) {
          // trigger capture
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
      }
      setStatus("done");
    } catch (err) {
      console.warn("backend not available or failed:", err);
      setStatus("captured-locally");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 900 }}>
      <div style={{ position: "relative", background: "#000" }}>
        <video ref={videoRef} style={{ width: "100%", height: "auto", borderRadius: 8 }} playsInline muted />
        {/* alignment guide overlay */}
        <div style={{
          position: "absolute",
          left: "10%",
          top: "30%",
          width: "80%",
          height: "40%",
          border: "3px dashed lime",
          borderRadius: 8,
          pointerEvents: "none"
        }} />
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={() => captureFrame()}>Manual Capture</button>
        <span style={{ marginLeft: 12 }}>{status}</span>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, overflowX: "auto" }}>
        {captures.map((c, idx) => (
          <img key={idx} src={c} style={{ width: 160, height: "auto", borderRadius: 6, objectFit: "cover" }} />
        ))}
      </div>
      {/* offscreen canvases used for processing */}
      <canvas ref={processingCanvasRef as any} style={{ display: "none" }} />
      <canvas ref={canvasRef as any} style={{ display: "none" }} />
    </div>
  );
};
