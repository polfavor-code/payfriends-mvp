"use strict";exports.id=918,exports.ids=[918],exports.modules={3085:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"DraftMode",{enumerable:!0,get:function(){return s}});let a=r(5869),n=r(6278);class s{get isEnabled(){return this._provider.isEnabled}enable(){let e=a.staticGenerationAsyncStorage.getStore();return e&&(0,n.trackDynamicDataAccessed)(e,"draftMode().enable()"),this._provider.enable()}disable(){let e=a.staticGenerationAsyncStorage.getStore();return e&&(0,n.trackDynamicDataAccessed)(e,"draftMode().disable()"),this._provider.disable()}constructor(e){this._provider=e}}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},8757:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{cookies:function(){return p},draftMode:function(){return _},headers:function(){return c}});let a=r(8996),n=r(3047),s=r(2044),o=r(2934),i=r(3085),u=r(6278),d=r(5869),l=r(4580);function c(){let e="headers",t=d.staticGenerationAsyncStorage.getStore();if(t){if(t.forceStatic)return n.HeadersAdapter.seal(new Headers({}));(0,u.trackDynamicDataAccessed)(t,e)}return(0,l.getExpectedRequestStore)(e).headers}function p(){let e="cookies",t=d.staticGenerationAsyncStorage.getStore();if(t){if(t.forceStatic)return a.RequestCookiesAdapter.seal(new s.RequestCookies(new Headers({})));(0,u.trackDynamicDataAccessed)(t,e)}let r=(0,l.getExpectedRequestStore)(e),n=o.actionAsyncStorage.getStore();return(null==n?void 0:n.isAction)||(null==n?void 0:n.isAppRoute)?r.mutableCookies:r.cookies}function _(){let e=(0,l.getExpectedRequestStore)("draftMode");return new i.DraftMode(e.draftMode)}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},3047:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{HeadersAdapter:function(){return s},ReadonlyHeadersError:function(){return n}});let a=r(8238);class n extends Error{constructor(){super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers")}static callable(){throw new n}}class s extends Headers{constructor(e){super(),this.headers=new Proxy(e,{get(t,r,n){if("symbol"==typeof r)return a.ReflectAdapter.get(t,r,n);let s=r.toLowerCase(),o=Object.keys(e).find(e=>e.toLowerCase()===s);if(void 0!==o)return a.ReflectAdapter.get(t,o,n)},set(t,r,n,s){if("symbol"==typeof r)return a.ReflectAdapter.set(t,r,n,s);let o=r.toLowerCase(),i=Object.keys(e).find(e=>e.toLowerCase()===o);return a.ReflectAdapter.set(t,i??r,n,s)},has(t,r){if("symbol"==typeof r)return a.ReflectAdapter.has(t,r);let n=r.toLowerCase(),s=Object.keys(e).find(e=>e.toLowerCase()===n);return void 0!==s&&a.ReflectAdapter.has(t,s)},deleteProperty(t,r){if("symbol"==typeof r)return a.ReflectAdapter.deleteProperty(t,r);let n=r.toLowerCase(),s=Object.keys(e).find(e=>e.toLowerCase()===n);return void 0===s||a.ReflectAdapter.deleteProperty(t,s)}})}static seal(e){return new Proxy(e,{get(e,t,r){switch(t){case"append":case"delete":case"set":return n.callable;default:return a.ReflectAdapter.get(e,t,r)}}})}merge(e){return Array.isArray(e)?e.join(", "):e}static from(e){return e instanceof Headers?e:new s(e)}append(e,t){let r=this.headers[e];"string"==typeof r?this.headers[e]=[r,t]:Array.isArray(r)?r.push(t):this.headers[e]=t}delete(e){delete this.headers[e]}get(e){let t=this.headers[e];return void 0!==t?this.merge(t):null}has(e){return void 0!==this.headers[e]}set(e,t){this.headers[e]=t}forEach(e,t){for(let[r,a]of this.entries())e.call(t,a,r,this)}*entries(){for(let e of Object.keys(this.headers)){let t=e.toLowerCase(),r=this.get(t);yield[t,r]}}*keys(){for(let e of Object.keys(this.headers)){let t=e.toLowerCase();yield t}}*values(){for(let e of Object.keys(this.headers)){let t=this.get(e);yield t}}[Symbol.iterator](){return this.entries()}}},8996:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{MutableRequestCookiesAdapter:function(){return c},ReadonlyRequestCookiesError:function(){return o},RequestCookiesAdapter:function(){return i},appendMutableCookies:function(){return l},getModifiedCookieValues:function(){return d}});let a=r(2044),n=r(8238),s=r(5869);class o extends Error{constructor(){super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#cookiessetname-value-options")}static callable(){throw new o}}class i{static seal(e){return new Proxy(e,{get(e,t,r){switch(t){case"clear":case"delete":case"set":return o.callable;default:return n.ReflectAdapter.get(e,t,r)}}})}}let u=Symbol.for("next.mutated.cookies");function d(e){let t=e[u];return t&&Array.isArray(t)&&0!==t.length?t:[]}function l(e,t){let r=d(t);if(0===r.length)return!1;let n=new a.ResponseCookies(e),s=n.getAll();for(let e of r)n.set(e);for(let e of s)n.set(e);return!0}class c{static wrap(e,t){let r=new a.ResponseCookies(new Headers);for(let t of e.getAll())r.set(t);let o=[],i=new Set,d=()=>{let e=s.staticGenerationAsyncStorage.getStore();if(e&&(e.pathWasRevalidated=!0),o=r.getAll().filter(e=>i.has(e.name)),t){let e=[];for(let t of o){let r=new a.ResponseCookies(new Headers);r.set(t),e.push(r.toString())}t(e)}};return new Proxy(r,{get(e,t,r){switch(t){case u:return o;case"delete":return function(...t){i.add("string"==typeof t[0]?t[0]:t[0].name);try{e.delete(...t)}finally{d()}};case"set":return function(...t){i.add("string"==typeof t[0]?t[0]:t[0].name);try{return e.set(...t)}finally{d()}};default:return n.ReflectAdapter.get(e,t,r)}}})}}},9480:(e,t,r)=>{r.d(t,{sM:()=>s});var a=r(8757);async function n(){let e=(await (0,a.cookies)()).get("admin_session");if(!e?.value)return null;try{let t=JSON.parse(Buffer.from(e.value,"base64").toString());if(Date.now()-t.createdAt>864e5)return null;return t}catch{return null}}async function s(){let e=await n();return e?.adminId||"system"}},5748:(e,t,r)=>{r.d(t,{Dx:()=>_,GA:()=>l,HJ:()=>R,HX:()=>h,Op:()=>C,Rf:()=>d,WP:()=>y,X_:()=>c,h8:()=>f,hW:()=>T,l$:()=>m,lE:()=>p,m2:()=>w,mg:()=>g,rY:()=>S,wD:()=>E,wV:()=>b,xl:()=>I,y6:()=>O});var a=r(5890),n=r.n(a),s=r(5315);let o=r.n(s)().join(process.cwd(),"..","data","payfriends.db"),i=null;function u(){return i||(i=new(n())(o,{readonly:!1})).pragma("journal_mode = WAL"),i}function d(e,t=50,r=0){let a=u(),n=`
    SELECT id, full_name, email, phone_number, created_at, public_id
    FROM users
  `,s=[];if(e){n+=" WHERE full_name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR CAST(id AS TEXT) = ?";let t=`%${e}%`;s.push(t,t,t,e)}return n+=" ORDER BY created_at DESC LIMIT ? OFFSET ?",s.push(t,r),a.prepare(n).all(...s)}function l(e){return u().prepare(`
    SELECT id, full_name, email, phone_number, created_at, public_id
    FROM users WHERE id = ?
  `).get(e)}function c(e){let t=u(),r=t.prepare(`
    SELECT COUNT(*) as count FROM agreements WHERE lender_user_id = ?
  `).get(e),a=t.prepare(`
    SELECT COUNT(*) as count FROM group_tabs WHERE creator_user_id = ?
  `).get(e);return{loansCreated:r?.count||0,grouptabsCreated:a?.count||0}}function p(e,t){N(t,"soft_disable_user","user",String(e),{action:"disabled"})}function _(e,t){N(t,"enable_user","user",String(e),{action:"enabled"})}function f(e,t,r=!0){let a=u(),n=a.prepare(`
    SELECT COUNT(*) as count FROM agreements WHERE lender_user_id = ? OR borrower_user_id = ?
  `).get(e,e),s=a.prepare(`
    SELECT COUNT(*) as count FROM group_tabs WHERE creator_user_id = ?
  `).get(e),o=(n?.count||0)>0||(s?.count||0)>0;return o&&!r?{success:!1,error:"User has financial history. Must anonymize instead of hard delete."}:(o?(a.prepare(`
      UPDATE users 
      SET full_name = '[Deleted User]', 
          email = 'deleted_' || id || '@deleted.local',
          phone_number = NULL
      WHERE id = ?
    `).run(e),N(t,"anonymize_user","user",String(e),{reason:"User had financial history",loans_count:n?.count||0,grouptabs_count:s?.count||0})):(a.prepare("DELETE FROM users WHERE id = ?").run(e),N(t,"delete_user","user",String(e),{hard_delete:!0})),{success:!0})}function E(e,t=50,r=0){let a=u(),n=`
    SELECT a.*,
           COALESCE(a.friend_first_name, b.full_name, a.borrower_email) as borrower_name
    FROM agreements a
    LEFT JOIN users b ON a.borrower_user_id = b.id
    WHERE 1=1
  `,s=[];return e?.status&&(n+=" AND a.status = ?",s.push(e.status)),e?.lenderId&&(n+=" AND a.lender_user_id = ?",s.push(e.lenderId)),e?.borrowerId&&(n+=" AND a.borrower_user_id = ?",s.push(e.borrowerId)),e?.dateFrom&&(n+=" AND a.created_at >= ?",s.push(e.dateFrom)),e?.dateTo&&(n+=" AND a.created_at <= ?",s.push(e.dateTo)),n+=" ORDER BY a.created_at DESC LIMIT ? OFFSET ?",s.push(t,r),a.prepare(n).all(...s)}function T(e){return u().prepare(`
    SELECT a.*,
           l.full_name as lender_display_name,
           COALESCE(a.friend_first_name, b.full_name, a.borrower_email) as borrower_name
    FROM agreements a
    LEFT JOIN users l ON a.lender_user_id = l.id
    LEFT JOIN users b ON a.borrower_user_id = b.id
    WHERE a.id = ?
  `).get(e)}function g(e){return u().prepare(`
    SELECT p.*, u.full_name as payer_name
    FROM payments p
    LEFT JOIN users u ON p.recorded_by_user_id = u.id
    WHERE p.agreement_id = ? 
    ORDER BY p.created_at DESC
  `).all(e)}function y(e,t=50,r=0){let a=u(),n=`
    SELECT g.*, u.full_name as creator_name
    FROM group_tabs g
    LEFT JOIN users u ON g.creator_user_id = u.id
    WHERE 1=1
  `,s=[];return e?.status&&(n+=" AND g.status = ?",s.push(e.status)),e?.type&&(n+=" AND g.tab_type = ?",s.push(e.type)),e?.creatorId&&(n+=" AND g.creator_user_id = ?",s.push(e.creatorId)),n+=" ORDER BY g.created_at DESC LIMIT ? OFFSET ?",s.push(t,r),a.prepare(n).all(...s)}function m(e){return u().prepare(`
    SELECT g.*, u.full_name as creator_name
    FROM group_tabs g
    LEFT JOIN users u ON g.creator_user_id = u.id
    WHERE g.id = ?
  `).get(e)}function R(e){return u().prepare(`
    SELECT gp.*, u.full_name as user_name
    FROM group_tab_participants gp
    LEFT JOIN users u ON gp.user_id = u.id
    WHERE gp.group_tab_id = ?
  `).all(e)}function O(e,t=50,r=0){let a=u(),n=[],s=[];if(!e?.entityType||"loan"===e.entityType){let t=`
      SELECT p.id, 'loan' as entity_type, p.agreement_id as entity_id,
             COALESCE(a.friend_first_name, a.borrower_email, 'Loan #' || p.agreement_id) as entity_name,
             p.recorded_by_user_id as reporter_id, p.amount_cents,
             p.status, p.created_at,
             NULL as reviewed_at, u.full_name as reporter_name
      FROM payments p
      LEFT JOIN users u ON p.recorded_by_user_id = u.id
      LEFT JOIN agreements a ON p.agreement_id = a.id
      WHERE 1=1
    `;e?.status&&(t+=" AND p.status = ?",n.push(e.status)),s.push(t)}if((!e?.entityType||"grouptab"===e.entityType)&&a.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='group_tab_payment_reports'
    `).get()){let t=`
        SELECT gpr.id, 'grouptab' as entity_type, gpr.group_tab_id as entity_id,
               gt.name as entity_name,
               gpr.participant_id as reporter_id, gpr.amount_cents,
               gpr.status, gpr.created_at,
               gpr.reviewed_at, gpr.reporter_name as reporter_name
        FROM group_tab_payment_reports gpr
        LEFT JOIN group_tabs gt ON gpr.group_tab_id = gt.id
        WHERE 1=1
      `;e?.status&&(t+=" AND gpr.status = ?",n.push(e.status)),s.push(t)}if(0===s.length)return[];let o=s.join(" UNION ALL "),i=`SELECT * FROM (${o}) ORDER BY created_at DESC LIMIT ? OFFSET ?`;return n.push(t,r),a.prepare(i).all(...n)}function b(e,t){N(t,"mark_reviewed","payment_report",String(e),{})}function L(){u().exec(`
    CREATE TABLE IF NOT EXISTS admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      note TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)}function S(e,t){return L(),u().prepare(`
    SELECT * FROM admin_notes 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `).all(e,String(t))}function h(e,t,r,a){L(),u().prepare(`
    INSERT INTO admin_notes (entity_type, entity_id, note, admin_id)
    VALUES (?, ?, ?, ?)
  `).run(e,String(t),r,a),N(a,"add_note",e,String(t),{note_preview:r.substring(0,100)})}function A(){u().exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)}function N(e,t,r,a,n){A(),u().prepare(`
    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(e,t,r,a,JSON.stringify(n))}function C(e=100,t=0){return A(),u().prepare(`
    SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(e,t)}function M(){u().exec(`
    CREATE TABLE IF NOT EXISTS remote_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'string',
      description TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)}function w(){return M(),u().prepare("SELECT * FROM remote_config ORDER BY key").all()}function I(e,t,r,a,n){M(),u().prepare(`
    INSERT OR REPLACE INTO remote_config (key, value, type, description, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(e,t,r,a),N(n,"update_config","remote_config",e,{value:t,type:r})}}};