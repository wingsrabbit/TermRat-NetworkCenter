# ============================================================
# ONC — 单镜像多阶段：构建前端 → Python 运行后端
# 最终一个容器同时服务前端 + API + SQLite
# ============================================================

# ---- 阶段 1：构建前端（Vite/React）----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 阶段 2：运行后端（Flask + gunicorn）----
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
COPY backend/ ./
COPY VERSION ./VERSION
# 前端构建产物作为静态资源
COPY --from=frontend /fe/dist ./static

ENV STATIC_DIR=/app/static \
    DATA_DIR=/app/data \
    PYTHONUNBUFFERED=1
EXPOSE 8080
VOLUME ["/app/data"]

CMD ["gunicorn", "-b", "0.0.0.0:8080", "-w", "2", "--timeout", "60", "app:app"]
