// js/main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, writeBatch, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ★分離した称号データを読み込む
import { TITLES } from "./data/titles.js";

const firebaseConfig = {
    // ... 現在のFirebase設定をそのまま記載 ...
};

const K_FACTOR = 32;
const INITIAL_RATING = 1500;

// ... Firebase初期化などのコード ...

const App = {
    data() {
        return {
            // ★読み込んだTITLESを使用
            titles: TITLES,
            // ... その他のデータ ...
        };
    },
    // ... computed, methods, mounted などの全ロジック ...
};

Vue.createApp(App).mount('#app');