# ID Card Auto-Capture Application

A web application that uses computer vision to automatically detect and capture ID cards from a camera feed.

## Features

- **Real-time camera feed** with alignment guide overlay
- **Manual capture** button for immediate photo capture
- **Auto-capture toggle** with intelligent ID card detection
- **Backend processing** using OpenCV for card detection and cropping
- **Image quality metrics** (sharpness, edge detection, stability)

## Project Structure

```
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── CameraCapture.tsx    # Main camera component
│   │   │   └── AlignmentGuide.tsx   # UI guide overlay
│   │   ├── hooks/
│   │   ├── utils/
│   │   │   └── imageProcessing.ts   # Image analysis functions
│   │   └── App.tsx
│   └── package.json
└── backend/           # FastAPI + OpenCV
    ├── app/
    │   ├── main.py    # FastAPI server
    │   └── process.py # Image processing logic
    └── requirements.txt
```

## Setup & Running

### Backend (FastAPI)

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create and activate virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   API documentation: `http://localhost:8000/docs`

### Frontend (React + Vite)

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## Usage

1. **Start both backend and frontend** as described above
2. **Allow camera permissions** when prompted by the browser
3. **Position an ID card** within the green dashed alignment guide
4. **Use Manual Capture** button to take photos immediately
5. **Enable Auto Capture** checkbox for automatic detection when:
   - Image is sharp enough (sharpness > 120)
   - Proper edge detection (8-25% edge coverage)
   - Stable for 5 consecutive frames
6. **View captured images** in the gallery below the controls

## Technical Details

### Auto-Capture Algorithm

The system analyzes each video frame for:
- **Sharpness**: Using Sobel edge detection magnitude
- **Edge percentage**: Detecting rectangular objects like ID cards
- **Stability**: Ensuring consistent readings across multiple frames

### Backend Processing

- **Card detection**: Uses OpenCV contour detection
- **Perspective correction**: Automatically crops and straightens detected cards
- **Image optimization**: Returns processed images as base64 data

## Troubleshooting

- **Connection refused errors**: Ensure backend is running on port 8000
- **Camera not working**: Check browser permissions and HTTPS requirements
- **Auto-capture too sensitive**: Adjust thresholds in `CameraCapture.tsx`
- **No card detected**: Ensure good lighting and clear card visibility
