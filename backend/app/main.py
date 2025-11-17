from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from .process import read_image_from_bytes, detect_card_and_crop, image_to_base64

app = FastAPI()

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
