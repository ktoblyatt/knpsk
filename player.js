/**
 * player.js - Инициализация плеера Alloha (Исправленная версия)
 */

function initAllohaPlayer(movieId) {
    if (!movieId) {
        console.error('Ошибка: ID фильма не передан');
        return;
    }

    const playerContainer = document.getElementById('player_iframe');
    if (!playerContainer) {
        console.error('Ошибка: Блок player_iframe не найден');
        return;
    }

    // 1. Очищаем контейнер от старого плеера при переключении фильмов
    playerContainer.innerHTML = '';

    // 2. Задаем глобальные параметры ДО загрузки скрипта
    window.param_cdn = {
        player_id: 'player_iframe', // Убрал '#', обычно скрипты хотят просто ID, но если не сработает - верни '#player_iframe'
        kp: movieId,
        token: 'dda4cc17d8923cbde0cf9d82806535',
        width: '100%',
        height: '100%',
        calback_success: function(response) {
            console.log('Успешная загрузка плеера Alloha:', response);
        },
        calback_error: function(error) {
            console.error('Ошибка загрузки плеера Alloha:', error);
        }
    };

    // 3. Удаляем старый скрипт Аллохи, если он остался от предыдущего фильма
    const oldScript = document.getElementById('alloha-script');
    if (oldScript) {
        oldScript.remove();
    }

    // 4. Создаем и загружаем скрипт заново, чтобы он "прочитал" новые параметры
    const script = document.createElement('script');
    script.id = 'alloha-script';
    script.src = 'https://allohatv.github.io/insert-player.js';
    script.async = true;
    
    script.onload = function() {
        console.log(`Скрипт Alloha загружен для фильма ${movieId}`);
    };
    script.onerror = function() {
        console.error('Ошибка загрузки скрипта Alloha');
    };

    document.body.appendChild(script);
}

// Экспортируем функцию для вызова из main.js
window.initAllohaPlayer = initAllohaPlayer;