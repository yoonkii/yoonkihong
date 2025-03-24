/**
 * Main JavaScript for Yoonki Hong's profile website
 * Includes functionality for smooth scrolling, dark mode toggle,
 * portfolio carousel, and mobile navigation
 */

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const nav = document.querySelector('nav');
    const burger = document.querySelector('.burger');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links li');
    const navAnchors = document.querySelectorAll('.nav-links a');
    const checkbox = document.getElementById('checkbox');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    const sections = document.querySelectorAll('section, header.hero');
    
    // Carousel Elements
    const carousel = document.querySelector('.portfolio-carousel');
    const carouselPrev = document.querySelector('.carousel-prev');
    const carouselNext = document.querySelector('.carousel-next');
    const carouselIndicators = document.querySelector('.carousel-indicators');
    const carouselWrapper = document.querySelector('.carousel-wrapper');
    
    // Carousel variables
    let currentIndex = 0;
    let autoScrollInterval;
    let animationId;
    let itemsPerView = calculateItemsPerView();
    let visibleItems = document.querySelectorAll('.portfolio-item');
    let isDragging = false;
    let startPosition = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let scrollSpeed = 0.5; // Pixels per frame for continuous scrolling
    
    // Function to highlight active section in navigation
    function highlightActiveSection() {
        // Get current scroll position
        let scrollPosition = window.scrollY + nav.offsetHeight + 50;
        
        // Check which section is currently in view
        sections.forEach((section) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                // Remove active class from all navigation links
                navAnchors.forEach((item) => {
                    item.classList.remove('active');
                });
                
                // Add active class to the corresponding navigation link
                const activeLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }
    
    // Add scroll event listener to highlight active section
    window.addEventListener('scroll', highlightActiveSection);
    
    // Call once on page load to set initial active section
    highlightActiveSection();
    
    // Initialize carousel
    function initCarousel() {
        visibleItems = Array.from(document.querySelectorAll('.portfolio-item'));
        
        if (visibleItems.length === 0) return;
        
        // Create infinite scroll effect by cloning items
        createInfiniteScroll();
        
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
        
        // Start continuous auto-scroll
        startContinuousScroll();
    }
    
    // Create infinite scroll effect
    function createInfiniteScroll() {
        // Remove any previously cloned items
        carousel.querySelectorAll('.cloned').forEach(item => item.remove());
        
        // Clone items for infinite scroll
        if (visibleItems.length > 0) {
            // Clone first set of items and add to end (twice to ensure enough items)
            const firstSet = [...visibleItems];
            for (let i = 0; i < 2; i++) {
                firstSet.forEach(item => {
                    const clone = item.cloneNode(true);
                    clone.classList.add('cloned');
                    carousel.appendChild(clone);
                });
            }
            
            // Clone last set of items and add to beginning (twice to ensure enough items)
            const lastSet = [...visibleItems].reverse();
            for (let i = 0; i < 2; i++) {
                lastSet.forEach(item => {
                    const clone = item.cloneNode(true);
                    clone.classList.add('cloned');
                    carousel.insertBefore(clone, carousel.firstChild);
                });
            }
            
            // Set initial position to first real item
            currentTranslate = -visibleItems[0].offsetWidth * visibleItems.length * 2;
            carousel.style.transform = `translateX(${currentTranslate}px)`;
            prevTranslate = currentTranslate;
        }
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
        stopContinuousScroll();
        initCarousel();
    });
    
    // Continuous scroll animation
    function continuousScroll() {
        // Move carousel left continuously
        currentTranslate -= scrollSpeed;
        carousel.style.transform = `translateX(${currentTranslate}px)`;
        
        // Calculate item width including gap
        const itemWidth = visibleItems[0].offsetWidth + parseInt(getComputedStyle(carousel).columnGap);
        const totalWidth = itemWidth * visibleItems.length;
        
        // Check if we've scrolled past a complete set of items
        if (Math.abs(currentTranslate - prevTranslate) >= totalWidth) {
            // Reset to beginning of the real items
            currentTranslate = prevTranslate;
            carousel.style.transform = `translateX(${currentTranslate}px)`;
        }
        
        // Update which items are active based on scroll position
        updateActiveItemsOnScroll();
        
        // Continue animation
        animationId = requestAnimationFrame(continuousScroll);
    }
    
    // Start continuous scrolling
    function startContinuousScroll() {
        stopContinuousScroll();
        animationId = requestAnimationFrame(continuousScroll);
    }
    
    // Stop continuous scrolling
    function stopContinuousScroll() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }
    
    // Update active items based on scroll position
    function updateActiveItemsOnScroll() {
        if (visibleItems.length === 0) return;
        
        const itemWidth = visibleItems[0].offsetWidth + parseInt(getComputedStyle(carousel).columnGap);
        const offset = Math.abs(currentTranslate - prevTranslate);
        const index = Math.floor(offset / itemWidth) % visibleItems.length;
        
        // Update indicator
        document.querySelectorAll('.carousel-indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === index);
        });
        
        // Update which items have active class
        const allItems = carousel.querySelectorAll('.portfolio-item');
        const startIndex = visibleItems.length; // Start after the cloned items at beginning
        
        allItems.forEach((item, i) => {
            const position = i - startIndex;
            const adjustedPosition = ((position % visibleItems.length) + visibleItems.length) % visibleItems.length;
            const isActive = adjustedPosition === index || 
                            adjustedPosition === (index + 1) % visibleItems.length || 
                            adjustedPosition === (index + 2) % visibleItems.length;
            
            item.classList.toggle('active', isActive && itemsPerView > 1);
            
            // If only showing one item at a time, only the current one is active
            if (itemsPerView === 1) {
                item.classList.toggle('active', adjustedPosition === index);
            }
        });
    }
    
    // Go to specific slide for indicator clicks
    function goToSlide(index) {
        if (visibleItems.length === 0) return;
        
        stopContinuousScroll();
        
        currentIndex = index;
        const maxIndex = Math.ceil(visibleItems.length / itemsPerView) - 1;
        
        if (currentIndex < 0) {
            currentIndex = maxIndex;
        } else if (currentIndex > maxIndex) {
            currentIndex = 0;
        }
        
        // Calculate position
        const itemWidth = visibleItems[0].offsetWidth + parseInt(getComputedStyle(carousel).columnGap);
        const newPosition = prevTranslate - (currentIndex * itemsPerView * itemWidth);
        
        // Animate to position
        carousel.style.transition = 'transform 0.5s ease';
        carousel.style.transform = `translateX(${newPosition}px)`;
        
        // Update indicators
        document.querySelectorAll('.carousel-indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === currentIndex);
        });
        
        // Update active items
        updateActiveItems();
        
        // After animation completes, resume continuous scroll
        setTimeout(() => {
            carousel.style.transition = 'none';
            currentTranslate = newPosition;
            prevTranslate = newPosition;
            carousel.style.transform = `translateX(${currentTranslate}px)`;
            
            // Resume continuous scroll
            setTimeout(() => {
                carousel.style.transition = 'transform 0.5s ease';
                startContinuousScroll();
            }, 50);
        }, 500);
    }
    
    // Update which items have the active class
    function updateActiveItems() {
        visibleItems.forEach((item, index) => {
            const isActive = index >= currentIndex * itemsPerView && index < (currentIndex + 1) * itemsPerView;
            item.classList.toggle('active', isActive);
        });
    }
    
    // Previous slide button
    carouselPrev.addEventListener('click', () => {
        goToSlide(currentIndex - 1);
    });
    
    // Next slide button
    carouselNext.addEventListener('click', () => {
        goToSlide(currentIndex + 1);
    });
    
    // Setup mouse drag events
    carouselWrapper.addEventListener('mousedown', dragStart);
    carouselWrapper.addEventListener('mouseup', dragEnd);
    carouselWrapper.addEventListener('mouseleave', dragEnd);
    carouselWrapper.addEventListener('mousemove', drag);
    
    // Setup touch events
    carouselWrapper.addEventListener('touchstart', dragStart, { passive: true });
    carouselWrapper.addEventListener('touchend', dragEnd, { passive: true });
    carouselWrapper.addEventListener('touchmove', drag, { passive: true });
    
    // Handle drag start
    function dragStart(e) {
        stopContinuousScroll();
        
        // Save the starting position
        startPosition = getPositionX(e);
        isDragging = true;
        
        // Remove transition during drag for smooth movement
        carousel.style.transition = 'none';
    }
    
    // Handle drag movement
    function drag(e) {
        if (!isDragging) return;
        
        const currentPosition = getPositionX(e);
        const diff = currentPosition - startPosition;
        carousel.style.transform = `translateX(${currentTranslate + diff}px)`;
    }
    
    // Handle drag end
    function dragEnd(e) {
        if (!isDragging) return;
        
        isDragging = false;
        
        // Apply transition for smooth settling
        carousel.style.transition = 'transform 0.5s ease';
        
        // Calculate how far the user dragged
        const currentPosition = getPositionX(e);
        const diff = currentPosition - startPosition;
        
        // If the drag was significant, move to next/prev slide
        const itemWidth = visibleItems[0].offsetWidth;
        if (Math.abs(diff) > itemWidth / 4) {
            if (diff > 0) {
                // Dragged right, go to previous slide
                currentTranslate += itemWidth;
            } else {
                // Dragged left, go to next slide
                currentTranslate -= itemWidth;
            }
        }
        
        // Update the transform
        carousel.style.transform = `translateX(${currentTranslate}px)`;
        
        // After transition completes, check for loop reset
        setTimeout(() => {
            // Reset transition
            carousel.style.transition = 'none';
            
            // Check if we need to loop around
            const totalWidth = itemWidth * visibleItems.length;
            
            // If scrolled too far left or right, jump to the opposite end
            const distanceScrolled = Math.abs(currentTranslate - prevTranslate);
            if (distanceScrolled > totalWidth) {
                currentTranslate = prevTranslate;
                carousel.style.transform = `translateX(${currentTranslate}px)`;
            }
            
            // Resume transition
            setTimeout(() => {
                carousel.style.transition = 'transform 0.5s ease';
                // Resume auto-scrolling
                startContinuousScroll();
            }, 50);
        }, 500);
    }
    
    // Get position X from mouse or touch event
    function getPositionX(e) {
        return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    }
    
    // Pause auto-scroll when hovering over carousel
    carouselWrapper.addEventListener('mouseenter', stopContinuousScroll);
    carouselWrapper.addEventListener('mouseleave', startContinuousScroll);

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
                
                // Update active class
                navAnchors.forEach(item => item.classList.remove('active'));
                this.classList.add('active');
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
        initCarousel(); // Initialize carousel with new features
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
        
        .portfolio-item {
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .fadeInUp {
            animation: fadeInUp 0.8s ease forwards;
        }
    `;
    document.head.appendChild(style);
}); 