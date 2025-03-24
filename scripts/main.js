/**
 * Main JavaScript for Yoonki Hong's profile website
 * Includes functionality for smooth scrolling, dark mode toggle,
 * and mobile navigation
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
    const sections = document.querySelectorAll('section, header.hero');
    
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
        
        .fadeInUp {
            animation: fadeInUp 0.8s ease forwards;
        }
    `;
    document.head.appendChild(style);
}); 