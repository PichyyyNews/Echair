# Echair Production Deployment

ชุดนี้ใช้ `docker compose` + `nginx` สำหรับ deploy แบบมี reverse proxy และรองรับ path prefix เช่น:

- `https://www.example.com/chair-demo/`
- `https://www.example.com/chair-demo/api/`
- `https://www.example.com/chair-demo/socket.io/`
- `https://www.example.com/chair-demo/uploads/`

## Services

| Service | URL | Notes |
| --- | --- | --- |
| Client App | `/<project-name>/` หรือ `/` | React client |
| API Server | `/<project-name>/api/` | Express backend |
| Socket.IO | `/<project-name>/socket.io/` | Realtime |
| Uploads | `/<project-name>/uploads/` | Uploaded files |

## Quick Start

1. Copy env

```bash
cp .env.example .env
```

2. Fill the important values in `.env`

- `CLIENT_PUBLIC_URL=/chair-demo`
- `CLIENT_URL=https://www.example.com/chair-demo`
- `JWT_SECRET=...`
- `EMAIL_USER=...`
- `EMAIL_PASS=...`
- `MONGODB_URI=...`

3. Put your Firebase service account JSON at the path set in `FIREBASE_SERVICE_ACCOUNT_PATH`

4. Build and start

```bash
docker compose up -d --build
```

## Important Notes

- `CLIENT_PUBLIC_URL` ต้องเป็น path prefix และห้ามมี `/` ท้าย เช่น `/chair-demo`
- `CLIENT_URL` ต้องรวม prefix เดียวกันด้วย เพราะระบบ reset password จะใช้ค่านี้สร้างลิงก์
- `production-build/nginx.conf` ถูกใช้เป็น nginx template ผ่าน `envsubst`
- ถ้าไม่กำหนด `REACT_APP_API_BASE_URL`, frontend จะใช้ `CLIENT_PUBLIC_URL` เดียวกันเป็น base ของ API/socket/uploads อัตโนมัติ

## Local Example

ถ้าตั้งค่าแบบนี้:

```env
CLIENT_PUBLIC_URL=/chair-app
CLIENT_URL=http://localhost/chair-app
```

หลัง deploy แล้ว URL หลักจะเป็น:

- `http://localhost/chair-app/`
- `http://localhost/chair-app/api/health`
- `http://localhost/chair-app/socket.io/`

## Useful Commands

```bash
docker compose ps
docker compose logs -f
docker compose logs -f server
docker compose down
docker compose up -d --build
docker compose down -v
```
