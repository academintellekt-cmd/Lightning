# Lightning — интеграция StriveX

Дата обновления: 3 ноября 2026 года. Версия Lightning: 2.2.0.

## Путь к проекту

```text
D:\Git\LavaJump\Lightning\Game
```

## Архитектура

- `main.js` — Electron, два окна, Arduino Serial Bridge и запуск локального сервера управления StriveX.
- `preload.js` — безопасный IPC между Electron и интерфейсом.
- `public/app.js` — интерфейс, игровые состояния, джойстики и жизненный цикл оплаченной сессии.
- `lib/strivex-session.js` — изолированный WebSocket-модуль нового Gateway Game Control Protocol.
- `lib/serial-bridge.js` — независимый COM-канал Arduino Nano.
- `lib/game-engine.js`, `lib/color-engine.js`, `lib/advanced-engine.js` — игровые механики.
- `arduino/Lightning_LED_Controller_Nano/Lightning_LED_Controller_Nano.ino` — прошивка LED-контроллера.

Главный StriveX Server хранит пользователей, браслеты, сессии и результаты. Gateway на ПК аттракциона читает RFID, проверяет браслет на сервере и подключается как WebSocket-клиент к Lightning. Lightning является локальным WebSocket-сервером.

```text
StriveX Server :3000 ← Ethernet → Gateway :4100
                                      |
                         ws://127.0.0.1:4200
                                      |
                                  Lightning
                                      |
                             Arduino COM, 115200
```

## Жизненный цикл сессии

1. Без разрешения Gateway Lightning находится в состоянии `locked`; запуск без карточки недоступен.
2. Два зарегистрированных браслета собирают пару в лобби. После «Старт» Gateway отправляет `unlock` для выбранного раунда.
3. Lightning сохраняет `session_id`, игроков и оплаченное время и сразу запускает отсчёт. На обоих экранах отображается таймер раунда.
4. После GAME OVER, результатов и таблицы лидеров Lightning отправляет ровно один `session_result` и очищает пару. Для следующего раунда нужны повторные сканирования браслетов; баланс оплаченного времени остаётся на сервере.
5. По окончании оплаченного времени, блокировке, входу техника или ошибке текущая сессия также завершается единственным `session_result`.
7. Интерфейс возвращается в `locked` и ждёт следующий браслет.

## Протокол Gateway Game Control

Транспорт: JSON-over-WebSocket, один JSON-объект в одном WebSocket frame.

Gateway → Lightning:

```json
{"type":"unlock","session_id":"uuid","user":{"uid":"bracelet-uid","name":"Player"},"paid_seconds":300}
{"type":"lock","reason":"expired"}
```

Lightning → Gateway:

```json
{"type":"hello","game":"LIGHTNING","version":"2.2.0","protocol":1}
{"type":"ready"}
{"type":"session_result","session_id":"uuid","score":850,"status":"completed","meta":{"rounds":[]}}
```

Допустимые итоги: `completed`, `timeout`, `abandoned`, `failed`. Повторный `unlock` той же активной сессии игнорируется. После одного итога повторная отправка блокируется.

## Порты и адреса

- StriveX Server: `http://<server-ip>:3000`.
- Lightning Game Control: `ws://127.0.0.1:4200`.
- Gateway UI: `http://127.0.0.1:4100`.
- Arduino Nano: отдельный `COMx`, 115200 baud; по умолчанию `auto`.
- Устаревший COM-транспорт StriveX оставлен в исходниках для совместимости, но штатная конфигурация использует WebSocket.

## Настройки Lightning

В `config.json`:

```json
"strivex": {
  "enabled": true,
  "transport": "websocket",
  "wsHost": "127.0.0.1",
  "wsPort": 4200,
  "developmentMode": false
},
"rfid": { "enabled": false },
"offline": { "enabled": false }
```

Поддерживаются переменные окружения `STRIVEX_ENABLED`, `STRIVEX_TRANSPORT`, `STRIVEX_WS_PORT`; для legacy-транспорта также `STRIVEX_SERIAL_PORT`, `STRIVEX_SERIAL_BAUD`, `STRIVEX_RECONNECT_MS`.

## Настройки Gateway

В `gateway/.env`:

```env
STATION_ID=lightning-01
SERVER_URL=http://192.168.1.10:3000
STATION_KEY=change-me-station-secret
ADAPTER=gameserver
GAME_WS_URL=ws://127.0.0.1:4200
HEARTBEAT_MS=30000
DATA_DIR=./data
GATEWAY_UI_PORT=4100
```

## Изменённые и добавленные файлы

- `main.js`
- `public/app.js`
- `public/style.css`
- `config.json`
- `package.json`
- `package-lock.json`
- `lib/strivex-session.js`
- `tests/strivex-session.test.js`
- `tests/integration-guards.test.js`
- `STRIVEX_SERVER_START.md`
- `README_STRIVEX.md`
- `STRIVEX_INTEGRATION.md`

## Установка, проверка, запуск и сборка

```bat
cd /d "C:\path\to\lightning_windows"
npm install --include=dev
npm run check
scripts\start-dev.bat
```

Сборка portable EXE:

```bat
scripts\build-exe.bat
```

Подробная настройка сервера и порядок ежедневного запуска приведены в `STRIVEX_SERVER_START.md`.

## Результаты тестов

Успешно выполнены все имеющиеся тесты:

- четыре базовых режима — 200 итераций;
- цветовые режимы — 300 итераций;
- независимое подтверждение «Цветового кода»;
- «Цветовая мелодия» без кнопки 8;
- расширенные игровые режимы;
- неблокирующий Arduino-протокол;
- защита переходов музыки и Serial-очереди;
- legacy StriveX protocol;
- новый реальный WebSocket handshake, `unlock`, защита от дубликата, единственный итог, `lock` и следующая сессия.

## Оставшиеся проверки

- Реальный RFID-считыватель, физический Gateway, сеть и сервер в автоматических тестах не эмулировались; их нужно проверить на целевом комплекте.
- Portable EXE не собран в этой рабочей копии, поскольку `node_modules` намеренно не хранится в исходном архиве. Он собирается командой выше.
- Следует проверить расположение двух окон при фактическом разрешении, ориентации и масштабе Windows.
- Результат, сформированный после физического разрыва локального WebSocket, Lightning намеренно не отправляет повторно. Crash-safe очередь находится на стороне Gateway после получения результата.
