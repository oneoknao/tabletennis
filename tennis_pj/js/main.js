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
            loading: true,
            isRecalculating: false,
            activeTab: 'ranking',
            rankingMode: 'list',
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

            return { mostWins: mostWinsIds, bestRate: bestRateIds, monthLabel: monthLabel };
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
        selected
