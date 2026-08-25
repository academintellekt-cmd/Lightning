# Руководство по развёртыванию Strivex

## Архитектура системы

```
Машина зала (venue machine)
├── Lightning Attraction.exe   ← портативная игра (WS-сервер на порту 4200)
└── StrivexGateway (служба)   ← шлюз: NFC-ридер, связь с игрой и сервером

Серверная машина (back-office)
└── Strivex Server (Docker)   ← REST API, SQLite, веб-интерфейс персонала (порт 3000)
```

Поток событий:
1. Гость прикладывает NFC-карту к ридеру
2. Шлюз считывает UID карты → запрашивает сервер (`GET /lookup/:uid`)
3. Сервер возвращает данные игрока (или отказ)
4. Шлюз подключается к игре по WebSocket → отправляет `unlock`
5. Игра запускает сессию, выводит результат
6. Шлюз получает `session_result` → отправляет результат на сервер (`POST /results`)

---

## 1. Серверная машина — Strivex Server

### Требования
- Docker Desktop + Docker Compose

### Развёртывание

```bash
git clone <repo-url> C:\strivex
cd C:\strivex
docker compose up -d
curl http://localhost:3000/health
```

Веб-интерфейс персонала: `http://<IP-сервера>:3000`

---

## 2. Машина зала — Игра (Lightning Attraction)

### Требования
- Windows 10/11, портативное приложение (установка не нужна)

### Установка

1. Скопировать `Lightning-Attraction.exe` в папку (например, `C:\games\lightning\`)
2. Запустить — игра слушает WebSocket на порту **4200**
3. Автозагрузка: Win+R → `shell:startup` → создать ярлык на exe

> **Важно:** Игра должна быть запущена **до** старта шлюза.

---

## 3. Машина зала — Strivex Gateway (служба Windows)

### Требования
- Node.js 18+ в PATH
- NSSM (https://nssm.cc/download)
- NFC PC/SC ридер (USB)
- Права администратора

### Установка

```bat
git clone <repo-url> C:\strivex
cd C:\strivex\gateway
npm install
cd ..
copy gateway\.env.example gateway\.env
notepad gateway\.env
```

### Настройка gateway\.env

```env
STATION_ID=station-01
SERVER_URL=http://192.168.1.10:3000
STATION_KEY=ваш-секретный-ключ
ADAPTER=gameserver
GAME_WS_URL=ws://127.0.0.1:4200
HEARTBEAT_MS=30000
GAME_TIMEOUT_MS=120000
GATEWAY_UI_PORT=4100
DATA_DIR=./data
```

### Установка службы (от Администратора)

```bat
cd C:\strivex
scripts\install-service.bat
```

### Управление службой

```bat
nssm status StrivexGateway
nssm stop StrivexGateway
nssm start StrivexGateway
nssm restart StrivexGateway
scripts\uninstall-service.bat   # удалить
```

### Логи и мониторинг

- `C:\strivex\logs\gateway-stdout.log`
- `C:\strivex\logs\gateway-stderr.log`
- Веб-мониторинг: `http://127.0.0.1:4100`

---

## 4. Порядок запуска

1. Серверная машина: `docker compose ps` — убедиться что запущен
2. Машина зала: запустить `Lightning Attraction.exe`
3. Машина зала: `StrivexGateway` стартует автоматически при загрузке Windows

---

## 5. Проверка работы

```
# Сервер
curl http://192.168.1.10:3000/health

# Шлюз
Открыть http://127.0.0.1:4100
```

В логах шлюза при успешном запуске:
```
[gateway] connected to game ws://127.0.0.1:4200
[gateway] heartbeat ok
```

При прикладывании карты:
```
[nfc] card detected: <uid>
[server] lookup ok: <player-name>
[game] unlock sent
[game] session_result received
[server] result posted
```

---

## 6. Обновление

```bat
# Шлюз
cd C:\strivex && git pull
cd gateway && npm install && cd ..
nssm restart StrivexGateway

# Игра: заменить .exe на новую версию

# Сервер
git pull && docker compose pull && docker compose up -d
```
