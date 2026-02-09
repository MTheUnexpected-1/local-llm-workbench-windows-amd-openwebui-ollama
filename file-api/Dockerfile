FROM python:3.11-slim
WORKDIR /app
COPY file_api.py /app/file_api.py
RUN pip install --no-cache-dir fastapi uvicorn[standard]
EXPOSE 8001
CMD ["uvicorn", "file_api:app", "--host", "0.0.0.0", "--port", "8001"]
