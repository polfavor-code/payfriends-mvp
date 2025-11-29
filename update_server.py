
import sys

# Read the file
with open('server.js', 'r') as f:
    lines = f.readlines()

start_marker = -1
end_marker = -1

# Find markers
for i, line in enumerate(lines):
    if '// =============================================' in line and i+1 < len(lines) and '// GROUPTABS API ENDPOINTS' in lines[i+1]:
        start_marker = i
    if '// GroupTabs page (serves grouptabs.html)' in line:
        end_marker = i
        break

if start_marker == -1 or end_marker == -1:
    print("Markers not found")
    sys.exit(1)

# Define new content
new_content = """// =============================================
// GROUPTABS API ENDPOINTS (v1)
// =============================================

// Guest session middleware/helper
function getGuestParticipant(req, tabId) {
  const token = req.cookies.grouptab_guest_session;
  if (!token) return null;
  return db.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND magic_link_token = ?').get(tabId, token);
}

// Create new tab
app.post('/api/grouptabs', requireAuth, (req, res) => {
  const { title, type, config } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'Title and type required' });
  
  try {
    const createdAt = new Date().toISOString();
    const defaultConfig = config || (type === 'one_bill' ? { split_mode: 'equal' } : { receipt_required: true });
    
    const result = db.prepare(`
      INSERT INTO group_tabs (creator_user_id, title, type, status, config, created_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run(req.user.id, title, type, JSON.stringify(defaultConfig), createdAt);
    
    const tabId = result.lastInsertRowid;
    
    // Add creator
    db.prepare(`
      INSERT INTO group_tab_participants (group_tab_id, user_id, role, joined_at)
      VALUES (?, ?, 'organizer', ?)
    `).run(tabId, req.user.id, createdAt);
    
    res.status(201).json({ success: true, tab: { id: tabId, title, type } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create tab' });
  }
});

// List tabs
app.get('/api/grouptabs', requireAuth, (req, res) => {
  try {
    const tabs = db.prepare(`
      SELECT gt.*, (SELECT COUNT(*) FROM group_tab_participants WHERE group_tab_id = gt.id) as participant_count
      FROM group_tabs gt
      WHERE gt.id IN (SELECT group_tab_id FROM group_tab_participants WHERE user_id = ?)
      ORDER BY gt.created_at DESC
    `).all(req.user.id);
    
    const processed = tabs.map(t => ({ ...t, config: JSON.parse(t.config || '{}') }));
    res.json({ success: true, tabs: processed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list tabs' });
  }
});

// Get tab
app.get('/api/grouptabs/:id', (req, res) => {
  const tabId = parseInt(req.params.id);
  try {
    let participant = null;
    if (req.user) {
      participant = db.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?').get(tabId, req.user.id);
    } else {
      participant = getGuestParticipant(req, tabId);
    }
    
    // Allow viewing if not a participant (will be read-only or prompt to join)
    // Plan implies magic link required to join, but maybe public viewing?
    // "Trip tabs allow guest viewing but uploading expenses requires signup"
    // We'll verify access in frontend or add a generic check
    
    const tab = db.prepare('SELECT * FROM group_tabs WHERE id = ?').get(tabId);
    if (!tab) return res.status(404).json({ error: 'Tab not found' });
    
    const participants = db.prepare(`
      SELECT gtp.*, u.full_name, u.email, u.profile_picture
      FROM group_tab_participants gtp
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gtp.group_tab_id = ?
    `).all(tabId);
    
    const expenses = db.prepare(`
      SELECT gte.*, gtp.guest_name, u.full_name
      FROM group_tab_expenses gte
      JOIN group_tab_participants gtp ON gte.payer_participant_id = gtp.id
      LEFT JOIN users u ON gtp.user_id = u.id
      WHERE gte.group_tab_id = ?
      ORDER BY gte.date DESC
    `).all(tabId);
    
    const payments = db.prepare(`SELECT * FROM group_tab_payments WHERE group_tab_id = ?`).all(tabId);
    
    res.json({
      success: true,
      tab: { ...tab, config: JSON.parse(tab.config || '{}') },
      participants,
      expenses,
      payments,
      currentParticipant: participant
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching tab' });
  }
});

// Join
app.post('/api/grouptabs/:id/join', (req, res) => {
  const tabId = parseInt(req.params.id);
  const { name, token } = req.body;
  
  try {
    const tab = db.prepare('SELECT * FROM group_tabs WHERE id = ?').get(tabId);
    if (!tab) return res.status(404).json({ error: 'Tab not found' });
    
    if (req.user) {
      const existing = db.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?').get(tabId, req.user.id);
      if (existing) return res.json({ success: true, participant: existing });
      
      const resJoin = db.prepare(`INSERT INTO group_tab_participants (group_tab_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`)
        .run(tabId, req.user.id, new Date().toISOString());
      return res.json({ success: true, participantId: resJoin.lastInsertRowid });
    }
    
    if (token) {
      // Reclaim
      const existing = db.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ? AND magic_link_token = ?').get(tabId, token);
      if (!existing) return res.status(404).json({ error: 'Invalid token' });
      res.cookie('grouptab_guest_session', token, { httpOnly: true, maxAge: 30 * 86400000 });
      return res.json({ success: true, participant: existing });
    }
    
    if (!name) return res.status(400).json({ error: 'Name required' });
    const newToken = crypto.randomBytes(16).toString('hex');
    const resNew = db.prepare(`INSERT INTO group_tab_participants (group_tab_id, guest_name, role, joined_at, magic_link_token) VALUES (?, ?, 'guest', ?, ?)`)
      .run(tabId, name, new Date().toISOString(), newToken);
      
    res.cookie('grouptab_guest_session', newToken, { httpOnly: true, maxAge: 30 * 86400000 });
    res.json({ success: true, participantId: resNew.lastInsertRowid, token: newToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Join failed' });
  }
});

// Add Expense
app.post('/api/grouptabs/:id/expenses', uploadGrouptabs.single('receipt'), (req, res) => {
  const tabId = parseInt(req.params.id);
  const { description, amountCents } = req.body;
  
  try {
    let participantId;
    if (req.user) {
      const p = db.prepare('SELECT id FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?').get(tabId, req.user.id);
      if(!p) return res.status(403).json({error:'Not participant'});
      participantId = p.id;
    } else {
      return res.status(403).json({error:'Must be logged in'});
    }
    
    db.prepare(`INSERT INTO group_tab_expenses (group_tab_id, payer_participant_id, description, amount_cents, date, receipt_file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(tabId, participantId, description, amountCents, new Date().toISOString(), req.file ? req.file.path : null, new Date().toISOString());
    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({error: 'Failed'});
  }
});

// Add Payment
app.post('/api/grouptabs/:id/payments', uploadGrouptabs.single('proof'), (req, res) => {
  const tabId = parseInt(req.params.id);
  const { toParticipantId, amountCents } = req.body;
  
  try {
    let fromId;
    if (req.user) {
       const p = db.prepare('SELECT id FROM group_tab_participants WHERE group_tab_id = ? AND user_id = ?').get(tabId, req.user.id);
       if(!p) return res.status(403).json({error:'Not participant'});
       fromId = p.id;
    } else {
       const p = getGuestParticipant(req, tabId);
       if(!p) return res.status(403).json({error:'Not participant'});
       fromId = p.id;
    }
    
    db.prepare(`INSERT INTO group_tab_payments (group_tab_id, from_participant_id, to_participant_id, amount_cents, proof_file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(tabId, fromId, toParticipantId, amountCents, req.file ? req.file.path : null, new Date().toISOString());
      
    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({error: 'Failed'});
  }
});

// Settlement
app.get('/api/grouptabs/:id/settlement', (req, res) => {
  const tabId = parseInt(req.params.id);
  try {
    const participants = db.prepare('SELECT * FROM group_tab_participants WHERE group_tab_id = ?').all(tabId);
    const expenses = db.prepare('SELECT * FROM group_tab_expenses WHERE group_tab_id = ?').all(tabId);
    const payments = db.prepare('SELECT * FROM group_tab_payments WHERE group_tab_id = ?').all(tabId);
    
    const totalExpenses = expenses.reduce((s,e) => s + e.amount_cents, 0);
    const fairShare = participants.length ? totalExpenses / participants.length : 0;
    
    const balances = participants.map(p => {
      const paid = expenses.filter(e => e.payer_participant_id === p.id).reduce((s,e) => s + e.amount_cents, 0) +
                   payments.filter(pm => pm.from_participant_id === p.id).reduce((s,pm) => s + pm.amount_cents, 0) -
                   payments.filter(pm => pm.to_participant_id === p.id).reduce((s,pm) => s + pm.amount_cents, 0);
      return { ...p, balance: paid - fairShare };
    });
    
    const debtors = balances.filter(b => b.balance < -10).sort((a,b) => a.balance - b.balance);
    const creditors = balances.filter(b => b.balance > 10).sort((a,b) => b.balance - a.balance);
    const suggestions = [];
    
    let d=0, c=0;
    while(d < debtors.length && c < creditors.length) {
       let debtor = debtors[d];
       let creditor = creditors[c];
       let amount = Math.min(Math.abs(debtor.balance), creditor.balance);
       suggestions.push({ from: debtor.guest_name || debtor.id, to: creditor.guest_name || creditor.id, amount });
       debtor.balance += amount;
       creditor.balance -= amount;
       if(Math.abs(debtor.balance) < 10) d++;
       if(creditor.balance < 10) c++;
    }
    
    res.json({ success: true, suggestions, balances });
  } catch(err) {
    console.error(err);
    res.status(500).json({error: 'Calc failed'});
  }
});

// Magic Link / Join Page
app.get('/grouptabs/join/:token', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'grouptabs.html'));
});

app.get('/grouptabs/create', (req, res) => {
   if(req.user) res.sendFile(path.join(__dirname, 'public', 'grouptabs.html'));
   else res.redirect('/');
});

"""

# Construct output
final_lines = lines[:start_marker] + [new_content] + lines[end_marker:]

with open('server.js', 'w') as f:
    f.writelines(final_lines)

