// small helper functions to compute simple edge and sharpness metrics in browser
export function getImageDataFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// convert RGBA to grayscale float array
export function grayFromImageData(img: ImageData) {
  const { data, width, height } = img;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { gray, width, height };
}

// simple convolution helper
function convolveFloat(src: Float32Array, width: number, height: number, kernel: number[], kw: number, kh: number) {
  const out = new Float32Array(width * height);
  const kcx = Math.floor(kw / 2);
  const kcy = Math.floor(kh / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kh; ky++) {
        for (let kx = 0; kx < kw; kx++) {
          const sx = x + kx - kcx;
          const sy = y + ky - kcy;
          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            sum += src[sy * width + sx] * kernel[ky * kw + kx];
          }
        }
      }
      out[y * width + x] = sum;
    }
  }
  return out;
}

// Sobel gradient magnitude (approx)
export function sobelMagnitude(gray: Float32Array, width: number, height: number) {
  const sx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const gx = convolveFloat(gray, width, height, sx, 3, 3);
  const gy = convolveFloat(gray, width, height, sy, 3, 3);
  const mag = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) mag[i] = Math.hypot(gx[i], gy[i]);
  return mag;
}

// variance of Laplacian-like approximation for sharpness
export function sharpnessMetric(gray: Float32Array, width: number, height: number) {
  // Laplacian kernel (approx)
  const lap = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  const lapRes = convolveFloat(gray, width, height, lap, 3, 3);
  // compute variance
  let mean = 0;
  for (let i = 0; i < lapRes.length; i++) mean += lapRes[i];
  mean /= lapRes.length;
  let varSum = 0;
  for (let i = 0; i < lapRes.length; i++) {
    const d = lapRes[i] - mean;
    varSum += d * d;
  }
  return varSum / lapRes.length;
}

// area of high-edge pixels (used for rectangle approximation)
export function edgeAreaPercent(mag: Float32Array, width: number, height: number, threshold = 30) {
  let count = 0;
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] > threshold) count++;
  }
  return (count / mag.length) * 100;
}
