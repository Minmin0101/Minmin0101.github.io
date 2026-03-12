(function(window, document) {
    function initGalleryViewer() {
        var albums = window.galleryAlbums;
        if (!albums || !albums.length) {
            return;
        }

        var lightbox = document.getElementById('gallery-lightbox');
        var image = document.getElementById('gallery-lightbox-image');
        var title = document.getElementById('gallery-lightbox-title');
        var description = document.getElementById('gallery-lightbox-description');
        var counter = document.getElementById('gallery-lightbox-counter');
        var prevButton = document.getElementById('gallery-lightbox-prev');
        var nextButton = document.getElementById('gallery-lightbox-next');
        var closeButtons = document.querySelectorAll('[data-gallery-close]');
        var triggers = document.querySelectorAll('[data-gallery-album]');

        if (!lightbox || !image || !title || !description || !counter || !prevButton || !nextButton || !triggers.length) {
            return;
        }

        var state = {
            albumIndex: 0,
            photoIndex: 0
        };

        function getCurrentAlbum() {
            return albums[state.albumIndex] || { title: '', photos: [] };
        }

        function getCurrentPhoto() {
            var album = getCurrentAlbum();
            return album.photos[state.photoIndex] || { src: '', title: '', description: '' };
        }

        function render() {
            var album = getCurrentAlbum();
            var photo = getCurrentPhoto();
            image.src = photo.src;
            image.alt = photo.title || album.title;
            title.textContent = photo.title || album.title;
            description.textContent = photo.description || album.subtitle || '';
            counter.textContent = (state.photoIndex + 1) + ' / ' + album.photos.length;

            var onlyOne = album.photos.length <= 1;
            prevButton.disabled = onlyOne;
            nextButton.disabled = onlyOne;
        }

        function open(albumIndex, photoIndex) {
            state.albumIndex = albumIndex;
            state.photoIndex = photoIndex;
            render();
            lightbox.classList.add('open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.classList.add('gallery-lightbox-open');
        }

        function close() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('gallery-lightbox-open');
        }

        function move(step) {
            var album = getCurrentAlbum();
            if (!album.photos.length) {
                return;
            }
            state.photoIndex = (state.photoIndex + step + album.photos.length) % album.photos.length;
            render();
        }

        Array.prototype.forEach.call(triggers, function(trigger) {
            trigger.addEventListener('click', function() {
                var albumIndex = parseInt(trigger.getAttribute('data-gallery-album'), 10) || 0;
                var photoIndex = parseInt(trigger.getAttribute('data-gallery-photo'), 10) || 0;
                open(albumIndex, photoIndex);
            });
        });

        Array.prototype.forEach.call(closeButtons, function(button) {
            button.addEventListener('click', close);
        });

        prevButton.addEventListener('click', function() {
            move(-1);
        });

        nextButton.addEventListener('click', function() {
            move(1);
        });

        document.addEventListener('keydown', function(event) {
            if (!lightbox.classList.contains('open')) {
                return;
            }
            if (event.key === 'Escape') {
                close();
            } else if (event.key === 'ArrowLeft') {
                move(-1);
            } else if (event.key === 'ArrowRight') {
                move(1);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGalleryViewer);
    } else {
        initGalleryViewer();
    }
}(window, document));
