
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Global variables for Firebase configuration
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        let db, auth;
        let userId = null;

        const password = "secret"; // Hardcoded password

        document.addEventListener('DOMContentLoaded', async () => {
            if (Object.keys(firebaseConfig).length === 0) {
                console.error('Firebase config is not available.');
                return;
            }

            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                } catch (error) {
                    await signInAnonymously(auth);
                }
            } else {
                await signInAnonymously(auth);
            }
            
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    document.getElementById('userIdDisplay').textContent = `User ID: ${userId}`;
                } else {
                    console.log("User is signed out.");
                }
            });
        });

        const bookCover = document.getElementById('book-cover');
        const loginPage = document.getElementById('login-page');
        const bookContainer = document.getElementById('book-container');
        const mainDiaryContent = document.getElementById('main-diary-content');
        
        bookCover.addEventListener('click', () => {
            loginPage.classList.remove('hidden');
            loginPage.classList.add('opacity-100');
        });

        const passwordForm = document.getElementById('password-form');
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const passwordInput = document.getElementById('password-input').value;
            const passwordError = document.getElementById('password-error');

            if (passwordInput === password) {
                loginPage.classList.add('hidden', 'opacity-0');
                bookContainer.classList.add('open');
                passwordError.classList.add('hidden');
                
                setTimeout(() => {
                    bookCover.classList.add('hidden');
                    mainDiaryContent.classList.remove('hidden');
                    
                    const entriesCollection = collection(db, 'artifacts', appId, 'users', userId, 'diary_entries');
                    const q = query(entriesCollection);
                    onSnapshot(q, (snapshot) => {
                        const entries = [];
                        snapshot.forEach(doc => {
                            entries.push({ id: doc.id, ...doc.data() });
                        });
                        entries.sort((a, b) => b.timestamp - a.timestamp);
                        renderViews(entries);
                    });

                }, 1000); // Wait for the flip animation to complete
            } else {
                passwordError.classList.remove('hidden');
            }
        });
        
        let currentView = 'latest';
        
        function renderViews(entries) {
            const loadingEl = document.getElementById('loading');
            const latestEntryContainer = document.getElementById('latest-entry-container');
            const writeEntryPage = document.getElementById('write-entry-page');
            const navBtnContainer = document.getElementById('nav-btn-container');

            loadingEl.classList.add('hidden');
            navBtnContainer.classList.remove('hidden');
            
            if (currentView === 'latest') {
                latestEntryContainer.classList.remove('hidden');
                writeEntryPage.classList.add('hidden');
                renderSingleEntry(entries.length > 0 ? entries[0] : null);
            } else {
                latestEntryContainer.classList.add('hidden');
                writeEntryPage.classList.remove('hidden');
            }
        }

        function renderSingleEntry(entry) {
            const container = document.getElementById('latest-entry-container');
            container.innerHTML = '';
            if (entry) {
                const date = entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';
                // Updated class on the img tag for better resizing
                const mediaHtml = entry.media ? `<img src="${entry.media}" class="rounded-lg shadow-md mb-4 max-w-full h-auto object-contain">` : '';
                // Get the text color or use a default if not set
                const entryColor = entry.color || '#DAA520'; 
                const html = `
                    <div class="diary-page p-8 h-full flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-4xl font-bold" style="color: ${entryColor}">${entry.title}</h3>
                                <span class="text-lg text-gray-500" style="color: ${entryColor}">${date}</span>
                            </div>
                            ${mediaHtml}
                            <p class="text-2xl leading-relaxed whitespace-pre-wrap" style="color: ${entryColor}">${entry.content}</p>
                        </div>
                    </div>
                `;
                container.innerHTML = html;
            } else {
                container.innerHTML = `<p class="text-center italic text-gray-500 mt-20">Your diary is empty. Click the pencil icon below to write your first entry!</p>`;
            }
        }
        
        const mediaUpload = document.getElementById('media-upload');
        const previewImage = document.getElementById('preview-image');
        const mediaPreviewContainer = document.getElementById('media-preview');
        let uploadedMediaData = null;

        mediaUpload.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    mediaPreviewContainer.classList.remove('hidden');
                    uploadedMediaData = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                mediaPreviewContainer.classList.add('hidden');
                uploadedMediaData = null;
            }
        });

        const newEntryForm = document.getElementById('new-entry-form');
        newEntryForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('entry-title').value.trim();
            const content = document.getElementById('entry-content').value.trim();
            const color = document.getElementById('entry-color').value;

            if (!title || !content) {
                console.error("Title and content cannot be empty.");
                return;
            }

            if (!userId) {
                console.error("User not authenticated.");
                return;
            }
            
            const entriesCollection = collection(db, 'artifacts', appId, 'users', userId, 'diary_entries');
            
            try {
                const newEntry = {
                    title: title,
                    content: content,
                    timestamp: serverTimestamp(),
                    color: color
                };

                // Add media to the entry if it was uploaded
                if (uploadedMediaData) {
                    // Note: Storing Base64 data directly in Firestore documents is not
                    // recommended for large images due to the 1MB document size limit.
                    // For a production app, Firebase Storage would be the proper solution.
                    newEntry.media = uploadedMediaData;
                }
                
                await addDoc(entriesCollection, newEntry);
                
                document.getElementById('entry-title').value = '';
                document.getElementById('entry-content').value = '';
                document.getElementById('entry-color').value = '#DAA520'; // Reset color
                mediaUpload.value = ''; // Clear file input
                mediaPreviewContainer.classList.add('hidden');
                uploadedMediaData = null;

                currentView = 'latest';
            } catch (error) {
                console.error("Error adding document:", error);
            }
        });
        
        document.getElementById('nav-write-btn').addEventListener('click', () => {
            currentView = 'write';
            renderViews([]);
        });
