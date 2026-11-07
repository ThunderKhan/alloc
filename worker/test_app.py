import hashlib
import io
import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

os.environ["WORKER_TOKEN"] = "test-only-worker-token"
import app as worker

@pytest.fixture
def client():
    # Validation tests must not trigger a model download/forward pass.
    return TestClient(worker.app, raise_server_exceptions=True)

def png(color="red"):
    img = Image.new("RGB", (24, 24), color)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def headers():
    return {"Authorization": "Bearer test-only-worker-token"}

def test_auth_blocks_all_worker_endpoints(client):
    image = png()
    assert client.get("/ready").status_code == 401
    assert client.post("/validate", files={"image": ("image.png", image)}).status_code == 401
    assert client.post("/infer", files={"image": ("image.png", image)}, data={
        "executionId": "x", "inputSha256": hashlib.sha256(image).hexdigest(),
        "modelId": worker.MODEL_ID, "weightsId": worker.WEIGHTS_ID
    }).status_code == 401

def test_validate_does_not_infer(client):
    before = worker._forward_count
    image = png()
    response = client.post("/validate", headers=headers(),
        files={"image": ("image.png", image, "image/png")})
    assert response.status_code == 200
    assert response.json()["inputSha256"] == hashlib.sha256(image).hexdigest()
    assert worker._forward_count == before

@pytest.mark.parametrize("data", [b"", b"hello", b"x" * (worker.MAX_BYTES + 1)])
def test_bad_data_rejected(client, data):
    response = client.post("/validate", headers=headers(),
        files={"image": ("x.png", data, "image/png")})
    assert response.status_code in (413, 422)

def test_digest_mismatch_never_calls_model(client):
    image = png("blue")
    before = worker._forward_count
    with patch.object(worker, "_model", object()):
        res = client.post("/infer", headers=headers(),
            files={"image": ("x.png", image, "image/png")},
            data={"executionId": "x", "modelId": worker.MODEL_ID,
                  "weightsId": worker.WEIGHTS_ID, "inputSha256": "0"*64})
    assert res.status_code == 422
    assert worker._forward_count == before

@pytest.mark.live_model
def test_real_cpu_inference_on_two_fresh_images():
    # Explicit opt-in (downloads upstream weights if absent); not a mock.
    if os.getenv("ALLOC_REAL_MODEL_TEST") != "1":
        pytest.skip("Set ALLOC_REAL_MODEL_TEST=1 with cached weights")
    worker.load_model()
    with TestClient(worker.app) as client:
        results = []
        for color in ("red", "blue"):
            image = png(color)
            response = client.post("/infer", headers=headers(), files={
                "image": ("fresh.png", image, "image/png")
            }, data={"executionId": color, "modelId": worker.MODEL_ID,
                     "weightsId": worker.WEIGHTS_ID, "inputSha256": hashlib.sha256(image).hexdigest()})
            assert response.status_code == 200, response.text
            payload = response.json()
            scores = [p["score"] for p in payload["predictions"]]
            assert len(scores) == 3
            assert all(0 <= x <= 1 for x in scores)
            assert scores == sorted(scores, reverse=True)
            results.append(payload)
        assert results[0]["inputSha256"] != results[1]["inputSha256"]
