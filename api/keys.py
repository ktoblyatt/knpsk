from http.server import BaseHTTPRequestHandler
import json
import os
import time

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Читаем ключи из переменных окружения Vercel
        # Вы можете добавить их сколько угодно в панели Vercel (API_KEY_1, API_KEY_2 и т.д.)
        keys = []
        for i in range(1, 4):  # Пример для 3-х ключей
            key = os.environ.get(f'API_KEY_{i}')
            if key:
                keys.append(key)

        # Если переменные не настроены, вернем пустой список или ошибку
        if not keys:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Keys not configured"}).encode())
            return

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        # Разрешаем запросы только с вашего домена для безопасности
        self.send_header('Access-Control-Allow-Origin', '*') 
        self.end_headers()

        response = {
            'status': 'success',
            'keys': keys,
            'timestamp': int(time.time()),
            'keysCount': len(keys)
        }
        
        self.wfile.write(json.dumps(response).encode())
