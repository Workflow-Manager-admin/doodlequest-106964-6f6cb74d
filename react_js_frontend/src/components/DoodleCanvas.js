import React, { useRef, useEffect, useState } from "react";
import "./DoodleCanvas.css";

// PUBLIC_INTERFACE
export default function DoodleCanvas({ drawingEnabled, onDrawEnd, imageUrl, yourTurn, tool = "brush" }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  // PUBLIC_INTERFACE
  const startDraw = (e) => {
    if (!drawingEnabled) return;
    setDrawing(true);
    const canvas = canvasRef.current.getContext("2d");
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = e.touches ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
    canvas.beginPath();
    canvas.moveTo(x, y);
  };

  // PUBLIC_INTERFACE
  const draw = (e) => {
    if (!drawing) return;
    const canvas = canvasRef.current.getContext("2d");
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = e.touches ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
    canvas.lineWidth = 4;
    canvas.lineCap = "round";
    canvas.strokeStyle = "#720303";
    canvas.lineTo(x, y);
    canvas.stroke();
  };

  // PUBLIC_INTERFACE
  const stopDraw = () => {
    setDrawing(false);
    if (onDrawEnd) {
      const url = canvasRef.current.toDataURL();
      onDrawEnd(url);
    }
  };

  // PUBLIC_INTERFACE
  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => {
    if (!yourTurn && imageUrl) {
      const ctx = canvasRef.current.getContext("2d");
      const img = new window.Image();
      img.src = imageUrl;
      img.onload = () => {
        clearCanvas();
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
      };
    }
    if (yourTurn) clearCanvas();
    // eslint-disable-next-line
  }, [imageUrl, yourTurn]);

  return (
    <div className="doodle-canvas-wrapper">
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className={`doodle-canvas${drawingEnabled ? "" : " readonly"}`}
        style={{ background: "#fff", border: "3px solid #f5a3af", borderRadius: "16px" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        tabIndex={0}
        aria-label="Drawing Area"
        disabled={!drawingEnabled}
      />
      {yourTurn && (
        <button className="clear-btn" onClick={clearCanvas}>Clear</button>
      )}
    </div>
  );
}
