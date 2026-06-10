FROM python:3.12-slim

# 让 stdout 不缓冲，docker logs 能实时看到日志
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 先装依赖（用清华镜像源，国内拉取更快），利用层缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 再拷贝 agent 代码
COPY probes.py resources.py main.py ./

CMD ["python", "main.py"]
