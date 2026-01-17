// Nordisk Auto - Dynamisk bilvisning
// Henter biler fra data/cars.json (oppdateres av fetch-cars.ps1)

const CONFIG = {
    dataUrl: 'data/cars.json',
    finnOrgUrl: 'https://www.finn.no/mobility/search/car?orgId=1031027521',
    carsPerPage: 9  // Antall biler som vises initialt
};

// DOM-elementer
let carsGrid, filterContainer, loadMoreBtn;
let allCars = [];
let visibleCount = CONFIG.carsPerPage;
let currentFilter = 'all';

// Initialiser når DOM er klar
document.addEventListener('DOMContentLoaded', () => {
    carsGrid = document.getElementById('cars-grid');
    filterContainer = document.querySelector('.filter-container');
    
    loadCars();
    initHeaderScroll();
    initMobileNav();
    initSmoothScroll();
});

// Hent og vis biler
async function loadCars() {
    try {
        const response = await fetch(CONFIG.dataUrl);
        
        if (!response.ok) {
            throw new Error('Kunne ikke laste bildata');
        }
        
        const data = await response.json();
        
        if (data.cars && data.cars.length > 0) {
            allCars = data.cars;
            visibleCount = CONFIG.carsPerPage;
            renderCars(getVisibleCars());
            renderFilters(data.stats);
            updateStats(data.stats);
            initFilterFunctionality();
            initLoadMore();
            initStatsAnimation();
        } else {
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Feil ved lasting av biler:', error);
        showErrorState();
    }
}

// Render bilkort
function renderCars(cars) {
    carsGrid.innerHTML = cars.map(car => `
        <div class="car-card" data-type="${car.filterType}">
            <div class="car-image">
                <img src="${car.image}" alt="${car.title}" onerror="this.src='assets/images/placeholder.jpg'">
            </div>
            <div class="car-content">
                <div class="car-brand">${car.brand}</div>
                <h3 class="car-title">${car.title}</h3>
                <div class="car-specs">
                    <span class="car-spec">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                        </svg>
                        ${car.year || 'Ukjent'}
                    </span>
                    <span class="car-spec">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/>
                        </svg>
                        ${Array.isArray(car.mileage) ? car.mileage[1] : car.mileage}
                    </span>
                    <span class="car-spec">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                        ${car.fuelType || 'Ukjent'}
                    </span>
                </div>
                <div class="car-footer">
                    <div class="car-price">${car.priceFormatted} <span>kr</span></div>
                    <a href="${car.finnUrl}" target="_blank" class="car-link">
                        Detaljer
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// Hent synlige biler basert på filter og antall
function getVisibleCars() {
    let filtered = allCars;
    if (currentFilter !== 'all') {
        filtered = allCars.filter(car => car.filterType === currentFilter);
    }
    return filtered.slice(0, visibleCount);
}

// Hent totalt antall filtrerte biler
function getFilteredCount() {
    if (currentFilter === 'all') return allCars.length;
    return allCars.filter(car => car.filterType === currentFilter).length;
}

// Oppdater "Vis flere" knapp
function updateLoadMoreButton() {
    loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;
    
    const filteredCount = getFilteredCount();
    const remaining = filteredCount - visibleCount;
    
    if (remaining > 0) {
        const showNext = Math.min(remaining, CONFIG.carsPerPage);
        loadMoreBtn.innerHTML = `
            Vis ${showNext} flere
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6"/>
            </svg>
        `;
        loadMoreBtn.style.display = 'inline-flex';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

// Initialiser "Vis flere" funksjonalitet
function initLoadMore() {
    loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreBtn) return;
    
    updateLoadMoreButton();
    
    loadMoreBtn.addEventListener('click', () => {
        visibleCount += CONFIG.carsPerPage;
        renderCars(getVisibleCars());
        updateLoadMoreButton();
    });
}

// Render filter-knapper
function renderFilters(stats) {
    filterContainer.innerHTML = `
        <button class="filter-btn active" data-filter="all">Alle (${stats.total})</button>
        <button class="filter-btn" data-filter="el">Elbiler (${stats.electric})</button>
        <button class="filter-btn" data-filter="hybrid">Hybrid (${stats.hybrid})</button>
        <button class="filter-btn" data-filter="bensin">Bensin (${stats.petrol})</button>
        <button class="filter-btn" data-filter="diesel">Diesel (${stats.diesel})</button>
    `;
}

// Oppdater statistikk-seksjonen
function updateStats(stats) {
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length >= 1) {
        statNumbers[0].textContent = stats.total;
    }
}

// Hjelpefunksjoner for badges
function getBadgeClass(filterType) {
    switch (filterType) {
        case 'el': return 'electric';
        case 'hybrid': return 'hybrid';
        default: return '';
    }
}

function getBadgeText(fuelType) {
    if (!fuelType) return 'Ukjent';
    if (fuelType.includes('Elektrisk')) return 'Elektrisk';
    if (fuelType.includes('Plug-in')) return 'Plug-in Hybrid';
    if (fuelType.includes('Hybrid')) return 'Hybrid';
    return fuelType;
}

// Filter-funksjonalitet
function initFilterFunctionality() {
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentFilter = btn.dataset.filter;
            visibleCount = CONFIG.carsPerPage; // Reset til første side
            renderCars(getVisibleCars());
            updateLoadMoreButton();
        });
    });
}

// Header scroll effekt
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 100);
        });
    }
}

// Mobile navigation
function initMobileNav() {
    const navToggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('nav');
    const navOverlay = document.getElementById('nav-overlay');
    const navLinks = document.querySelectorAll('nav a');
    
    if (!navToggle || !nav) return;
    
    const toggleNav = () => {
        navToggle.classList.toggle('active');
        nav.classList.toggle('active');
        navOverlay.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    };
    
    navToggle.addEventListener('click', toggleNav);
    navOverlay.addEventListener('click', toggleNav);
    
    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (nav.classList.contains('active')) {
                toggleNav();
            }
        });
    });
}

// Smooth scroll
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Animert statistikk
function initStatsAnimation() {
    const stats = document.querySelectorAll('.stat-number');
    
    const animateStats = () => {
        stats.forEach(stat => {
            const rect = stat.getBoundingClientRect();
            if (rect.top < window.innerHeight && !stat.classList.contains('animated')) {
                stat.classList.add('animated');
                const target = parseInt(stat.textContent);
                let current = 0;
                const increment = target / 30;
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        stat.textContent = target;
                        clearInterval(timer);
                    } else {
                        stat.textContent = Math.floor(current);
                    }
                }, 50);
            }
        });
    };
    
    window.addEventListener('scroll', animateStats);
    animateStats();
}

// Feilhåndtering
function showEmptyState() {
    carsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
            <h3 style="font-family: var(--font-display); font-size: 2rem; margin-bottom: 1rem;">
                Ingen biler tilgjengelig
            </h3>
            <p style="color: var(--color-muted); margin-bottom: 2rem;">
                Sjekk tilbake senere eller se alle biler på FINN.no
            </p>
            <a href="${CONFIG.finnOrgUrl}" target="_blank" class="btn btn-primary">
                Se biler på FINN.no
            </a>
        </div>
    `;
}

function showErrorState() {
    carsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
            <h3 style="font-family: var(--font-display); font-size: 2rem; margin-bottom: 1rem;">
                Kunne ikke laste biler
            </h3>
            <p style="color: var(--color-muted); margin-bottom: 2rem;">
                Prøv å oppdatere siden eller se alle biler på FINN.no
            </p>
            <a href="${CONFIG.finnOrgUrl}" target="_blank" class="btn btn-primary">
                Se biler på FINN.no
            </a>
        </div>
    `;
}
