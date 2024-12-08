function loadNavbar() {
    fetch('navbar.html')
        .then((response) => response.text())
        .then((data) => {
            document.getElementById('navbar').innerHTML = data;
            addEventListeners();
            handleRouteChange();
        })
        .catch((error) => console.error('Error loading navbar:', error));
    fetch('home.html')
        .then((response) => response.text())
        .then((data) => {
            document.getElementById('content').innerHTML = data;
        })
        .catch((error) => console.error('Error loading content:', error));
}

function addEventListeners() {
    window.addEventListener('hashchange', handleRouteChange);
}

function updateActiveNavItem(hash) {
    // Remove 'active' class from all nav items
    document.querySelectorAll('.navbar-nav .nav-item').forEach((item) => {
        item.classList.remove('active');
    });

    // Add 'active' class to the current nav item
    const activeItem = document.querySelector(`.navbar-nav .nav-link[href="#${hash}"]`);
    if (activeItem) {
        activeItem.parentElement.classList.add('active');
    }
}

function handleRouteChange() {
    const hash = window.location.hash.substring(1); // Remove the '#' character
    updateActiveNavItem(hash); // Update the active nav item

    switch (hash) {
        case 'home':
            loadContent('home.html');
            break;
        case 'privacypolicy':
            loadMarkdownContent(
                'https://raw.githubusercontent.com/SnekCode/WheelOfNamesHelper/refs/heads/master/PRIVACY_POLICY.md',
                'privacy-policy'
            );
            break;
        case 'readme':
            loadMarkdownContent(
                'https://raw.githubusercontent.com/SnekCode/WheelOfNamesHelper/refs/heads/master/README.md',
                'privacy-policy'
            );
            break;
        case 'releasenotes':
            loadMarkdownContent(
                'https://raw.githubusercontent.com/SnekCode/WheelOfNamesHelper/refs/heads/master/public/release-notes.md',
                'privacy-policy'
            );
            break;
        default:
            loadContent('home.html'); // Default to home if no hash or unknown hash
            updateActiveNavItem("home"); // Update the active nav item to home
            break;
    }
}

function loadMarkdownContent(url, classname) {
    fetch(url)
        .then((response) => response.text())
        .then((data) => {
            const htmlContent = marked.parse(data);
            document.getElementById('content').innerHTML = `<div class="${classname}">${htmlContent}</div>`;
        })
        .catch((error) => console.error('Error loading markdown content:', error));
}

function loadContent(url) {
    fetch(url)
        .then((response) => response.text())
        .then((data) => {
            document.getElementById('content').innerHTML = data;
        })
        .catch((error) => console.error('Error loading content:', error));
}

document.addEventListener('DOMContentLoaded', loadNavbar);
