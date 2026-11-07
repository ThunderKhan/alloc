FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TORCH_HOME=/models ALLOC_VERIFY_CACHED_WEIGHTS=1
WORKDIR /srv
RUN pip install --no-cache-dir torch==2.10.0 torchvision==0.25.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# Bake fixed official weights into image/cache before accepting any payment.
RUN python -c "from torchvision.models import mobilenet_v3_small,MobileNet_V3_Small_Weights;mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)"
RUN echo "047dcff4addef86ea5bc2eff13c9614dc11f47ab1160d0a71a25e7db994f4e1f  /models/hub/checkpoints/mobilenet_v3_small-047dcff4.pth" | sha256sum -c -
USER 65534
EXPOSE 8000
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8000","--workers","1"]
