FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TORCH_HOME=/models
WORKDIR /srv
RUN pip install --no-cache-dir torch==2.10.0 torchvision==0.25.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# Bake fixed official weights into image/cache before accepting any payment.
RUN python -c "from torchvision.models import mobilenet_v3_small,MobileNet_V3_Small_Weights;mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)"
USER 65534
EXPOSE 8000
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8000","--workers","1"]
