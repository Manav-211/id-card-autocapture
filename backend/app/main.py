from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .process import read_image_from_bytes, detect_card_and_crop, image_to_base64

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process")
async def process(file: UploadFile = File(...)):
    contents = await file.read()
    img = read_image_from_bytes(contents)
    if img is None:
        return JSONResponse({"error": "invalid image"}, status_code=400)
    cropped = detect_card_and_crop(img)
    if cropped is None:
        return JSONResponse({"error": "no_card_detected"}, status_code=422)
    cropped_b64 = image_to_base64(cropped)
    return {"cropped_base64": cropped_b64}
