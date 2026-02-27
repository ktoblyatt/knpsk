/**
 * ==========================================================================
 * CINEPLEX X - ULTIMATE ENGINE 2026
 * Architecture: Modular, Cached, Hardware-Accelerated, Accessible
 * ==========================================================================
 */

'use strict';

// =========================================
// 1. CONFIGURATION & STATE MANAGEMENT
// =========================================
const AppConfig = {
    storage: {
        history: 'cineplex_history',
        favorites: 'cineplex_favorites'
    },
    limits: {
        history: 15,
        similar: 15,
        actors: 4,
        directors: 2
    },
    api: {
        keysEndpoint: 'http://u92923sz.beget.tech/api_keys.php', // Путь к скрипту ротации ключей
        fallbackKey: '8c8e1a50-6322-4130-8a8f-123456789012',
        maxRetries: 3,
        baseUrl: 'https://kinopoiskapiunofficial.tech/api'
    }
};

const AppState = {
    currentMovieId: null,
    currentMovieData: null,
    shouldScroll: true,
    isDragging: false // Флаг блокировки случайных кликов при скролле карусели
};

// Кеш в оперативной памяти (мгновенное открытие уже загруженных фильмов)
const APICache = new Map(); 

// =========================================
// 2. DOM ELEMENTS CACHE
// =========================================
const DOM = {
    search: {
        input: document.getElementById('movieTitle'),
        autocomplete: document.getElementById('autocomplete'),
        section: document.querySelector('.search-section')
    },
    sections: {
        history: document.getElementById('historySection'),
        similar: document.getElementById('similarMovies'),
        movie: document.getElementById('movieInfo')
    },
    lists: {
        history: document.getElementById('movieHistory'),
        similar: document.getElementById('similarMoviesList')
    },
    movie: {
        backdrop: document.getElementById('movieBackdrop'),
        poster: document.getElementById('posterImage'),
        posterCard: document.querySelector('.movie-poster-card'),
        title: document.getElementById('movieTitleDisplay'),
        meta: document.getElementById('movieMeta'),
        ratingBadge: document.getElementById('movieRatingBadge'),
        badgeContainer: document.getElementById('movieBadge'),
        description: document.getElementById('description'),
        details: document.getElementById('movieDetails'),
        favoriteBtn: document.getElementById('favoriteBtn')
    },
    utils: {
        scrollTopBtn: document.getElementById('scrollTop')
    }
};

// =========================================
// 3. SECURE API & NETWORK LAYER
// =========================================
const NetworkManager = (function() {
    let keysCache = [];
    let lastKeysUpdate = 0;
    const TTL = 3600000; // 1 час

    async function loadKeys() {
        try {
            const res = await fetch(AppConfig.api.keysEndpoint, {
                credentials: 'include',
                headers: { 
                    'Content-Type': 'application/json', 
                    'X-Requested-With': 'XMLHttpRequest' 
                }
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            if (data.status !== 'success' || !data.keys || !data.keys.length) {
                throw new Error('Invalid keys format');
            }
            
            keysCache = data.keys;
            lastKeysUpdate = Date.now();
        } catch (e) {
            console.warn('API Key System Warning: Using fallback key.', e.message);
            if (!keysCache.length && AppConfig.api.fallbackKey) {
                keysCache = [AppConfig.api.fallbackKey];
            }
        }
    }

    async function getKey() {
        if (!keysCache.length || (Date.now() - lastKeysUpdate) > TTL) {
            await loadKeys();
        }
        if (!keysCache.length) throw new Error('Critical: No API keys available');
        
        return keysCache[Math.floor(Math.random() * keysCache.length)];
    }

    async function fetchWithRetry(endpoint, options = {}, useCache = true) {
        const url = `${AppConfig.api.baseUrl}${endpoint}`;
        
        if (useCache && APICache.has(url)) {
            return APICache.get(url);
        }

        let retries = 0;
        while (retries <= AppConfig.api.maxRetries) {
            try {
                const key = await getKey();
                const res = await fetch(url, {
                    ...options,
                    headers: { ...options.headers, 'X-API-KEY': key }
                });

                if (res.status === 403 || res.status === 402) {
                    await loadKeys();
                    retries++;
                    continue;
                }
                
                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                
                const data = await res.json();
                
                if (useCache) {
                    APICache.set(url, data); 
                }
                
                return data;

            } catch (err) {
                if (retries >= AppConfig.api.maxRetries) throw err;
                retries++;
            }
        }
    }

    return { 
        init: loadKeys, 
        fetch: fetchWithRetry 
    };
})();

// =========================================
// 4. UI/UX CONTROLLER
// =========================================
const UI = {
    showToast(message, type = 'success') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = 'position:fixed; bottom:40px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)';
        toast.style.cssText = `background:${bgColor}; color:white; padding:12px 24px; border-radius:50px; font-weight:500; font-size:14px; box-shadow:0 10px 30px rgba(0,0,0,0.6); backdrop-filter:blur(10px); opacity:0; transform:translateY(20px); transition:all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);`;
        
        toast.innerHTML = type === 'error' 
            ? `<i class="fas fa-exclamation-circle" style="margin-right:8px;"></i> ${message}` 
            : `<i class="fas fa-check-circle" style="margin-right:8px;"></i> ${message}`;
            
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    },

    setViewMode(mode) {
        if (mode === 'home') {
            DOM.search.section.classList.remove('hidden-state');
            StorageManager.renderHistory();
            DOM.sections.movie.classList.add('hidden-state');
            DOM.sections.similar.classList.add('hidden-state');
            document.title = "CINEPLEX X - Премиум Кинотеатр";
        } else {
            DOM.search.section.classList.add('hidden-state');
            DOM.sections.history.classList.add('hidden-state');
            DOM.sections.movie.classList.remove('hidden-state');
            DOM.sections.similar.classList.remove('hidden-state');
        }
    },

    initDragScroll(element) {
        let isDown = false;
        let startX;
        let scrollLeft;

        element.addEventListener('mousedown', (e) => {
            isDown = true;
            element.style.cursor = 'grabbing';
            element.style.scrollSnapType = 'none';
            startX = e.pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
            AppState.isDragging = false;
        });

        element.addEventListener('mouseleave', () => {
            isDown = false;
            element.style.cursor = 'pointer';
            element.style.scrollSnapType = 'x mandatory';
        });

        element.addEventListener('mouseup', () => {
            isDown = false;
            element.style.cursor = 'pointer';
            element.style.scrollSnapType = 'x mandatory';
            setTimeout(() => { AppState.isDragging = false; }, 50); 
        });

        element.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            AppState.isDragging = true;
            const walk = (e.pageX - element.offsetLeft - startX) * 2;
            element.scrollLeft = scrollLeft - walk;
        });
    },

    initParallax() {
        if (window.innerWidth < 1024) return;
        
        const container = DOM.sections.movie;
        const poster = DOM.movie.posterCard;
        let bounds;
        
        container.addEventListener('mouseenter', () => {
            bounds = poster.getBoundingClientRect();
            poster.style.transition = 'none';
        });

        container.addEventListener('mousemove', (e) => {
            requestAnimationFrame(() => {
                const center = { 
                    x: (e.clientX - bounds.x) - bounds.width / 2, 
                    y: (e.clientY - bounds.y) - bounds.height / 2 
                };
                
                // ИСПРАВЛЕНО: Максимальный наклон всего 4 градуса, движение очень плавное
                const maxRotation = 4;
                const rotateX = Math.max(-maxRotation, Math.min(maxRotation, center.y / 60));
                const rotateY = Math.max(-maxRotation, Math.min(maxRotation, -center.x / 60));
                
                poster.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            });
        });

        container.addEventListener('mouseleave', () => {
            poster.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            poster.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });
    }
};

// =========================================
// 5. STORAGE MANAGER
// =========================================
const StorageManager = {
    get(key) {
        try { 
            return JSON.parse(localStorage.getItem(key)) || []; 
        } catch { 
            return []; 
        }
    },
    
    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    addHistory(movie) {
        let history = this.get(AppConfig.storage.history);
        history = history.filter(item => item.id !== movie.id);
        history.unshift(movie);
        
        if (history.length > AppConfig.limits.history) {
            history = history.slice(0, AppConfig.limits.history);
        }
        
        this.set(AppConfig.storage.history, history);
    },

    renderHistory() {
        const history = this.get(AppConfig.storage.history);
        
        if (history.length > 0) {
            // ИСПРАВЛЕНО: Структура истории полностью совпадает с Similar Movies
            DOM.lists.history.innerHTML = history.map(movie => `
                <div class="movie-card" onclick="if(!AppState.isDragging) window.searchMovieById(${movie.id})">
                    <div class="similar-card-inner">
                        <img src="${movie.poster}" alt="${movie.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/150x225?text=X'">
                        <div class="similar-play-overlay"><i class="fas fa-play"></i></div>
                    </div>
                    <div class="movie-card-info">
                        <div class="movie-card-title text-truncate" title="${movie.name}">${movie.name}</div>
                        <div class="movie-card-year">${movie.year || ''}</div>
                    </div>
                </div>
            `).join('');
            DOM.sections.history.classList.remove('hidden-state');
        } else {
            DOM.sections.history.classList.add('hidden-state');
        }
    },

    toggleFavorite() {
        if (!AppState.currentMovieId || !AppState.currentMovieData) return;
        
        let favs = this.get(AppConfig.storage.favorites);
        const idx = favs.findIndex(m => m.id === AppState.currentMovieId);
        
        if (idx > -1) {
            favs.splice(idx, 1);
            UI.showToast('Removed from Favorites');
        } else {
            favs.unshift({ 
                id: AppState.currentMovieId, 
                name: AppState.currentMovieData.nameRu || AppState.currentMovieData.nameEn, 
                poster: AppState.currentMovieData.posterUrlPreview 
            });
            UI.showToast('Added to Favorites');
        }
        
        this.set(AppConfig.storage.favorites, favs);
        this.checkFavoriteState(AppState.currentMovieId);
    },

    checkFavoriteState(id) {
        const isFav = this.get(AppConfig.storage.favorites).some(m => m.id === id);
        const btn = DOM.movie.favoriteBtn;
        
        if (isFav) {
            btn.innerHTML = '<i class="fas fa-heart"></i> IN FAVORITES';
            btn.style.color = "var(--accent-purple)";
            btn.style.borderColor = "var(--accent-purple)";
            btn.style.background = "rgba(139, 92, 246, 0.1)";
        } else {
            btn.innerHTML = '<i class="far fa-heart"></i> ADD TO FAVORITES';
            btn.style.color = "white";
            btn.style.borderColor = "rgba(255,255,255,0.15)";
            btn.style.background = "rgba(255,255,255,0.05)";
        }
    }
};

// =========================================
// 6. MOVIE CONTROLLER
// =========================================
const MovieController = {
    async handleSearch() {
        const query = DOM.search.input.value.trim();
        if (!query) return;

        const btn = document.querySelector('.search-button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';

        try {
            const data = await NetworkManager.fetch(`/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`);
            if (data.films?.length > 0) {
                this.load(data.films[0].filmId);
            } else {
                UI.showToast('Movie not found', 'error');
            }
        } catch (error) {
            UI.showToast('Search error. Try again.', 'error');
        } finally {
            btn.innerHTML = originalHTML;
        }
    },

    async handleAutocomplete() {
        const query = DOM.search.input.value.trim();
        if (query.length < 2) {
            this.hideAutocomplete();
            return;
        }

        try {
            const data = await NetworkManager.fetch(`/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(query)}`);
            
            if (data.films?.length > 0) {
                // ИСПРАВЛЕНО: Рейтинг ужат вправо через Flexbox
                DOM.search.autocomplete.innerHTML = data.films.slice(0, 5).map(film => `
                    <div class="autocomplete-item" onclick="window.searchMovieById(${film.filmId})">
                        <div style="display:flex; align-items:center; gap:16px; flex: 1; overflow: hidden;">
                            <img src="${film.posterUrlPreview || ''}" style="width:38px; height:58px; object-fit:cover; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.5);" onerror="this.src='https://via.placeholder.com/38x58?text=X'">
                            <div style="overflow: hidden;">
                                <div style="font-weight:600; color:white; font-size:15px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${film.nameRu || film.nameEn}</div>
                                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">${film.year || ''}</div>
                            </div>
                        </div>
                        ${film.rating && film.rating !== 'null' ? `<div class="text-gold" style="font-weight:700; font-size: 14px; white-space: nowrap; margin-left:15px;"><i class="fas fa-star" style="font-size:11px;"></i> ${film.rating}</div>` : ''}
                    </div>
                `).join('');
                DOM.search.autocomplete.classList.remove('hidden-state');
            } else {
                this.hideAutocomplete();
            }
        } catch (e) {
            this.hideAutocomplete();
        }
    },

    hideAutocomplete() {
        DOM.search.autocomplete.classList.add('hidden-state');
    },

    async load(movieId) {
        if (AppState.currentMovieId === movieId) return;
        
        AppState.currentMovieId = movieId;
        AppState.shouldScroll = true;
        this.hideAutocomplete();

        // Скелетон загрузки
        DOM.movie.title.innerHTML = '<div class="skeleton-loader" style="width:70%; height:50px; margin-bottom:10px;"></div>';
        DOM.movie.description.innerHTML = '<div class="skeleton-loader" style="width:100%; height:80px;"></div>';
        DOM.movie.poster.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; 
        
        UI.setViewMode('movie');

        try {
            const movieData = await NetworkManager.fetch(`/v2.2/films/${movieId}`);
            AppState.currentMovieData = movieData;
            document.title = `${movieData.nameRu || movieData.nameEn} - CINEPLEX X`;
            
            this.render(movieData);
            this.renderDetails(movieData.kinopoiskId);
            this.fetchSimilar(movieData.kinopoiskId);
            
            if (movieData.kinopoiskId) {
                this.initPlayer(movieData.kinopoiskId);
            }
        } catch (error) {
            UI.showToast('Failed to load movie details.', 'error');
            resetToHome();
        }
    },

    render(movie) {
        const posterUrl = movie.posterUrl || 'https://via.placeholder.com/400x600?text=No+Poster';
        DOM.movie.poster.src = posterUrl;
        
        // Плавная подгрузка фона
        DOM.movie.backdrop.style.opacity = '0';
        setTimeout(() => {
            DOM.movie.backdrop.style.backgroundImage = `url('${movie.posterUrlPreview || posterUrl}')`;
            DOM.movie.backdrop.style.opacity = '0.15';
        }, 300);
        
        DOM.movie.title.textContent = movie.nameRu || movie.nameEn || 'Unknown Title';
        DOM.movie.description.textContent = movie.description || 'Description not available.';
        
        let rating = parseFloat(movie.ratingImdb || movie.ratingKinopoisk || 0.0);
        DOM.movie.ratingBadge.textContent = isNaN(rating) ? 'N/A' : rating;
        DOM.movie.badgeContainer.style.display = rating > 0 ? 'flex' : 'none';
        
        DOM.movie.meta.innerHTML = `<span>${movie.year || ''}</span> &bull; <span>${movie.genres?.[0]?.genre || ''}</span>`;
        
        StorageManager.checkFavoriteState(movie.kinopoiskId);
        
        if (AppState.shouldScroll) {
            setTimeout(() => { 
                window.scrollTo({top: 0, behavior: 'smooth'}); 
                AppState.shouldScroll = false; 
            }, 100);
        }
        
        StorageManager.addHistory({
            id: movie.kinopoiskId,
            name: movie.nameRu || movie.nameEn,
            poster: movie.posterUrlPreview || posterUrl,
            year: movie.year
        });
    },

    async renderDetails(movieId) {
        DOM.movie.details.innerHTML = '<div class="skeleton-loader" style="width:200px; height:20px;"></div>';
        try {
            const staffData = await NetworkManager.fetch(`/v1/staff?filmId=${movieId}`);
            const formatStaff = (type, limit) => staffData.filter(p => p.professionKey === type).slice(0, limit).map(p => p.nameRu || p.nameEn).join(', ');
            
            const details = [
                { t: 'Director', v: formatStaff('DIRECTOR', AppConfig.limits.directors) },
                { t: 'Cast', v: formatStaff('ACTOR', AppConfig.limits.actors) }
            ];
            
            DOM.movie.details.innerHTML = details.filter(d => d.v).map(d => `<div style="margin-bottom: 8px;"><b>${d.t}:</b> ${d.v}</div>`).join('');
        } catch (e) {
            DOM.movie.details.innerHTML = '';
        }
    },

    async fetchSimilar(movieId) {
        try {
            const data = await NetworkManager.fetch(`/v2.2/films/${movieId}/similars`);
            if (data.items?.length > 0) {
                const validMovies = data.items.filter(m => m.posterUrlPreview).slice(0, AppConfig.limits.similar);
                
                DOM.lists.similar.innerHTML = validMovies.map(movie => `
                    <div class="movie-card" onclick="if(!AppState.isDragging) window.searchMovieById(${movie.filmId})">
                        <div class="similar-card-inner">
                            <img src="${movie.posterUrlPreview}" alt="${movie.nameRu}" loading="lazy" onerror="this.src='https://via.placeholder.com/150x225?text=X'">
                            <div class="similar-play-overlay"><i class="fas fa-play"></i></div>
                        </div>
                        <div class="movie-card-info">
                            <div class="movie-card-title text-truncate" title="${movie.nameRu || movie.nameEn}">${movie.nameRu || movie.nameEn}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                DOM.lists.similar.innerHTML = '<div style="color:var(--text-muted)">No similar movies found.</div>';
            }
        } catch (error) {
            DOM.lists.similar.innerHTML = '';
        }
    },

    initPlayer(movieId) {
        if (typeof initAllohaPlayer === 'function') {
            initAllohaPlayer(movieId);
        } else if (typeof kbox !== 'undefined') {
            kbox('.kinobox_player', { search: { kinopoisk: movieId } }).init();
        } else {
            console.warn('Player script not detected.');
        }
    }
};

// =========================================
// 7. BOOTSTRAPPER & EVENTS
// =========================================
let debounceTimer;
function debounce(func, wait) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), wait);
    };
}

// Глобальные экспорты
window.searchMovie = () => MovieController.handleSearch();
window.searchMovieById = (id) => MovieController.load(id);
window.selectAutocompleteItem = (id) => { 
    MovieController.hideAutocomplete(); 
    MovieController.load(id); 
};
window.resetToHome = () => {
    AppState.currentMovieId = null; 
    UI.setViewMode('home'); 
    DOM.search.input.value = ''; 
    MovieController.hideAutocomplete();
    document.getElementById('player_iframe').innerHTML = ''; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    await NetworkManager.init();
    
    UI.initDragScroll(DOM.lists.history);
    UI.initDragScroll(DOM.lists.similar);
    UI.initParallax();
    
    DOM.search.input.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') MovieController.handleSearch(); 
    });
    
    DOM.search.input.addEventListener('input', debounce(() => MovieController.handleAutocomplete(), 300));
    
    document.addEventListener('click', (e) => { 
        if (!e.target.closest('.search-glass-container')) {
            MovieController.hideAutocomplete(); 
        }
    });
    
    DOM.movie.favoriteBtn.addEventListener('click', () => StorageManager.toggleFavorite());
    
    DOM.utils.scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    
    window.addEventListener('scroll', () => { 
        DOM.utils.scrollTopBtn.classList.toggle('visible', window.pageYOffset > 400); 
    });
    
    UI.setViewMode('home');
});