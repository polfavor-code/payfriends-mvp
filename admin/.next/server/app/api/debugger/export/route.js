"use strict";(()=>{var e={};e.id=713,e.ids=[713],e.modules={5890:e=>{e.exports=require("better-sqlite3")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5315:e=>{e.exports=require("path")},586:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>m,patchFetch:()=>T,requestAsyncStorage:()=>_,routeModule:()=>d,serverHooks:()=>E,staticGenerationAsyncStorage:()=>c});var a={};r.r(a),r.d(a,{GET:()=>p});var n=r(9303),s=r(8716),o=r(670),u=r(7070),i=r(5748),l=r(8342);async function p(e){let{searchParams:t}=new URL(e.url),r=t.get("loan_id");if(!r)return u.NextResponse.json({error:"loan_id required"},{status:400});let a=(0,i.hW)(r);if(!a)return u.NextResponse.json({error:"Loan not found"},{status:404});let n={principal:a.amount_cents,annualInterestRate:a.interest_rate||0,repaymentType:"one_time"===a.repayment_type?"one_time":"installments",numInstallments:a.installment_count||1,paymentFrequency:a.payment_frequency||"monthly",loanStartMode:a.loan_start_mode||"upon_acceptance",loanStartDate:a.money_sent_date||a.money_transfer_date||null,firstPaymentOffsetDays:a.first_payment_offset_days||30},s=(0,l.CP)(n),o={loan_id:a.id,exported_at:new Date().toISOString(),stored:{inputs:{principal_cents:a.amount_cents,interest_rate:a.interest_rate,repayment_type:a.repayment_type,installment_count:a.installment_count,payment_frequency:a.payment_frequency,calc_version:a.calc_version},outputs:{planned_total_cents:a.planned_total_cents}},recomputed:s||{error:"Calculation failed"}};return new u.NextResponse(JSON.stringify(o,null,2),{headers:{"Content-Type":"application/json","Content-Disposition":`attachment; filename="debug-${r}.json"`}})}let d=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/debugger/export/route",pathname:"/api/debugger/export",filename:"route",bundlePath:"app/api/debugger/export/route"},resolvedPagePath:"/Users/paulsomers/Dev/payfriends-mvp/admin/src/app/api/debugger/export/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:_,staticGenerationAsyncStorage:c,serverHooks:E}=d,m="/api/debugger/export/route";function T(){return(0,o.patchFetch)({serverHooks:E,staticGenerationAsyncStorage:c})}},8342:(e,t,r)=>{function a(e,t){let r=new Date(e),a=r.getMonth()+t,n=r.getFullYear()+Math.floor(a/12),s=(a%12+12)%12,o=r.getDate();r.setFullYear(n,s,1);let u=new Date(n,s+1,0).getDate();return r.setDate(Math.min(o,u)),r}function n(e,t){let r=new Date(e);switch(r.setHours(0,0,0,0),t){case"weekly":return new Date(r.getTime()+6048e5);case"biweekly":return new Date(r.getTime()+12096e5);case"every_4_weeks":return new Date(r.getTime()+24192e5);case"monthly":case"every-month":return a(r,1);case"quarterly":return a(r,3);case"yearly":return a(r,12);default:return console.warn(`Unknown frequency "${t}", defaulting to monthly`),a(r,1)}}function s(e){try{let t={principal:e.principal,annualInterestRate:e.annualInterestRate,repaymentType:e.repaymentType,numInstallments:e.numInstallments,paymentFrequency:e.paymentFrequency,loanStartMode:e.loanStartMode,loanStartDate:e.loanStartDate?new Date(e.loanStartDate):null,firstPaymentOffsetDays:e.firstPaymentOffsetDays,context:{preview:!e.loanStartDate,agreementStatus:"active",hasRealStartDate:!!e.loanStartDate}},r=function(e){let{repaymentType:t,numInstallments:r=1,loanStartMode:a,loanStartDate:s,context:o}=e,u="one_time"===t?1:r;if(!(o.hasRealStartDate&&s)&&"upon_acceptance"===a)return function(e,t){let r;let{principal:a,annualInterestRate:n,paymentFrequency:s,firstPaymentOffsetDays:o}=e,u=[],i=a,l=a/t;switch(s){case"every-3-days":r=3;break;case"every-week":case"weekly":r=7;break;case"every-month":case"monthly":default:r=30;break;case"every-year":case"yearly":r=365;break;case"once":r=o;break;case"biweekly":r=14;break;case"every_4_weeks":r=28;break;case"quarterly":r=91}let p=n/100/365,d=0;for(let e=1;e<=t;e++){let t=Math.round(i*p*(1===e?o:r)),a=Math.round(l)+t;(i-=l)<1&&(i=0),d+=t,u.push({index:e,date:null,dateLabel:function(e,t,r){let a=1===e;if("every-month"===t)return 1===e?"1 month after loan start":`${e} months after loan start`;if("every-year"===t)return 1===e?"1 year after loan start":`${e} years after loan start`;if("every-week"===t){let t=a?r:r+(e-1)*7;return 0===t?"On loan start":`${t} days after loan start`}if("every-3-days"===t){let t=a?r:r+(e-1)*3;return 0===t?"On loan start":`${t} days after loan start`}if("once"===t)return 0===r?"On loan start":`${r} days after loan start`;if("monthly"===t){let t=Math.round(r/30),n=a?t:t+(e-1);return 0===n?"On loan start":1===n?"1 month after loan start":`${n} months after loan start`}if("weekly"===t){let t=Math.round(r/7),n=a?t:t+(e-1);return 0===n?"On loan start":1===n?"1 week after loan start":`${n} weeks after loan start`}if("biweekly"===t){let t=Math.round(r/14),n=2*(a?t:t+(e-1));return 0===n?"On loan start":2===n?"2 weeks after loan start":`${n} weeks after loan start`}if("every_4_weeks"===t){let t=Math.round(r/28),n=4*(a?t:t+(e-1));return 0===n?"On loan start":4===n?"4 weeks after loan start":`${n} weeks after loan start`}if("quarterly"===t){let t=Math.round(r/90),n=3*(a?t:t+(e-1));return 0===n?"On loan start":3===n?"3 months after loan start":`${n} months after loan start`}if("yearly"===t){let t=Math.round(r/365),n=a?t:t+(e-1);return 0===n?"On loan start":1===n?"1 year after loan start":`${n} years after loan start`}if("custom_days"===t){let t=e*r;return 0===t?"On loan start":1===t?"1 day after loan start":`${t} days after loan start`}return a&&0===r?"On loan start":`Payment ${e}`}(e,s,o),principal:Math.round(l),interest:t,totalPayment:a,remainingBalance:Math.round(i)})}return{rows:u,totalInterest:Math.round(d),totalToRepay:Math.round(a+d)}}(e,u);if(!s)throw Error("loanStartDate is required when hasRealStartDate is true");return function(e,t,r){let{principal:a,annualInterestRate:s,paymentFrequency:o,firstPaymentOffsetDays:u}=e,i=new Date(r);i.setHours(0,0,0,0);let l=new Date(i);l.setDate(l.getDate()+u);let{paymentDates:p,normalizedFirstDueDate:d}=function(e){let{transferDate:t,firstDueDate:r,frequency:a,count:s}=e,o=function(e,t,r){let a=new Date(e),s=new Date(t);return(a.setHours(0,0,0,0),s.setHours(0,0,0,0),s<=a)?n(a,r):s}(t,r,a),u=[],i=new Date(o);for(let e=0;e<s;e++)u.push(new Date(i)),e<s-1&&(i=n(i,a));return{paymentDates:u,normalizedFirstDueDate:o}}({transferDate:i,firstDueDate:l,frequency:o,count:t}),_=function(e){let{principalCents:t,aprPercent:r,count:a,paymentDates:n,startDate:s}=e,o=t/100,u=r/100/365,i=o/a,l=0,p=[],d=new Date(s);d.setHours(0,0,0,0);for(let e=1;e<=a;e++){let t=o-i*(e-1),r=n[e-1],a=new Date(r);a.setHours(0,0,0,0);let s=t*u*Math.round((a.getTime()-d.getTime())/864e5),_=i+s,c=t-i;l+=s,p.push({dateISO:a.toISOString(),paymentCents:Math.round(100*_),principalCents:Math.round(100*i),interestCents:Math.round(100*s),remainingCents:c>.01?Math.round(100*c):0}),d=a}let _=Math.round(100*l);return{rows:p,totalInterestCents:_,totalToRepayCents:t+_}}({principalCents:a,aprPercent:s,count:t,paymentDates:p,startDate:i});return{rows:_.rows.map((e,t)=>({index:t+1,date:new Date(e.dateISO),dateLabel:function(e){if(!e)return"—";let t="string"==typeof e?new Date(e):e,r=t.getDate(),a=t.toLocaleDateString("en-GB",{month:"short"}),n=t.getFullYear();return`${r} ${a} ${n}`}(e.dateISO),principal:e.principalCents,interest:e.interestCents,totalPayment:e.paymentCents,remainingBalance:e.remainingCents})),totalInterest:_.totalInterestCents,totalToRepay:_.totalToRepayCents}}(e,u,s)}(t);return{rows:r.rows,totalInterest:r.totalInterest,totalToRepay:r.totalToRepay}}catch(e){return console.error("[Calculator] Calculation error:",e),null}}function o(e,t){let r=Math.abs(e.totalInterest-t.totalInterest),a=Math.abs(e.totalToRepay-t.totalToRepay);return{matches:r<=1&&a<=1,interestDiff:r,totalDiff:a}}function u(){return!0}r.d(t,{pB:()=>o,gn:()=>u,CP:()=>s})},5748:(e,t,r)=>{r.d(t,{Dx:()=>c,GA:()=>p,HJ:()=>O,HX:()=>N,Op:()=>I,Rf:()=>l,WP:()=>f,X_:()=>d,h8:()=>E,hW:()=>T,l$:()=>g,lE:()=>_,m2:()=>C,mg:()=>y,rY:()=>S,wD:()=>m,wV:()=>h,xl:()=>M,y6:()=>R});var a=r(5890),n=r.n(a),s=r(5315);let o=r.n(s)().join(process.cwd(),"..","data","payfriends.db"),u=null;function i(){return u||(u=new(n())(o,{readonly:!1})).pragma("journal_mode = WAL"),u}function l(e,t=50,r=0){let a=i(),n=`
    SELECT id, full_name, email, phone_number, created_at, public_id
    FROM users
  `,s=[];if(e){n+=" WHERE full_name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR CAST(id AS TEXT) = ?";let t=`%${e}%`;s.push(t,t,t,e)}return n+=" ORDER BY created_at DESC LIMIT ? OFFSET ?",s.push(t,r),a.prepare(n).all(...s)}function p(e){return i().prepare(`
    SELECT id, full_name, email, phone_number, created_at, public_id
    FROM users WHERE id = ?
  `).get(e)}function d(e){let t=i(),r=t.prepare(`
    SELECT COUNT(*) as count FROM agreements WHERE lender_user_id = ?
  `).get(e),a=t.prepare(`
    SELECT COUNT(*) as count FROM group_tabs WHERE creator_user_id = ?
  `).get(e);return{loansCreated:r?.count||0,grouptabsCreated:a?.count||0}}function _(e,t){b(t,"soft_disable_user","user",String(e),{action:"disabled"})}function c(e,t){b(t,"enable_user","user",String(e),{action:"enabled"})}function E(e,t,r=!0){let a=i(),n=a.prepare(`
    SELECT COUNT(*) as count FROM agreements WHERE lender_user_id = ? OR borrower_user_id = ?
  `).get(e,e),s=a.prepare(`
    SELECT COUNT(*) as count FROM group_tabs WHERE creator_user_id = ?
  `).get(e),o=(n?.count||0)>0||(s?.count||0)>0;return o&&!r?{success:!1,error:"User has financial history. Must anonymize instead of hard delete."}:(o?(a.prepare(`
      UPDATE users 
      SET full_name = '[Deleted User]', 
          email = 'deleted_' || id || '@deleted.local',
          phone_number = NULL
      WHERE id = ?
    `).run(e),b(t,"anonymize_user","user",String(e),{reason:"User had financial history",loans_count:n?.count||0,grouptabs_count:s?.count||0})):(a.prepare("DELETE FROM users WHERE id = ?").run(e),b(t,"delete_user","user",String(e),{hard_delete:!0})),{success:!0})}function m(e,t=50,r=0){let a=i(),n=`
    SELECT a.*,
           COALESCE(a.friend_first_name, b.full_name, a.borrower_email) as borrower_name
    FROM agreements a
    LEFT JOIN users b ON a.borrower_user_id = b.id
    WHERE 1=1
  `,s=[];return e?.status&&(n+=" AND a.status = ?",s.push(e.status)),e?.lenderId&&(n+=" AND a.lender_user_id = ?",s.push(e.lenderId)),e?.borrowerId&&(n+=" AND a.borrower_user_id = ?",s.push(e.borrowerId)),e?.dateFrom&&(n+=" AND a.created_at >= ?",s.push(e.dateFrom)),e?.dateTo&&(n+=" AND a.created_at <= ?",s.push(e.dateTo)),n+=" ORDER BY a.created_at DESC LIMIT ? OFFSET ?",s.push(t,r),a.prepare(n).all(...s)}function T(e){return i().prepare(`
    SELECT a.*,
           l.full_name as lender_display_name,
           COALESCE(a.friend_first_name, b.full_name, a.borrower_email) as borrower_name
    FROM agreements a
    LEFT JOIN users l ON a.lender_user_id = l.id
    LEFT JOIN users b ON a.borrower_user_id = b.id
    WHERE a.id = ?
  `).get(e)}function y(e){return i().prepare(`
    SELECT p.*, u.full_name as payer_name
    FROM payments p
    LEFT JOIN users u ON p.recorded_by_user_id = u.id
    WHERE p.agreement_id = ? 
    ORDER BY p.created_at DESC
  `).all(e)}function f(e,t=50,r=0){let a=i(),n=`
    SELECT g.*, u.full_name as creator_name
    FROM group_tabs g
    LEFT JOIN users u ON g.creator_user_id = u.id
    WHERE 1=1
  `,s=[];return e?.status&&(n+=" AND g.status = ?",s.push(e.status)),e?.type&&(n+=" AND g.tab_type = ?",s.push(e.type)),e?.creatorId&&(n+=" AND g.creator_user_id = ?",s.push(e.creatorId)),n+=" ORDER BY g.created_at DESC LIMIT ? OFFSET ?",s.push(t,r),a.prepare(n).all(...s)}function g(e){return i().prepare(`
    SELECT g.*, u.full_name as creator_name
    FROM group_tabs g
    LEFT JOIN users u ON g.creator_user_id = u.id
    WHERE g.id = ?
  `).get(e)}function O(e){return i().prepare(`
    SELECT gp.*, u.full_name as user_name
    FROM group_tab_participants gp
    LEFT JOIN users u ON gp.user_id = u.id
    WHERE gp.group_tab_id = ?
  `).all(e)}function R(e,t=50,r=0){let a=i(),n=[],s=[];if(!e?.entityType||"loan"===e.entityType){let t=`
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
      `;e?.status&&(t+=" AND gpr.status = ?",n.push(e.status)),s.push(t)}if(0===s.length)return[];let o=s.join(" UNION ALL "),u=`SELECT * FROM (${o}) ORDER BY created_at DESC LIMIT ? OFFSET ?`;return n.push(t,r),a.prepare(u).all(...n)}function h(e,t){b(t,"mark_reviewed","payment_report",String(e),{})}function L(){i().exec(`
    CREATE TABLE IF NOT EXISTS admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      note TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)}function S(e,t){return L(),i().prepare(`
    SELECT * FROM admin_notes 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `).all(e,String(t))}function N(e,t,r,a){L(),i().prepare(`
    INSERT INTO admin_notes (entity_type, entity_id, note, admin_id)
    VALUES (?, ?, ?, ?)
  `).run(e,String(t),r,a),b(a,"add_note",e,String(t),{note_preview:r.substring(0,100)})}function D(){i().exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)}function b(e,t,r,a,n){D(),i().prepare(`
    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(e,t,r,a,JSON.stringify(n))}function I(e=100,t=0){return D(),i().prepare(`
    SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(e,t)}function w(){i().exec(`
    CREATE TABLE IF NOT EXISTS remote_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'string',
      description TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)}function C(){return w(),i().prepare("SELECT * FROM remote_config ORDER BY key").all()}function M(e,t,r,a,n){w(),i().prepare(`
    INSERT OR REPLACE INTO remote_config (key, value, type, description, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(e,t,r,a),b(n,"update_config","remote_config",e,{value:t,type:r})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[276,972],()=>r(586));module.exports=a})();