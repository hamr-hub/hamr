# hamr-browser 启动指南

## 项目概述
hamr-browser 是一个浏览器自动化 API 服务，基于 Python FastAPI + Playwright 构建，将浏览器操作流程包装为 HTTP API，支持 Cookie 持久化复用。

## repos/hamr-browser - hamr-browser

### 快速启动

```bash
cd repos/hamr-browser
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**启动后访问**：http://localhost:8000/docs

```yaml
subProjectPath: repos/hamr-browser
command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
cwd: repos/hamr-browser
port: 8000
previewUrl: http://localhost:8000/docs
description: Python FastAPI 浏览器自动化服务，使用 uvicorn 启动，端口 8000，API 文档访问 /docs
```
