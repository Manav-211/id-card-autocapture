import React from "react";

type Props = {
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  borderColor?: string;
};

export const AlignmentGuide: React.FC<Props> = ({ width = 0.8, height = 0.5, borderColor = "lime" }) => {
  // width/height are fraction of video
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${(100 - width * 100) / 2}%`,
    top: `${(100 - height * 100) / 2}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
    border: `3px dashed ${borderColor}`,
    boxSizing: "border-box",
    borderRadius: 8,
    pointerEvents: "none",
  };
  return <div style={style} aria-hidden />;
};
