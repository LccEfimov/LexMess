# LexMess: API + WebSocket (WS) wiring

## Mobile app endpoints

Файл: `src/config/networkConfig.ts`

- `API_BASE_URL` — HTTP(S) API (FastAPI)
- `WS_BASE_URL` — WS(S) база (без суффикса `/ws`)

По умолчанию:
- Debug (эмулятор Android): `http://10.0.2.2:8000` и `ws://10.0.2.2:8000`
- Release (prod): `https://api.lexmess.ru` и `wss://api.lexmess.ru`

`wsClient` подключается к `WS_URL = ${WS_BASE_URL}/ws` и передаёт query:

- `token` — access token
- `room_id` — id комнаты

## Сервер (FastAPI)

Минимальный набор:

- HTTP API под `/v1/...`
- WS endpoint: `/ws`

Пример (схематично):

```py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

@app.get("/ping")
async def ping():
    return {"ok": True}

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    # TODO: validate token from query params
    try:
        while True:
            msg = await ws.receive_text()
            await ws.send_text(msg)
    except WebSocketDisconnect:
        pass
```

## Nginx (api.lexmess.ru)

Важно проксировать Upgrade для WebSocket.

```nginx
server {
  server_name api.lexmess.ru;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws {
    proxy_pass http://127.0.0.1:8000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Типовые проблемы

- Если WS не коннектится в проде: проверь, что используется `wss://` и Nginx отдаёт корректный SSL.
- Если connect проходит, но сообщений нет: проверь формат событий (`type`, `payload`) и совпадение query (`room_id`).
