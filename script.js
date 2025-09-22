import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAsYrbvHGGRMJQfKxjj5-AVmms7yNbJIzM",
  authDomain: "my-secret-diary-63516.firebaseapp.com",
  projectId: "my-secret-diary-63516",
  storageBucket: "my-secret-diary-63516.firebasestorage.app",
  messagingSenderId: "285096096299",
  appId: "1:285096096299:web:e14041612689f2a035b06e"
};

let db, auth;
let userId = null;

const password = "secret"; // Hardcoded password

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase with your personal configuration
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // Sign in anonymously to get a user ID
    await signInAnonymously(auth);

    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            document.getElementById('userIdDisplay').textContent = `User ID: ${userId}`;

            // The collection path now uses the 'users' and 'entries' collections
            const entriesCollection = collection(db, 'users', userId, 'entries');
            const q = query(entriesCollection);
            onSnapshot(q, (snapshot) => {
                const entries = [];
                snapshot.forEach(doc => {
                    entries.push({ id: doc.id, ...doc.data() });
                });
                entries.sort((a, b) => b.timestamp - a.timestamp);
                renderViews(entries);
            });
            
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
        passwordError.classList.add('hidden');
        // The fix is here: Call the success handler directly on password match
        handleLoginSuccess();
    } else {
        passwordError.classList.remove('hidden');
    }
});

function handleLoginSuccess() {
    bookContainer.classList.add('open');
    const loadingEl = document.getElementById('loading');
    const navBtnContainer = document.getElementById('nav-btn-container');

    // Show the main content and buttons immediately
    loadingEl.classList.add('hidden');
    navBtnContainer.classList.remove('hidden');

    setTimeout(() => {
        bookCover.classList.add('hidden');
        mainDiaryContent.classList.remove('hidden');
        // We also render the view with an empty array to show the "no entries" message
        renderViews([]);
    }, 1000); // Wait for the flip animation to complete
}

let currentView = 'latest';

function renderViews(entries) {
    const loadingEl = document.getElementById('loading');
    const latestEntryContainer = document.getElementById('latest-entry-container');
    const writeEntryPage = document.getElementById('write-entry-page');

    loadingEl.classList.add('hidden');
    
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
        // Use the timestamp to get the correct date
        const date = entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleDateString() : 'N/A';
        const mediaHtml = entry.media ? `<img src="${entry.media}" class="rounded-lg shadow-md mb-4 max-w-full h-auto object-contain">` : '';
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
    
    // The collection path now uses the 'users' and 'entries' collections
    const entriesCollection = collection(db, 'users', userId, 'entries');
    
    try {
        const newEntry = {
            title: title,
            content: content,
            timestamp: serverTimestamp(),
            color: color
        };

        if (uploadedMediaData) {
            newEntry.media = uploadedMediaData;
        }
        
        await addDoc(entriesCollection, newEntry);
        
        document.getElementById('entry-title').value = '';
        document.getElementById('entry-content').value = '';
        document.getElementById('entry-color').value = '#DAA520'; 
        mediaUpload.value = ''; 
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
