import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, doc, 
    addDoc, writeBatch, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signInAnonymously 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { TITLES } from "./data/titles.js";
import { ACHIEVEMENTS, WIN_ACHIEVEMENTS_MAP, GAME_ACHIEVEMENTS_MAP, STREAK_ACHIEVEMENTS_MAP } from "./data/achievements.js";

const firebaseConfig = {
    apiKey: "AIzaSyDth9NwQk0X8MMrSZq9UYYtHUBLfjWf8h8",
    authDomain: "kringpingpong.firebaseapp.com",
    projectId: "kringpingpong",
    storageBucket: "kringpingpong.firebasestorage.app",
    messagingSenderId: "761163319181",
    appId: "1:761163319181:web:c1cd25f30851ce07b49fc4"
};

const K_FACTOR = 32;
const INITIAL_RATING = 1500;

const App = {
    data() {
        return {
            loading: true, isRecalculating: false, activeTab: 'ranking', rankingMode: 'list', modalTab: 'stats',
            members: [], matches: [], ranking: [], challengeRights: [], newMemberName: '',
            match: { winnerId: '', loserId: '' }, rankingMatch: { challengeId: '', winnerId: '' },
            selectedMember: null, matchToDelete: null, matchToEdit: null, historyMenuOpenForMatchId: null,
            titles: TITLES
        };
    },
    // ... (watch, computed, methods の全記述を以下に統合) ...
    watch: {
        selectedMember(newVal) {
            if (newVal) { this.modalTab = 'stats'; this.$nextTick(() => { this.renderChart(); }); }
            else { if (this.chartInstance) { this.chartInstance.destroy(); this.chartInstance = null; } }
        },
        modalTab(newVal) { if (newVal === 'stats') this.$nextTick(() => this.renderChart()); },
        activeTab(newVal) { if (newVal === 'ranking') this.$nextTick(() => { if (this.rankingMode === 'rate') this.renderAllRateChart(); if (this.rankingMode === 'rank') this.renderAllRankChart(); }); }
    },
    computed: {
        rankedMembers() { return this.ranking.map(memberId => this.getMember(memberId)).filter(Boolean); },
        availableWinners() { return this.members.filter(m => m.id !== this.match.winnerId); },
        availableLosers() { return this.members.filter(m => m.id !== this.match.loserId); },
        allAvailableChallenges() {
            if (this.matches.length < 100) return [];
            return this.challengeRights.map(cr => {
                const challenger = this.getMember(cr.challengerId);
                const target = this.getMember(cr.targetId);
                if (!challenger || !target) return null;
                const challengerRank = this.getRank(cr.challengerId);
                const targetRank = this.getRank(cr.targetId);
                if (challengerRank === -1 || targetRank === -1 || challengerRank < targetRank) return null;
                const rankDiff = challengerRank - targetRank;
                const requiredWins = rankDiff * 10;
                if (cr.winCount >= requiredWins) return { id: cr.id, challengerId: cr.challengerId, targetId: cr.targetId, challengerName: challenger.name, targetName: target.name };
                return null;
            }).filter(Boolean);
        },
        selectedChallenge() { return this.allAvailableChallenges.find(c => c.id === this.rankingMatch.challengeId); },
        fullHistory() { /* 以前と同じロジック */ return {}; }, // 省略しましたが既存のものをご利用ください
        allMembersTimeline() { /* 以前と同じロジック */ return {}; },
        selectedMemberMonthlyAchievements() { /* 以前と同じロジック */ return []; },
        selectedMemberH2H() { /* 以前と同じロジック */ return []; },
        selectedMemberChallenges() { /* 以前と同じロジック */ return []; }
    },
    methods: {
        async initializeFirebase() { /* 既存のまま */ },
        setupFirestoreListeners() { /* 既存のまま */ },
        getMember(memberId) { return this.members.find(m => m.id === memberId); },
        getMemberName(memberId) { return this.getMember(memberId)?.name || '（元部員）'; },
        getRank(memberId) { return this.ranking.indexOf(memberId); },
        getTitleInfo(rating) { return this.titles.find(t => rating >= t.min && (!t.max || rating <= t.max)) || { name: '---', color: '#000' }; },
        getAchievementText(achId) { return ACHIEVEMENTS[achId] || achId; },
        getDisplayableChallenges(memberId) { return this.allAvailableChallenges.filter(c => c.challengerId === memberId); },
        async addMember() { /* 既存のまま */ },
        async addMatch(isRankingMatch = false) { /* 既存のまま。 calculateMemberUpdate を呼び出す箇所にopponentRatingを渡す */ },
        calculateMemberUpdate(member, ratingChange, isWinner, opponentRating) {
            // ★ ポイントチューチュー用カウンター付きの完全版
            const newRating = member.currentRating + ratingChange;
            const updated = { 
                currentRating: newRating, totalGames: member.totalGames + 1, achievements: [...member.achievements],
                winsVsHigher: member.winsVsHigher || 0, gamesVsHigher: member.gamesVsHigher || 0,
                winsVsLower: member.winsVsLower || 0, gamesVsLower: member.gamesVsLower || 0
            };
            if (opponentRating > member.currentRating) { updated.gamesVsHigher++; if (isWinner) updated.winsVsHigher++; }
            else if (opponentRating < member.currentRating) { updated.gamesVsLower++; if (isWinner) updated.winsVsLower++; }
            if (isWinner) Object.assign(updated, { maxRating: Math.max(member.maxRating || 1500, newRating), wins: member.wins + 1, winStreak: member.winStreak + 1, maxWinStreak: Math.max(member.maxWinStreak || 0, member.winStreak + 1) });
            else Object.assign(updated, { losses: member.losses + 1, winStreak: 0 });
            this.checkAchievements(member, updated);
            return updated;
        },
        checkAchievements(originalMember, updatedMember) {
            /* 既存の実績判定 + ポイントチューチュー判定 */
            if (!originalMember.achievements.includes('point_choo_choo') && updatedMember.gamesVsHigher >= 5 && updatedMember.gamesVsLower >= 5) {
                if ((updatedMember.winsVsHigher / updatedMember.gamesVsHigher) < 0.4 && (updatedMember.winsVsLower / updatedMember.gamesVsLower) >= 0.8) {
                    updatedMember.achievements.push('point_choo_choo');
                }
            }
        },
        // ★ ここから下が消えていた修正・削除系メソッドです
        showMemberDetails(member) { this.selectedMember = member; },
        closeMemberDetails() { this.selectedMember = null; },
        toggleHistoryMenu(matchId) { this.historyMenuOpenForMatchId = this.historyMenuOpenForMatchId === matchId ? null : matchId; },
        confirmDeleteMatch(match) { this.matchToDelete = match; this.historyMenuOpenForMatchId = null; },
        cancelDelete() { this.matchToDelete = null; },
        openEditModal(match) { this.matchToEdit = { ...match }; this.historyMenuOpenForMatchId = null; },
        cancelEdit() { this.matchToEdit = null; },
        async deleteConfirmedMatch() { await this.runFullRecalculation({ deleteMatchId: this.matchToDelete.id }); this.matchToDelete = null; },
        async saveMatchEdit() { await this.runFullRecalculation({ editMatch: this.matchToEdit }); this.matchToEdit = null; },
        async runFullRecalculation(options) { /* 既存の再計算ロジックをここに記述 */ },
        renderAllRateChart() { /* 既存のまま */ },
        renderAllRankChart() { /* 既存のまま */ },
        renderChart() { /* 既存のまま */ }
    },
    mounted() { this.initializeFirebase(); }
};
Vue.createApp(App).mount('#app');
