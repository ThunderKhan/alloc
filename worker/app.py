"""Private, CPU-only MobileNetV3-Small inference service. No public inference endpoint."""
from __future__ import annotations

import hashlib
import io
import os
import time
from pathlib import Path
import warnings
from contextlib import asynccontextmanager
from typing import Annotated

import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000
MODEL_ID = "mobilenet-v3-small"
WEIGHTS_ID = "IMAGENET1K_V1"
WEIGHTS = MobileNet_V3_Small_Weights.IMAGENET1K_V1
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
torch.set_num_threads(int(os.getenv("TORCH_THREADS", "2")))

_model = None
_forward_count = 0


class Prediction(BaseModel):
    label: str
    score: float


class InferenceResult(BaseModel):
    modelId: str
    weightsId: str
    inputSha256: str
    predictions: list[Prediction]
    inferenceMs: int


def require_auth(authorization: str | None) -> None:
    import hmac
    expected = os.environ.get("WORKER_TOKEN", "")
    if not expected or not authorization or not hmac.compare_digest(
        authorization, "Bearer " + expected
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


def decode_image(data: bytes) -> tuple[Image.Image, str]:
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 5 MiB limit")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as img:
                if img.format not in ("JPEG", "PNG"):
                    raise ValueError("Only JPEG or PNG is allowed")
                if getattr(img, "n_frames", 1) != 1 or getattr(img, "is_animated", False):
                    raise ValueError("Animated input is not allowed")
                w, h = img.size
                if not w or not h or w * h > MAX_PIXELS:
                    raise ValueError("Image is over 16 megapixels")
                fmt = img.format
                img.load()
                rgb = ImageOps.exif_transpose(img).convert("RGB")
                rgb.info.clear()
                return rgb, fmt
    except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombWarning,
            Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=422, detail="Invalid or unsupported image") from exc


def load_model() -> None:
    global _model
    # Docker insists on a pre-staged, full-SHA256 verified weight file before
    # deserialization. Missing or tampered weights fail closed before any quote.
    if os.getenv("ALLOC_VERIFY_CACHED_WEIGHTS") == "1":
        cache = Path(os.environ.get("TORCH_HOME", str(Path.home() / ".cache" / "torch")))
        file = cache / "hub/checkpoints/mobilenet_v3_small-047dcff4.pth"
        expected = "047dcff4addef86ea5bc2eff13c9614dc11f47ab1160d0a71a25e7db994f4e1f"
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise RuntimeError("Pinned MobileNetV3 Small weights missing or SHA256 mismatch")
    model = mobilenet_v3_small(weights=WEIGHTS)
    model.eval()
    model.to("cpu")
    with torch.inference_mode():
        model(torch.zeros(1, 3, 224, 224))
    _model = model


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()  # Fail startup rather than accept payment before weights are available.
    yield


app = FastAPI(title="Alloc private worker", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/ready")
async def ready(authorization: Annotated[str | None, Header()] = None):
    require_auth(authorization)
    if _model is None:
        raise HTTPException(status_code=503, detail="Model unavailable")
    return {"ready": True, "modelId": MODEL_ID, "weightsId": WEIGHTS_ID}


@app.post("/validate")
async def validate(
    image: Annotated[UploadFile, File()],
    authorization: Annotated[str | None, Header()] = None,
):
    require_auth(authorization)
    data = await image.read(MAX_BYTES + 1)
    rgb, fmt = decode_image(data)
    return {
        "inputSha256": hashlib.sha256(data).hexdigest(),
        "width": rgb.width, "height": rgb.height, "format": fmt,
    }


@app.post("/infer", response_model=InferenceResult)
async def infer(
    image: Annotated[UploadFile, File()],
    executionId: Annotated[str, Form()],
    inputSha256: Annotated[str, Form()],
    modelId: Annotated[str, Form()],
    weightsId: Annotated[str, Form()],
    authorization: Annotated[str | None, Header()] = None,
):
    global _forward_count
    require_auth(authorization)
    if _model is None:
        raise HTTPException(status_code=503, detail="Model unavailable")
    if not executionId or len(executionId) > 100 or modelId != MODEL_ID or weightsId != WEIGHTS_ID:
        raise HTTPException(status_code=422, detail="Unsupported inference request")
    data = await image.read(MAX_BYTES + 1)
    digest = hashlib.sha256(data).hexdigest()
    if not __import__("hmac").compare_digest(digest, inputSha256):
        raise HTTPException(status_code=422, detail="Input digest mismatch")
    rgb, _ = decode_image(data)
    t0 = time.perf_counter()
    tensor = WEIGHTS.transforms()(rgb).unsqueeze(0)
    with torch.inference_mode():
        logits = _model(tensor)
        probabilities = logits[0].softmax(0)
        scores, indexes = torch.topk(probabilities, 3)
        _forward_count += 1
    elapsed = round((time.perf_counter() - t0) * 1000)
    labels = WEIGHTS.meta["categories"]
    return InferenceResult(
        modelId=MODEL_ID, weightsId=WEIGHTS_ID,
        inputSha256=digest, inferenceMs=elapsed,
        predictions=[
            Prediction(label=labels[int(idx)], score=float(score))
            for score, idx in zip(scores, indexes)
        ],
    )
