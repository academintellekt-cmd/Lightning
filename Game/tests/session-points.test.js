const assert=require('assert');const fs=require('fs');const path=require('path');
const P=require('../lib/session-points');

// Each bracelet gets its own best round, not the pair's best.
assert.deepStrictEqual(P.bestPoints(['A','B'],[{scores:[12,30]},{scores:[25,8]}]),[{ic:'A',points:25},{ic:'B',points:30}]);
// The loser keeps their own score.
assert.deepStrictEqual(P.bestPoints(['A','B'],[{scores:[40,3]}]),[{ic:'A',points:40},{ic:'B',points:3}]);
// No rounds played -> both 0.
assert.deepStrictEqual(P.bestPoints(['A','B'],[]),[{ic:'A',points:0},{ic:'B',points:0}]);
// A seat without a bracelet is left out; the Gateway falls back to the aggregate for it.
assert.deepStrictEqual(P.bestPoints([null,'B'],[{scores:[5,7]}]),[{ic:'B',points:7}]);

const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const control=fs.readFileSync(path.join(__dirname,'..','public','control.html'),'utf8');
assert(control.includes('../lib/session-points.js'),'control page loads session-points');
assert(app.includes('points:SessionPoints.bestPoints(gatewayUids,sessionRounds)'),'session end reports per-player points');
assert(app.includes('gatewayUids=users.slice(0,2).map('),'unlock remembers both bracelet uids');
console.log('session-points tests passed');
