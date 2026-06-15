import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, doc, 
    addDoc, writeBatch, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc, updateDoc, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    getAuth, onAuthStateChanged, signInAnonymously 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ★ 分離した称号データを読み込む
// ※もしGitHub上のファイル名が「title.js（sなし）」のままの場合は、以下の titles.js を title.js に書き換えてください。
import { TITLES } from "./data/titles.js";

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

// ※ ここにあった const TITLES = [ ... ]; のリストは、別ファイルから読み込むため削除済みです！

const ACHIEVEMENTS = {
    'wins_50': '通算50勝', 'wins_100': '通算100勝', 'wins_200': '通算200勝', 'wins_300': '通算300勝', 'wins_400': '通算400勝', 'wins_500': '通算500勝', 'wins_600': '通算600勝', 'wins_700': '通算700勝', 'wins_777': '通算777勝', 'wins_800': '通算800勝', 'wins_900': '通算900勝', 'wins_1000': '通算1000勝', 'wins_1500': '通算1500勝', 'wins_2000': '通算2000勝', 'wins_2500': '通算2500勝', 'wins_3000': '通算3000勝', 'wins_4000': '通算4000勝', 'wins_5000': '通算5000勝', 'wins_7777': '通算7777勝', 'wins_10000': '通算10000勝',
    'games_50': '通算50試合', 'games_100': '通算100試合', 'games_200': '通算200試合', 'games_300': '通算300試合', 'games_400': '通算400試合', 'games_500': '通算500試合', 'games_600': '通算600試合', 'games_700': '通算700試合', 'games_777': '通算777試合', 'games_800': '通算800試合', 'games_900': '通算900試合', 'games_1000': '通算1000試合', 'games_1500': '通算1500試合', 'games_2000': '通算2000試合', 'games_2500': '通算2500試合', 'games_3000': '通算3000試合', 'games_4000': '通算4000試合', 'games_5000': '通算5000試合', 'games_7777': '通算7777試合', 'games_10000': '通算10000試合',
    'streak_5': '5連勝', 'streak_6': '6連勝', 'streak_7': '7連勝', 'streak_8': '8連勝', 'streak_9': '9連勝', 'streak_10': '10連勝', 'streak_15': '15連勝', 'streak_20': '20連勝', 'streak_30': '30連勝', 'streak_40': '40連勝', 'streak_50': '50連勝',
};
const WIN_ACHIEVEMENTS_MAP = { 50: 'wins_50', 100: 'wins_100', 200: 'wins_200', 300: 'wins_300', 400: 'wins_400', 500: 'wins_500', 600: 'wins_600', 700: 'wins_700', 777: 'wins_777', 800: 'wins_800', 900: 'wins_900', 1000: 'wins_1000', 1500: 'wins_1500', 2000: 'wins_2000', 2500: 'wins_2500', 3000: 'wins_3000', 4000: 'wins_4000', 5000: 'wins_5000', 7777: 'wins_7777', 10000: 'wins_10000' };
const GAME_ACHIEVEMENTS_MAP = { 50: 'games_50', 100: 'games_100', 200: 'games_200', 300: 'games_300', 400: 'games_400', 500: 'games_500', 600: 'games_600', 700: 'games_700', 777: 'games_777', 800: 'games_800', 900: 'games_900', 1000: 'games_1000', 1500: 'games_1500', 2000: 'games_2000', 2500: 'games_2500', 3000: 'games_3000', 4000: 'games_4000', 5000: 'games_5000', 7777: 'games_7777', 10000: 'games_10000' };
const STREAK_ACHIEVEMENTS_MAP = { 5: 'streak_5', 6: 'streak_6', 7: 'streak_7', 8: 'streak_8', 9: 'streak_9', 10: 'streak_10', 15: 'streak_15', 20: 'streak_20', 30: 'streak_30', 40: 'streak_40', 50: 'streak_50' };

const App = {
    data() {
        return {
            loading: true,
            isRecalculating: false,
            activeTab: 'ranking',
            rankingMode: 'list', // list, rate, rank
            modalTab: 'stats',
            members: [],
            matches: [],
            ranking: [],
            challengeRights: [],
            newMemberName: '',
            match: { winnerId: '', loserId: '' },
            rankingMatch: { challengeId: '', winnerId: '' },
            selectedMember: null,
            matchToDelete: null,
            matchToEdit: null,
            historyMenuOpenForMatchId: null,
            titles: TITLES
        };
    },
    watch: {
        selectedMember(newVal) {
            if (newVal) {
                this.modalTab = 'stats';
                this.$nextTick(() => { this.renderChart(); });
            } else {
                if (this.chartInstance) {
                    this.chartInstance.destroy();
                    this.chartInstance = null;
                }
            }
        },
        modalTab(newVal) {
            if (newVal === 'stats') {
                this.$nextTick(() => { this.renderChart(); });
            }
        },
        activeTab(newVal) {
            if (newVal === 'ranking') {
                this.$nextTick(() => {
                    if (this.rankingMode === 'rate') this.renderAllRateChart();
                    if (this.rankingMode === 'rank') this.renderAllRankChart();
                });
            }
        }
    },
    computed: {
        rankedMembers() {
            return this.ranking.map(memberId => this.getMember(memberId)).filter(Boolean);
        },
        availableWinners() {
            return this.members.filter(m => m.id !== this.match.winnerId);
        },
        availableLosers() {
            return this.members.filter(m => m.id !== this.match.loserId);
        },
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

                if (cr.winCount >= requiredWins) {
                    return { id: cr.id, challengerId: cr.challengerId, targetId: cr.targetId, challengerName: challenger.name, targetName: target.name };
                }
                return null;
            }).filter(Boolean);
        },
        selectedChallenge() {
            if (!this.rankingMatch.challengeId) return null;
            return this.allAvailableChallenges.find(c => c.id === this.rankingMatch.challengeId);
        },
        lastMonthTitles() {
            let d = new Date();
            d.setMonth(d.getMonth() - 1);
            let lastMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            let monthLabel = `${d.getMonth() + 1}月`;
            
            let stats = {};
            this.matches.forEach(m => {
                let md = m.date && m.date.seconds ? new Date(m.date.seconds * 1000) : null;
                if (!md) return;
                let mKey = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`;
                if (mKey === lastMonthKey) {
                    if (!stats[m.winnerId]) stats[m.winnerId] = { wins: 0, games: 0 };
                    if (!stats[m.loserId]) stats[m.loserId] = { wins: 0, games: 0 };
                    stats[m.winnerId].wins++;
                    stats[m.winnerId].games++;
                    stats[m.loserId].games++;
                }
            });

            let maxWins = 0;
            let mostWinsIds = [];
            let maxRate = 0;
            let bestRateIds = [];

            Object.keys(stats).forEach(id => {
                if (stats[id].wins > maxWins) {
                    maxWins = stats[id].wins;
                    mostWinsIds = [id];
                } else if (stats[id].wins === maxWins && maxWins > 0) {
                    mostWinsIds.push(id);
                }

                if (stats[id].games > 0) {
                    let rate = Math.floor((stats[id].wins / stats[id].games) * 100);
                    if (rate > maxRate) {
                        maxRate = rate;
                        bestRateIds = [id];
                    } else if (rate === maxRate && maxRate > 0) {
                        bestRateIds.push(id);
                    }
                }
            });

            return {
                mostWins: mostWinsIds,
                bestRate: bestRateIds,
                monthLabel: monthLabel
            };
        },
        fullHistory() {
            if (!this.matches.length || !this.members.length) return {};
            
            let history = {};
            let tempMembers = {};
            this.members.forEach(m => {
                tempMembers[m.id] = { rating: 1500, id: m.id };
                history[m.id] = [{ dateStr: '開始時', rating: 1500, rank: null }];
            });
            
            let tempRanking = this.members.map(m => m.id);
            
            let sortedMatches = [...this.matches].sort((a, b) => {
                 let timeA = a.date && a.date.seconds ? a.date.seconds : 0;
                 let timeB = b.date && b.date.seconds ? b.date.seconds : 0;
                 return timeA - timeB;
            });
            
            sortedMatches.forEach((match, index) => {
                let wId = match.winnerId;
                let lId = match.loserId;
                if (!tempMembers[wId] || !tempMembers[lId]) return;
                
                let wRating = tempMembers[wId].rating;
                let lRating = tempMembers[lId].rating;
                let ratingChange = K_FACTOR * (1 - (1 / (1 + Math.pow(10, (lRating - wRating) / 400))));
                
                tempMembers[wId].rating += ratingChange;
                tempMembers[lId].rating -= ratingChange;
                
                if (index + 1 > 100 && match.isRankingMatch) {
                    let wRank = tempRanking.indexOf(wId);
                    let lRank = tempRanking.indexOf(lId);
                    if (wRank > -1 && lRank > -1 && wRank > lRank) {
                        [tempRanking[wRank], tempRanking[lRank]] = [tempRanking[lRank], tempRanking[wRank]];
                    }
                }
                if (index + 1 === 100) {
                    tempRanking.sort((a, b) => tempMembers[b].rating - tempMembers[a].rating);
                }
                
                let dStr = match.date && match.date.seconds ? new Date(match.date.seconds * 1000).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}) : `M${index+1}`;
                
                let currentWRank = index + 1 >= 100 ? tempRanking.indexOf(wId) + 1 : null;
                let currentLRank = index + 1 >= 100 ? tempRanking.indexOf(lId) + 1 : null;
                
                history[wId].push({ dateStr: dStr, rating: tempMembers[wId].rating, rank: currentWRank });
                history[lId].push({ dateStr: dStr, rating: tempMembers[lId].rating, rank: currentLRank });
            });
            
            return history;
        },
        allMembersTimeline() {
            if (!this.matches.length || !this.members.length) return { labels: [], datasetsRate: [], datasetsRank: [] };
            
            let labels = ['0'];
            let tempMembers = {};
            let memberDataRate = {};
            let memberDataRank = {};
            let colors = {}; 

            const generateColor = (index, total) => {
                const hue = (index * 360 / total) % 360;
                return `hsl(${hue}, 75%, 50%)`;
            };

            this.members.forEach((m, i) => {
                tempMembers[m.id] = { rating: 1500 };
                memberDataRate[m.id] = [1500];
                memberDataRank[m.id] = [null];
                colors[m.id] = generateColor(i, this.members.length);
            });

            let tempRanking = this.members.map(m => m.id);

            let sortedMatches = [...this.matches].sort((a, b) => {
                let timeA = a.date && a.date.seconds ? a.date.seconds : 0;
                let timeB = b.date && b.date.seconds ? b.date.seconds : 0;
                return timeA - timeB;
            });

            sortedMatches.forEach((match, index) => {
                let wId = match.winnerId;
                let lId = match.loserId;
                if (!tempMembers[wId] || !tempMembers[lId]) return;
                
                let wRating = tempMembers[wId].rating;
                let lRating = tempMembers[lId].rating;
                let ratingChange = K_FACTOR * (1 - (1 / (1 + Math.pow(10, (lRating - wRating) / 400))));
                
                tempMembers[wId].rating += ratingChange;
                tempMembers[lId].rating -= ratingChange;
                
                if (index + 1 > 100 && match.isRankingMatch) {
                    let wRank = tempRanking.indexOf(wId);
                    let lRank = tempRanking.indexOf(lId);
                    if (wRank > -1 && lRank > -1 && wRank > lRank) {
                        [tempRanking[wRank], tempRanking[lRank]] = [tempRanking[lRank], tempRanking[wRank]];
                    }
                }
                if (index + 1 === 100) {
                    tempRanking.sort((a, b) => tempMembers[b].rating - tempMembers[a].rating);
                }

                labels.push((index + 1).toString());

                this.members.forEach(m => {
                    memberDataRate[m.id].push(tempMembers[m.id].rating);
                    memberDataRank[m.id].push(index + 1 >= 100 ? tempRanking.indexOf(m.id) + 1 : null);
                });
            });

            let datasetsRate = this.members.map(m => ({
                label: m.name,
                data: memberDataRate[m.id],
                borderColor: colors[m.id],
                backgroundColor: colors[m.id],
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                borderWidth: 2
            }));

            let datasetsRank = this.members.map(m => ({
                label: m.name,
                data: memberDataRank[m.id],
                borderColor: colors[m.id],
                backgroundColor: colors[m.id],
                fill: false,
                tension: 0,
                stepped: true,
                pointRadius: 0,
                borderWidth: 2
            }));

            return { labels, datasetsRate, datasetsRank };
        },
        selectedMemberMonthlyAchievements() {
            if (!this.selectedMember) return [];
            let monthlyStats = {};
            
            this.matches.forEach(m => {
                let d = m.date && m.date.seconds ? new Date(m.date.seconds * 1000) : new Date();
                let monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
                
                if (!monthlyStats[monthKey]) monthlyStats[monthKey] = {};
                if (!monthlyStats[monthKey][m.winnerId]) monthlyStats[monthKey][m.winnerId] = { wins: 0, games: 0 };
                if (!monthlyStats[monthKey][m.loserId]) monthlyStats[monthKey][m.loserId] = { wins: 0, games: 0 };
                
                monthlyStats[monthKey][m.winnerId].wins++;
                monthlyStats[monthKey][m.winnerId].games++;
                monthlyStats[monthKey][m.loserId].games++;
            });
            
            let cd = new Date();
            let currentMonthKey = `${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2, '0')}`;
            let sId = this.selectedMember.id;
            
            let maxWins = 0;
            let maxGames = 0;
            let maxRate = 0;
            let titles = [];

            Object.keys(monthlyStats).sort().forEach(monthKey => {
                if (monthKey === currentMonthKey) return;
                
                let stats = monthlyStats[monthKey];
                let myStat = stats[sId];
                if (!myStat) return;
                
                if (myStat.wins > maxWins) maxWins = myStat.wins;
                if (myStat.games > maxGames) maxGames = myStat.games;
                if (myStat.games > 0) {
                    let rate = Math.floor((myStat.wins / myStat.games) * 100);
                    if (rate > maxRate) maxRate = rate;
                }

                let [y, mStr] = monthKey.split('-');
                let prefix = `${y}年${parseInt(mStr)}月`;
                
                let monthMaxWins = 0;
                Object.values(stats).forEach(st => { if(st.wins > monthMaxWins) monthMaxWins = st.wins; });
                if (monthMaxWins > 0 && myStat.wins === monthMaxWins) {
                    titles.push(`${prefix} 最多勝`);
                }
                
                let monthMaxRate = 0;
                Object.values(stats).forEach(st => {
                    if (st.games > 0) {
                        let r = Math.floor((st.wins / st.games) * 100);
                        if (r > monthMaxRate) monthMaxRate = r;
                    }
                });
                if (myStat.games > 0 && Math.floor((myStat.wins / myStat.games) * 100) === monthMaxRate && monthMaxRate > 0) {
                    titles.push(`${prefix} 最高勝率`);
                }
            });

            let achievements = [];
            const gThresh = [500, 400, 300, 200, 150, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
            let bestGame = gThresh.find(t => maxGames >= t);
            if (bestGame) achievements.push(`最高記録:月間${bestGame}試合`);

            const wThresh = [500, 400, 300, 200, 150, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
            let bestWin = wThresh.find(t => maxWins >= t);
            if (bestWin) achievements.push(`最高記録:月間${bestWin}勝`);

            const rThresh = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
            let bestRate = rThresh.find(t => maxRate >= t);
            if (bestRate) achievements.push(`最高記録:月間勝率${bestRate}%`);

            achievements.push(...titles);
            return achievements;
        },
        selectedMemberH2H() {
            if (!this.selectedMember) return [];
            let h2h = {};
            let sId = this.selectedMember.id;
            
            this.matches.forEach(m => {
                if (m.winnerId === sId) {
                    if(!h2h[m.loserId]) h2h[m.loserId] = { wins: 0, losses: 0 };
                    h2h[m.loserId].wins++;
                } else if (m.loserId === sId) {
                    if(!h2h[m.winnerId]) h2h[m.winnerId] = { wins: 0, losses: 0 };
                    h2h[m.winnerId].losses++;
                }
            });
            
            let result = Object.keys(h2h).map(opId => {
                let st = h2h[opId];
                let total = st.wins + st.losses;
                return {
                    opponentId: opId,
                    opponentName: this.getMemberName(opId),
                    wins: st.wins,
                    losses: st.losses,
                    total: total,
                    rate: total > 0 ? Math.round((st.wins / total) * 100) : 0
                };
            });
            return result.sort((a, b) => b.total - a.total || b.rate - a.rate);
        },
        selectedMemberChallenges() {
            if (!this.selectedMember || this.matches.length < 100) return [];
            let sId = this.selectedMember.id;
            let myRank = this.getRank(sId);
            if (myRank === -1 || myRank === 0) return []; 
            
            let challenges = [];
            for (let i = 0; i < myRank; i++) {
                let targetId = this.ranking[i];
                let targetRank = i;
                let requiredWins = (myRank - targetRank) * 10;
                
                let rightId = `${sId}_${targetId}`;
                let right = this.challengeRights.find(r => r.id === rightId);
                let currentWins = right ? right.winCount : 0;
                
                let remaining = requiredWins - currentWins;
                challenges.push({
                    targetId: targetId,
                    targetName: this.getMemberName(targetId),
                    targetRank: targetRank + 1,
                    requiredWins: requiredWins,
                    currentWins: currentWins,
                    remaining: remaining > 0 ? remaining : 0,
                    canChallenge: remaining <= 0
                });
            }
            return challenges;
        }
    },
    methods: {
        async initializeFirebase() {
            try {
                const app = initializeApp(firebaseConfig);
                this.db = getFirestore(app);
                this.auth = getAuth(app);
                onAuthStateChanged(this.auth, user => {
                    if (user) { this.setupFirestoreListeners(); } else { this.loading = false; }
                });
                await signInAnonymously(this.auth);
            } catch (error) {
                console.error("Firebase initialization failed:", error);
                alert("Firebaseの設定が不十分なため、アプリを初期化できません。");
                this.loading = false;
            }
        },
        setupFirestoreListeners() {
            const appId = firebaseConfig.appId;
            const dbPath = `/artifacts/${appId}/public/data/`;
            let initialLoads = 4;
            const onInitialLoad = () => { if (--initialLoads === 0) this.loading = false; };
            onSnapshot(collection(this.db, dbPath + 'members'), s => { this.members = s.docs.map(d => ({ id: d.id, ...d.data() })); onInitialLoad(); }, e => console.error("Members listener error:", e));
            onSnapshot(query(collection(this.db, dbPath + 'matches'), orderBy('date', 'desc')), s => { this.matches = s.docs.map(d => ({ id: d.id, ...d.data() })); onInitialLoad(); }, e => console.error("Matches listener error:", e));
            onSnapshot(doc(this.db, dbPath + 'ranking/current'), d => { this.ranking = d.exists() ? d.data().order || [] : []; onInitialLoad(); }, e => console.error("Ranking listener error:", e));
            onSnapshot(collection(this.db, dbPath + 'challengeRights'), s => { this.challengeRights = s.docs.map(d => ({ id: d.id, ...d.data() })); onInitialLoad(); }, e => console.error("ChallengeRights listener error:", e));
        },
        getMember(memberId) { return this.members.find(m => m.id === memberId); },
        getMemberName(memberId) { return this.getMember(memberId)?.name || '（元部員）'; },
        getRank(memberId) { return this.ranking.indexOf(memberId); },
        getTitleInfo(rating) {
            if (rating === 1500) return this.titles.find(t => t.name === '初期値');
            return this.titles.find(t => rating >= t.min && (!t.max || rating <= t.max)) || { name: '---', color: '#000' };
        },
        getAchievementText(achId) { return ACHIEVEMENTS[achId] || achId; },
        getDisplayableChallenges(memberId) { return this.allAvailableChallenges.filter(c => c.challengerId === memberId); },
        async addMember() {
            if (!this.newMemberName.trim() || this.members.some(m => m.name === this.newMemberName.trim())) {
                alert('名前が空か、同じ名前の部員が既に存在します。'); return;
            }
            const appId = firebaseConfig.appId;
            const dbPath = `/artifacts/${appId}/public/data/`;
            const newMember = { name: this.newMemberName.trim(), currentRating: INITIAL_RATING, maxRating: INITIAL_RATING, wins: 0, losses: 0, totalGames: 0, winStreak: 0, maxWinStreak: 0, achievements: [], createdAt: serverTimestamp() };
            const docRef = await addDoc(collection(this.db, dbPath + 'members'), newMember);
            const newRanking = [...this.ranking, docRef.id];
            await setDoc(doc(this.db, dbPath + 'ranking/current'), { order: newRanking }, { merge: true });
            this.newMemberName = '';
            alert(`${newMember.name}さんを部員として追加しました。`);
        },
        async addMatch(isRankingMatch = false) {
            const winnerId = isRankingMatch ? this.rankingMatch.winnerId : this.match.winnerId;
            const loserId = isRankingMatch ? (this.selectedChallenge.challengerId === winnerId ? this.selectedChallenge.targetId : this.selectedChallenge.challengerId) : this.match.loserId;

            if (!winnerId || !loserId) { alert("勝者と敗者を選択してください。"); return; }
            const winner = this.getMember(winnerId);
            const loser = this.getMember(loserId);
            if (!winner || !loser) { alert("部員情報が見つかりません。"); return; }

            const winnerRating = winner.currentRating;
            const loserRating = loser.currentRating;
            const winnerExpected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
            const ratingChange = K_FACTOR * (1 - winnerExpected);

            const winnerUpdate = this.calculateMemberUpdate(winner, ratingChange, true);
            const loserUpdate = this.calculateMemberUpdate(loser, -ratingChange, false);

            try {
                const appId = firebaseConfig.appId;
                const dbPath = `/artifacts/${appId}/public/data/`;
                const batch = writeBatch(this.db);

                batch.update(doc(this.db, dbPath + `members/${winnerId}`), winnerUpdate);
                batch.update(doc(this.db, dbPath + `members/${loserId}`), loserUpdate);

                const player1Id = isRankingMatch ? this.selectedChallenge.challengerId : winnerId;
                const player2Id = isRankingMatch ? this.selectedChallenge.targetId : loserId;
                batch.set(doc(collection(this.db, dbPath + 'matches')), { date: serverTimestamp(), player1Id, player2Id, winnerId, loserId, ratingChangeWinner: ratingChange, ratingChangeLoser: -ratingChange, isRankingMatch });

                if (isRankingMatch) {
                    if (winnerId === this.selectedChallenge.challengerId) {
                        const newRanking = [...this.ranking];
                        const [winIdx, loseIdx] = [this.getRank(winnerId), this.getRank(loserId)];
                        [newRanking[winIdx], newRanking[loseIdx]] = [newRanking[loseIdx], newRanking[winIdx]];
                        batch.update(doc(this.db, dbPath + 'ranking/current'), { order: newRanking });
                    }
                    const rightId1 = `${player1Id}_${player2Id}`;
                    const rightId2 = `${player2Id}_${player1Id}`;
                    batch.set(doc(this.db, dbPath, `challengeRights/${rightId1}`), { challengerId: player1Id, targetId: player2Id, winCount: 0 }, { merge: true });
                    batch.set(doc(this.db, dbPath, `challengeRights/${rightId2}`), { challengerId: player2Id, targetId: player1Id, winCount: 0 }, { merge: true });
                } else {
                    const [winnerRank, loserRank] = [this.getRank(winnerId), this.getRank(loserId)];
                    if (winnerRank > loserRank) { 
                        const challengeDocId = `${winnerId}_${loserId}`;
                        const challengeDocRef = doc(this.db, dbPath + `challengeRights/${challengeDocId}`);
                        const challengeDoc = await getDoc(challengeDocRef);
                        const currentWins = challengeDoc.exists() ? challengeDoc.data().winCount : 0;
                        batch.set(challengeDocRef, { challengerId: winnerId, targetId: loserId, winCount: currentWins + 1 }, { merge: true });
                    }
                }

                if (this.matches.length + 1 === 100) {
                    alert('通算100試合達成！ランキングを現在のレート順に更新します。');
                    const membersCopy = JSON.parse(JSON.stringify(this.members));
                    membersCopy.find(m => m.id === winnerId).currentRating += ratingChange;
                    membersCopy.find(m => m.id === loserId).currentRating -= ratingChange;
                    const sortedMembers = membersCopy.sort((a, b) => b.currentRating - a.currentRating);
                    batch.update(doc(this.db, dbPath + 'ranking/current'), { order: sortedMembers.map(m => m.id) });
                }

                await batch.commit();
                alert("試合結果を登録しました。");
                this.match = { winnerId: '', loserId: '' };
                this.rankingMatch = { challengeId: '', winnerId: '' };

                if (this.activeTab === 'ranking') {
                    this.$nextTick(() => {
                        if (this.rankingMode === 'rate') this.renderAllRateChart();
                        if (this.rankingMode === 'rank') this.renderAllRankChart();
                    });
                }

            } catch (error) { console.error("試合結果登録エラー:", error); alert("試合結果の登録に失敗しました。"); }
        },
        calculateMemberUpdate(member, ratingChange, isWinner) {
            const newRating = member.currentRating + ratingChange;
            const updated = { currentRating: newRating, totalGames: member.totalGames + 1, achievements: [...member.achievements] };
            if (isWinner) {
                Object.assign(updated, { maxRating: Math.max(member.maxRating, newRating), wins: member.wins + 1, winStreak: member.winStreak + 1, maxWinStreak: Math.max(member.maxWinStreak, member.winStreak + 1) });
            } else {
                Object.assign(updated, { losses: member.losses + 1, winStreak: 0 });
            }
            this.checkAchievements(member, updated);
            return updated;
        },
        addRankingMatch() { this.addMatch(true); },
        checkAchievements(originalMember, updatedMember) {
            const check = (map, value) => { if (map[value] && !originalMember.achievements.includes(map[value])) updatedMember.achievements.push(map[value]); };
            check(WIN_ACHIEVEMENTS_MAP, updatedMember.wins);
            check(GAME_ACHIEVEMENTS_MAP, updatedMember.totalGames);
            check(STREAK_ACHIEVEMENTS_MAP, updatedMember.winStreak);
        },
        showMemberDetails(member) { this.selectedMember = member; },
        closeMemberDetails() { this.selectedMember = null; },
        toggleHistoryMenu(matchId) { this.historyMenuOpenForMatchId = this.historyMenuOpenForMatchId === matchId ? null : matchId; },
        confirmDeleteMatch(match) { this.matchToDelete = match; this.historyMenuOpenForMatchId = null; },
        cancelDelete() { this.matchToDelete = null; },
        openEditModal(match) { this.matchToEdit = { ...match }; this.historyMenuOpenForMatchId = null; },
        cancelEdit() { this.matchToEdit = null; },
        async deleteConfirmedMatch() {
            if (!this.matchToDelete) return;
            await this.runFullRecalculation({ deleteMatchId: this.matchToDelete.id });
            this.matchToDelete = null;
        },
        async saveMatchEdit() {
            if (!this.matchToEdit) return;
            await this.runFullRecalculation({ editMatch: this.matchToEdit });
            this.matchToEdit = null;
        },
        async runFullRecalculation({ deleteMatchId = null, editMatch = null } = {}) {
            this.isRecalculating = true;
            try {
                const appId = firebaseConfig.appId;
                const dbPath = `/artifacts/${appId}/public/data/`;

                const membersQuery = query(collection(this.db, dbPath + 'members'), orderBy('createdAt'));
                const matchesQuery = query(collection(this.db, dbPath + 'matches'), orderBy('date'));
                const [membersSnapshot, matchesSnapshot] = await Promise.all([ getDocs(membersQuery), getDocs(matchesQuery) ]);
                const allMembersForCalc = membersSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
                let processedMatches = matchesSnapshot.docs.map(d => ({id: d.id, ...d.data()}));

                if (deleteMatchId) processedMatches = processedMatches.filter(m => m.id !== deleteMatchId);
                if (editMatch) {
                    const index = processedMatches.findIndex(m => m.id === editMatch.id);
                    if (index !== -1) {
                        processedMatches[index].winnerId = editMatch.winnerId;
                        processedMatches[index].loserId = [editMatch.player1Id, editMatch.player2Id].find(id => id !== editMatch.winnerId);
                    }
                }

                let tempMembers = JSON.parse(JSON.stringify(allMembersForCalc));
                tempMembers.forEach(m => Object.assign(m, { currentRating: INITIAL_RATING, maxRating: INITIAL_RATING, wins: 0, losses: 0, totalGames: 0, winStreak: 0, maxWinStreak: 0, achievements: [] }));
                let tempRanking = allMembersForCalc.map(m => m.id);
                let tempChallengeRights = {};

                processedMatches.forEach((match, index) => {
                    const winner = tempMembers.find(m => m.id === match.winnerId);
                    const loser = tempMembers.find(m => m.id === match.loserId);
                    if (!winner || !loser) return;

                    const winnerRating = winner.currentRating;
                    const loserRating = loser.currentRating;
                    const ratingChange = K_FACTOR * (1 - (1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400))));

                    Object.assign(winner, this.calculateMemberUpdate(winner, ratingChange, true));
                    Object.assign(loser, this.calculateMemberUpdate(loser, -ratingChange, false));
                    match.ratingChangeWinner = ratingChange;
                    match.ratingChangeLoser = -ratingChange;

                    const winnerRank = tempRanking.indexOf(winner.id);
                    const loserRank = tempRanking.indexOf(loser.id);

                    if (index + 1 > 100 && match.isRankingMatch) {
                        if (winnerRank > loserRank) {
                            [tempRanking[winnerRank], tempRanking[loserRank]] = [tempRanking[loserRank], tempRanking[winnerRank]];
                        }
                        const rightId1 = `${winner.id}_${loser.id}`;
                        const rightId2 = `${loser.id}_${winner.id}`;
                        if (tempChallengeRights[rightId1]) tempChallengeRights[rightId1].winCount = 0;
                        if (tempChallengeRights[rightId2]) tempChallengeRights[rightId2].winCount = 0;
                    } else if (winnerRank > loserRank) {
                        const rightId = `${winner.id}_${loser.id}`;
                        if (!tempChallengeRights[rightId]) tempChallengeRights[rightId] = { challengerId: winner.id, targetId: loser.id, winCount: 0 };
                        tempChallengeRights[rightId].winCount++;
                    }

                    if (index + 1 === 100) {
                        tempRanking.sort((a, b) => tempMembers.find(m=>m.id===b).currentRating - tempMembers.find(m=>m.id===a).currentRating);
                    }
                });

                const batch = writeBatch(this.db);
                tempMembers.forEach(m => batch.update(doc(this.db, dbPath + `members/${m.id}`), m));
                processedMatches.forEach(m => batch.update(doc(this.db, dbPath + `matches/${m.id}`), m));
                if (deleteMatchId) batch.delete(doc(this.db, dbPath + `matches/${deleteMatchId}`));

                const oldRights = await getDocs(collection(this.db, dbPath + 'challengeRights'));
                oldRights.docs.forEach(d => batch.delete(d.ref));
                Object.values(tempChallengeRights).forEach(r => batch.set(doc(this.db, dbPath + `challengeRights/${r.challengerId}_${r.targetId}`), r));
                batch.set(doc(this.db, dbPath + 'ranking/current'), { order: tempRanking });

                await batch.commit();
                alert("データの再計算と更新が完了しました。");

                if (this.activeTab === 'ranking') {
                    this.$nextTick(() => {
                        if (this.rankingMode === 'rate') this.renderAllRateChart();
                        if (this.rankingMode === 'rank') this.renderAllRankChart();
                    });
                }
            } catch (error) { console.error("Recalculation error:", error); alert("再計算中にエラーが発生しました。");
            } finally { this.isRecalculating = false; }
        },
        setRankingMode(mode) {
            this.rankingMode = mode;
            this.$nextTick(() => {
                if (mode === 'rate') this.renderAllRateChart();
                if (mode === 'rank') this.renderAllRankChart();
            });
        },
        renderAllRateChart() {
            const canvas = document.getElementById('allRateChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (this.allRateChartInstance) this.allRateChartInstance.destroy();

            const data = this.allMembersTimeline;
            this.allRateChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: data.labels, datasets: data.datasetsRate },
                options: {
                    responsive: true,
                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    scales: {
                        x: { title: { display: true, text: '試合数(通算)' }, ticks: { maxTicksLimit: 10 } },
                        y: { title: { display: true, text: 'レート' }, suggestedMin: 1200, suggestedMax: 1800 }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                        tooltip: { callbacks: { title: (ctx) => `通算 ${ctx[0].label} 試合終了時` } }
                    }
                }
            });
        },
        renderAllRankChart() {
            if (this.matches.length < 100) return;
            const canvas = document.getElementById('allRankChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (this.allRankChartInstance) this.allRankChartInstance.destroy();

            const data = this.allMembersTimeline;
            this.allRankChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: data.labels, datasets: data.datasetsRank },
                options: {
                    responsive: true,
                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    scales: {
                        x: { title: { display: true, text: '試合数(通算)' }, min: '100', ticks: { maxTicksLimit: 10 } },
                        y: { 
                            title: { display: true, text: '順位' }, 
                            reverse: true, 
                            min: 1,
                            max: this.members.length > 0 ? this.members.length : 5,
                            ticks: { stepSize: 1, precision: 0 }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                        tooltip: { callbacks: { title: (ctx) => `通算 ${ctx[0].label} 試合終了時` } }
                    }
                }
            });
        },
        renderChart() {
            if (!this.selectedMember || this.modalTab !== 'stats') return;
            
            const canvas = document.getElementById('ratingChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }
            
            let memberHistory = this.fullHistory[this.selectedMember.id];
            if (!memberHistory) return;
            
            let labels = memberHistory.map(h => h.dateStr);
            let ratings = memberHistory.map(h => h.rating);
            let ranks = memberHistory.map(h => h.rank);
            
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'レート',
                            data: ratings,
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            yAxisID: 'yRating',
                            tension: 0.2,
                            fill: true,
                            pointRadius: 2
                        },
                        {
                            label: '順位',
                            data: ranks,
                            borderColor: 'rgb(239, 68, 68)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            yAxisID: 'yRank',
                            tension: 0,
                            stepped: true,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        yRating: {
                            type: 'linear',
                            position: 'left',
                            title: { display: true, text: 'レート' },
                            suggestedMin: 1000,
                            suggestedMax: 2000
                        },
                        yRank: {
                            type: 'linear',
                            position: 'right',
                            title: { display: true, text: '順位' },
                            reverse: true,
                            grid: { drawOnChartArea: false },
                            ticks: { stepSize: 1, precision: 0 }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { boxWidth: 12 }
                        }
                    }
                }
            });
        }
    },
    mounted() { this.initializeFirebase(); }
};

Vue.createApp(App).mount('#app');
