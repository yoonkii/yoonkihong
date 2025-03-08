/**
 * Main JavaScript for Yoonki Hong's profile website
 * Includes functionality for smooth scrolling, dark mode toggle,
 * favorites filtering, and mobile navigation
 */

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const nav = document.querySelector('nav');
    const burger = document.querySelector('.burger');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links li');
    const checkbox = document.getElementById('checkbox');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const favoritesItems = document.querySelectorAll('.favorites-item');
    
    // Carousel Elements
    const carousel = document.querySelector('.favorites-carousel');
    const carouselPrev = document.querySelector('.carousel-prev');
    const carouselNext = document.querySelector('.carousel-next');
    const carouselIndicators = document.querySelector('.carousel-indicators');
    
    // Carousel variables
    let currentIndex = 0;
    let autoScrollInterval;
    let itemsPerView = calculateItemsPerView();
    let visibleItems = document.querySelectorAll('.favorites-item[style*="display: block"], .favorites-item:not([style*="display"])');
    
    // Initialize carousel
    function initCarousel() {
        visibleItems = Array.from(document.querySelectorAll('.favorites-item[style*="display: block"], .favorites-item:not([style*="display"])'));
        
        // Create indicators
        carouselIndicators.innerHTML = '';
        const totalIndicators = Math.ceil(visibleItems.length / itemsPerView);
        
        for (let i = 0; i < totalIndicators; i++) {
            const indicator = document.createElement('div');
            indicator.classList.add('carousel-indicator');
            if (i === 0) indicator.classList.add('active');
            
            indicator.addEventListener('click', () => {
                goToSlide(i);
            });
            
            carouselIndicators.appendChild(indicator);
        }
        
        // Set first item as active
        updateActiveItems();
        
        // Start auto-scroll
        startAutoScroll();
    }
    
    // Calculate items per view based on viewport width
    function calculateItemsPerView() {
        if (window.innerWidth < 768) {
            return 1;
        } else if (window.innerWidth < 1200) {
            return 2;
        } else {
            return 3;
        }
    }
    
    // Update carousel on window resize
    window.addEventListener('resize', () => {
        itemsPerView = calculateItemsPerView();
        initCarousel();
    });
    
    // Go to specific slide
    function goToSlide(index) {
        if (visibleItems.length === 0) return;
        
        currentIndex = index;
        const maxIndex = Math.ceil(visibleItems.length / itemsPerView) - 1;
        
        if (currentIndex < 0) {
            currentIndex = maxIndex;
        } else if (currentIndex > maxIndex) {
            currentIndex = 0;
        }
        
        // Move carousel
        const slideWidth = visibleItems[0].offsetWidth + parseInt(getComputedStyle(carousel).columnGap);
        carousel.style.transform = `translateX(-${currentIndex * itemsPerView * slideWidth}px)`;
        
        // Update indicators
        document.querySelectorAll('.carousel-indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === currentIndex);
        });
        
        // Update active item styling
        updateActiveItems();
        
        // Reset auto-scroll timer
        resetAutoScroll();
    }
    
    // Update which items have the active class
    function updateActiveItems() {
        visibleItems.forEach((item, index) => {
            const isActive = index >= currentIndex * itemsPerView && index < (currentIndex + 1) * itemsPerView;
            item.classList.toggle('active', isActive);
        });
    }
    
    // Previous slide
    carouselPrev.addEventListener('click', () => {
        goToSlide(currentIndex - 1);
    });
    
    // Next slide
    carouselNext.addEventListener('click', () => {
        goToSlide(currentIndex + 1);
    });
    
    // Start auto-scrolling
    function startAutoScroll() {
        stopAutoScroll();
        autoScrollInterval = setInterval(() => {
            goToSlide(currentIndex + 1);
        }, 5000); // Change slide every 5 seconds
    }
    
    // Stop auto-scrolling
    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
        }
    }
    
    // Reset auto-scroll timer (after manual interaction)
    function resetAutoScroll() {
        stopAutoScroll();
        startAutoScroll();
    }
    
    // Pause auto-scroll when hovering over carousel
    carousel.addEventListener('mouseenter', stopAutoScroll);
    carousel.addEventListener('mouseleave', startAutoScroll);
    
    // Touch events for swiping on mobile
    let touchStartX = 0;
    let touchEndX = 0;
    
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        if (touchEndX < touchStartX) {
            // Swipe left, go to next slide
            goToSlide(currentIndex + 1);
        } else if (touchEndX > touchStartX) {
            // Swipe right, go to previous slide
            goToSlide(currentIndex - 1);
        }
    }

    // Dark mode toggle
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        checkbox.checked = true;
    }

    checkbox.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'enabled');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'disabled');
        }
    });

    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (navLinks.classList.contains('nav-active')) {
                    toggleNav();
                }
            }
        });
    });

    // Mobile navigation toggle
    function toggleNav() {
        navLinks.classList.toggle('nav-active');
        
        // Burger animation
        burger.classList.toggle('toggle');
        
        // Animate nav items
        navItems.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = '';
            } else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });
    }
    
    burger.addEventListener('click', toggleNav);

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Favorites filtering
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            filterBtns.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            const filterValue = this.getAttribute('data-filter');
            
            favoritesItems.forEach(item => {
                if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
            
            // Reinitialize carousel after filtering
            setTimeout(() => {
                initCarousel();
            }, 350);
        });
    });

    // Animate elements on scroll
    window.addEventListener('scroll', () => {
        animateOnScroll('.timeline-item', 'fadeInUp');
    });

    // Helper function for scroll animations
    function animateOnScroll(selector, animationClass) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight * 0.8;
            
            if (elementPosition < screenPosition) {
                element.classList.add(animationClass);
            }
        });
    }

    // Trigger initial animations
    setTimeout(() => {
        animateOnScroll('.timeline-item', 'fadeInUp');
        initCarousel(); // Initialize carousel
    }, 300);

    // Add CSS animation classes dynamically
    const style = document.createElement('style');
    style.textContent = `
        @keyframes navLinkFade {
            from {
                opacity: 0;
                transform: translateX(50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .burger.toggle .line1 {
            transform: rotate(-45deg) translate(-5px, 6px);
        }
        
        .burger.toggle .line2 {
            opacity: 0;
        }
        
        .burger.toggle .line3 {
            transform: rotate(45deg) translate(-5px, -6px);
        }
        
        .favorites-item {
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .fadeInUp {
            animation: fadeInUp 0.8s ease forwards;
        }
    `;
    document.head.appendChild(style);
}); 