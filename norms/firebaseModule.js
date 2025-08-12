import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, query, where, doc, deleteDoc,
  getDoc, updateDoc, increment, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBCZOF7uAxlygOk1ydwSP-j3BiYzyxulf4",
  authDomain: "black-market-b6eee.firebaseapp.com",
  projectId: "black-market-b6eee",
  storageBucket: "black-market-b6eee.appspot.com",
  messagingSenderId: "537330859830",
  appId: "1:537330859830:web:1db4f16f760940f17c3d97"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM
const getListedBtn = document.getElementById('getListedBtn');
const formPopup = document.getElementById('formPopup');
const contactList = document.getElementById('contactList');
const totalClicks = document.getElementById('totalClicks');

// UI Helpers
function togglePopup() {
  formPopup.style.display = formPopup.style.display === 'flex' ? 'none' : 'flex';
}
function showAlert(msg) {
  const div = document.createElement("div");
  div.className = "alert";
  div.innerText = msg;
  document.querySelector(".container").prepend(div);
  setTimeout(() => div.remove(), 3000);
}

// Upload image
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("upload_preset", "Blackmarket");
  fd.append("file", file);
  const res = await fetch("https://api.cloudinary.com/v1_1/dilffurcn/image/upload", {
    method: "POST",
    body: fd
  });
  const data = await res.json();
  return data.secure_url;
}

// 🔥 Get Listed (paid / free logic)
getListedBtn.addEventListener("click", async () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return alert("You must be logged in.");

    const userId = user.uid;
    const userRef = doc(db, "users", userId);
    let userSnap = await getDoc(userRef);

    // Create user if doesn't exist
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        balance: 0,
        clickCount: 0
      });
      userSnap = await getDoc(userRef);
    }

    const userData = userSnap.data();
    const userBalance = userData.balance ?? 0;

    // Get or create settings
    const settingsSnap = await getDocs(collection(db, "settings"));
    let settings = settingsSnap.docs[0]?.data();
    const settingsId = settingsSnap.docs[0]?.id;

    if (!settings) {
      const settingsRef = doc(collection(db, "settings"));
      await setDoc(settingsRef, { paid: false, price: 0 });
      settings = { paid: false, price: 0 };
    }

    const isPaid = settings?.paid ?? false;
    const price = settings?.price ?? 0;

    if (isPaid && userBalance < price) {
      return alert("❌ Not enough balance to list.");
    }

    // Deduct price if paid
    if (isPaid) {
      await updateDoc(userRef, {
        balance: userBalance - price
      });
    }

    togglePopup();
  });
});

// Submit new contact
document.getElementById("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.textContent = "Submitting...";

  const name = document.getElementById("name").value;
  const number = document.getElementById("number").value;
  const bio = document.getElementById("bio").value;
  const file = document.getElementById("photo").files[0];
  const imageUrl = await uploadToCloudinary(file);

  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  await addDoc(collection(db, "contacts"), {
    name, number, bio, imageUrl,
    clickCount: 0,
    createdAt: Date.now(),
    userId: user.uid
  });

  submitBtn.textContent = "Submit";
  togglePopup();
  showAlert("✅ Successfully listed!");
  loadContacts();
});

// Load contacts (only those from last 2 days)
async function loadContacts() {
  contactList.innerHTML = "";
  const user = auth.currentUser;
  if (!user) return;

  const now = Date.now();
  const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
  const q = query(collection(db, "contacts"), where("createdAt", ">", twoDaysAgo));
  const querySnapshot = await getDocs(q);

  let userClickTotal = 0;

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();

    if (data.createdAt < twoDaysAgo) {
      await deleteDoc(doc(db, "contacts", docSnap.id));
      continue;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
  <img src="${data.imageUrl}" onclick="previewImage('${data.imageUrl}')" />
  <div class="info">
    <div class="info-name">${data.name}</div>
    <div class="info-bio">${data.bio}</div>
    <div class="info-clicks">Clicks: ${data.clickCount || 0}</div>
  </div>
  <button class="button" onclick="clickContact('${docSnap.id}')">Connect</button>
`;

    contactList.appendChild(card);
    userClickTotal += data.clickCount || 0;
  }

  totalClicks.innerText = `Total Clicks: ${userClickTotal}`;
}

// Contact click
window.clickContact = async function (id) {
  const ref = doc(db, "contacts", id);
  const snap = await getDoc(ref);
  const data = snap.data();

  await updateDoc(ref, {
    clickCount: increment(1)
  });

  loadContacts();

  const number = data.number.replace(/\D/g, '');
  const msg = encodeURIComponent(`Hey ${data.name}, I found your listing on Black Market.`);
  window.open(`https://wa.me/${number}?text=${msg}`, '_blank');
};

// Image Preview
window.previewImage = function (imageUrl) {
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('previewImage');
  img.src = imageUrl;
  modal.style.display = 'flex';
};
window.closePreview = function () {
  document.getElementById('imagePreviewModal').style.display = 'none';
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadContacts();
  }
});
