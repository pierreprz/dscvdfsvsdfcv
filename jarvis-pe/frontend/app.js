/* ============================================================
   JARVIS PE ASSISTANT — app.js
   Reconnaissance vocale, chat IA, gestion élèves, stats
   ============================================================ */

const API = ''  // même origine
let chatHistory = []
let students = []
let selectedStudentId = null
let recognition = null
let isListening = false
let unlockRecognition = null

// ──────────────────────────────────────────────
// DÉVERROUILLAGE VOCAL
// ──────────────────────────────────────────────

function startUnlock() {
  const btn = document.getElementById('btnUnlock')
  const status = document.getElementById('lockStatus')
  const wave = document.getElementById('lockWave')

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    status.textContent = '⚠️ Reconnaissance vocale non supportée. Utilisez Chrome.'
    return
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  unlockRecognition = new SR()
  unlockRecognition.lang = 'fr-FR'
  unlockRecognition.interimResults = false
  unlockRecognition.maxAlternatives = 5

  btn.classList.add('listening')
  btn.querySelector('span:last-child').textContent = 'Écoute en cours...'
  wave.style.display = 'flex'
  status.textContent = 'Prononcez votre code vocal...'

  unlockRecognition.onresult = async (e) => {
    const transcripts = Array.from(e.results[0]).map(r => r.transcript)
    status.textContent = `Analyse: "${transcripts[0]}"…`

    for (const t of transcripts) {
      try {
        const res = await fetch(`${API}/api/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcription: t })
        })
        const data = await res.json()
        if (data.success) {
          unlockSuccess(data.message)
          return
        }
      } catch (err) { /* continue */ }
    }
    unlockFail()
  }

  unlockRecognition.onerror = () => unlockFail()
  unlockRecognition.onend = () => {
    btn.classList.remove('listening')
    btn.querySelector('span:last-child').textContent = 'Activer la reconnaissance vocale'
    wave.style.display = 'none'
  }

  unlockRecognition.start()
}

function unlockSuccess(message) {
  const status = document.getElementById('lockStatus')
  status.style.color = 'var(--success)'
  status.textContent = '✓ ' + message
  speak(message)
  setTimeout(() => {
    document.getElementById('lock-screen').style.display = 'none'
    document.getElementById('app').style.display = 'flex'
    document.getElementById('app').style.flexDirection = 'column'
    loadStudents()
  }, 1200)
}

function unlockFail() {
  const status = document.getElementById('lockStatus')
  status.style.color = 'var(--danger)'
  status.textContent = '✗ Code incorrect. Veuillez réessayer.'
  speak('Code non reconnu. Veuillez réessayer.')
  setTimeout(() => {
    status.textContent = 'Prononcez votre code vocal pour accéder au système'
    status.style.color = 'var(--cyan)'
  }, 3000)
}

function lockSystem() {
  stopVoiceInput()
  document.getElementById('app').style.display = 'none'
  document.getElementById('lock-screen').style.display = 'flex'
  document.getElementById('lockStatus').textContent = ''
}

// ──────────────────────────────────────────────
// SYNTHÈSE VOCALE (TEXT TO SPEECH)
// ──────────────────────────────────────────────

function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  // Nettoyage du texte (supprimer emojis et markdown)
  const clean = text.replace(/[#*`_~\[\]()]/g, '').replace(/[^\p{L}\p{N}\s.,!?;:-]/gu, '').trim()
  const utter = new SpeechSynthesisUtterance(clean)
  utter.lang = 'fr-FR'
  utter.rate = 1.0
  utter.pitch = 0.85  // voix légèrement grave = style Jarvis
  utter.volume = 1.0

  // Cherche une voix française
  const voices = window.speechSynthesis.getVoices()
  const frVoice = voices.find(v => v.lang.startsWith('fr') && v.name.toLowerCase().includes('thomas'))
    || voices.find(v => v.lang.startsWith('fr'))
  if (frVoice) utter.voice = frVoice

  window.speechSynthesis.speak(utter)
}

// Charger les voix dès que disponibles
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}

// ──────────────────────────────────────────────
// CHAT JARVIS
// ──────────────────────────────────────────────

function addMessage(role, text) {
  const msgs = document.getElementById('chatMessages')
  const div = document.createElement('div')
  div.className = `msg ${role}`
  const avatar = role === 'jarvis' ? 'J' : 'P'
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-bubble">${text.replace(/\n/g, '<br>')}</div>
  `
  msgs.appendChild(div)
  msgs.scrollTop = msgs.scrollHeight
  return div
}

function addThinking() {
  const msgs = document.getElementById('chatMessages')
  const div = document.createElement('div')
  div.className = 'msg jarvis thinking'
  div.id = 'thinkingMsg'
  div.innerHTML = `
    <div class="msg-avatar">J</div>
    <div class="msg-bubble">
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `
  msgs.appendChild(div)
  msgs.scrollTop = msgs.scrollHeight
}

function removeThinking() {
  const el = document.getElementById('thinkingMsg')
  if (el) el.remove()
}

async function sendMessage() {
  const input = document.getElementById('chatInput')
  const text = input.value.trim()
  if (!text) return

  input.value = ''
  addMessage('user', text)
  chatHistory.push({ role: 'user', content: text })
  addThinking()

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory.slice(-10) })
    })
    const data = await res.json()
    removeThinking()

    if (res.ok) {
      const reply = data.response
      addMessage('jarvis', reply)
      chatHistory.push({ role: 'assistant', content: reply })
      speak(reply)
    } else {
      const errMsg = data.detail || 'Erreur de connexion au serveur.'
      addMessage('jarvis', '⚠️ ' + errMsg)
    }
  } catch (err) {
    removeThinking()
    addMessage('jarvis', '⚠️ Impossible de joindre le serveur. Vérifiez que le backend est lancé.')
  }
}

// ──────────────────────────────────────────────
// ENTRÉE VOCALE (CHAT)
// ──────────────────────────────────────────────

function toggleVoiceInput() {
  if (isListening) stopVoiceInput()
  else startVoiceInput()
}

function startVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    addMessage('jarvis', 'La reconnaissance vocale n\'est pas supportée. Utilisez Chrome.')
    return
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SR()
  recognition.lang = 'fr-FR'
  recognition.interimResults = false
  recognition.continuous = false

  recognition.onstart = () => {
    isListening = true
    document.getElementById('btnMic').classList.add('active')
    document.getElementById('voiceViz').style.display = 'flex'
  }

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript
    document.getElementById('chatInput').value = transcript
    stopVoiceInput()
    sendMessage()
  }

  recognition.onerror = () => stopVoiceInput()
  recognition.onend = () => stopVoiceInput()

  window.speechSynthesis.cancel()  // stoppe la réponse en cours
  recognition.start()
}

function stopVoiceInput() {
  isListening = false
  document.getElementById('btnMic').classList.remove('active')
  document.getElementById('voiceViz').style.display = 'none'
  if (recognition) { try { recognition.stop() } catch(e){} recognition = null }
}

// Raccourci espace = micro
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault()
    toggleVoiceInput()
  }
})

// ──────────────────────────────────────────────
// ONGLETS
// ──────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none')
  document.getElementById(`tab-${name}`).classList.add('active')
  document.getElementById(`view-${name}`).style.display = 'flex'
  document.getElementById(`view-${name}`).style.flexDirection = name === 'chat' ? 'column' : ''
  if (name === 'students') loadStudents()
  if (name === 'stats') loadStats()
}

// ──────────────────────────────────────────────
// ÉLÈVES — LISTE
// ──────────────────────────────────────────────

async function loadStudents() {
  try {
    const res = await fetch(`${API}/api/students`)
    students = await res.json()
    renderStudentList(students)
    updateClassFilter(students)
  } catch {
    document.getElementById('studentList').innerHTML = '<p style="padding:16px;color:var(--danger)">Erreur de chargement</p>'
  }
}

function updateClassFilter(list) {
  const sel = document.getElementById('filterClasse')
  const current = sel.value
  const classes = [...new Set(list.map(s => s.classe))].sort()
  sel.innerHTML = '<option value="">Toutes les classes</option>'
  classes.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c; opt.textContent = c
    if (c === current) opt.selected = true
    sel.appendChild(opt)
  })
}

function filterStudents() {
  const search = document.getElementById('searchStudent').value.toLowerCase()
  const classe = document.getElementById('filterClasse').value
  const filtered = students.filter(s => {
    const name = `${s.prenom} ${s.nom}`.toLowerCase()
    return (!classe || s.classe === classe) && (!search || name.includes(search))
  })
  renderStudentList(filtered)
}

function renderStudentList(list) {
  const container = document.getElementById('studentList')
  if (!list.length) {
    container.innerHTML = '<p style="padding:16px;color:var(--text-dim)">Aucun élève trouvé.</p>'
    return
  }
  container.innerHTML = list.map(s => {
    const selected = s.id === selectedStudentId ? 'selected' : ''
    const moyBadge = s.moyenne !== null
      ? `<span class="badge moy">${s.moyenne}/20</span>`
      : ''
    const absBadge = s.absences_total > 0
      ? `<span class="badge abs">${s.absences_total} abs.</span>`
      : `<span class="badge ok">0 abs.</span>`
    return `
      <div class="student-item ${selected}" onclick="selectStudent(${s.id})">
        <div>
          <div class="student-name">${s.prenom} ${s.nom}</div>
          <div class="student-meta">${s.classe}</div>
        </div>
        <div class="student-badge">${moyBadge}${absBadge}</div>
      </div>`
  }).join('')
}

// ──────────────────────────────────────────────
// ÉLÈVES — DÉTAIL
// ──────────────────────────────────────────────

async function selectStudent(id) {
  selectedStudentId = id
  document.querySelectorAll('.student-item').forEach(el => el.classList.remove('selected'))
  document.querySelectorAll('.student-item').forEach(el => {
    if (el.onclick.toString().includes(`(${id})`)) el.classList.add('selected')
  })
  filterStudents()  // re-render pour afficher selected

  try {
    const res = await fetch(`${API}/api/students/${id}`)
    const s = await res.json()
    renderStudentDetail(s)
  } catch {
    document.getElementById('studentDetail').innerHTML = '<p style="padding:16px;color:var(--danger)">Erreur</p>'
  }
}

function renderStudentDetail(s) {
  const moyVal = s.grades.length
    ? (s.grades.reduce((acc, g) => acc + g.note / g.note_max * 20, 0) / s.grades.length).toFixed(1)
    : '—'
  const absTotal = s.absences.length
  const absInjust = s.absences.filter(a => !a.justifiee).length

  const moyClass = moyVal !== '—' && parseFloat(moyVal) < 10 ? 'danger' : 'success'
  const absClass = absTotal > 5 ? 'danger' : absTotal > 2 ? '' : 'success'

  const gradesHTML = s.grades.length
    ? s.grades.map(g => {
        const sur20 = (g.note / g.note_max * 20).toFixed(1)
        const low = parseFloat(sur20) < 10 ? 'low' : ''
        return `<div class="grade-item">
          <div>
            <div class="grade-activity">${g.activite}</div>
            <div class="grade-comment">${g.date}${g.commentaire ? ' — ' + g.commentaire : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="grade-score ${low}">${g.note}/${g.note_max} <small>(${sur20}/20)</small></span>
            <button class="btn-del" onclick="deleteGrade(${g.id}, ${s.id})" title="Supprimer">×</button>
          </div>
        </div>`
      }).join('')
    : '<p style="color:var(--text-dim);font-size:0.85rem">Aucune note enregistrée.</p>'

  const absencesHTML = s.absences.length
    ? s.absences.map(a => {
        const cls = a.justifiee ? 'justif' : 'injustif'
        const label = a.justifiee ? 'Justifiée' : 'Non justifiée'
        return `<div class="absence-item">
          <div>
            <div class="absence-date">${a.date}</div>
            ${a.commentaire ? `<div class="grade-comment">${a.commentaire}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="absence-status ${cls}">${label}</span>
            <button class="btn-del" onclick="deleteAbsence(${a.id}, ${s.id})" title="Supprimer">×</button>
          </div>
        </div>`
      }).join('')
    : '<p style="color:var(--text-dim);font-size:0.85rem">Aucune absence enregistrée.</p>'

  document.getElementById('studentDetail').innerHTML = `
    <div class="detail-content">
      <div class="detail-header">
        <div>
          <div class="detail-name">${s.prenom} ${s.nom}</div>
          <div class="detail-classe">${s.classe}${s.date_naissance ? ' • Né(e) le ' + s.date_naissance : ''}</div>
          ${s.notes ? `<div style="font-size:0.8rem;color:var(--text-dim);margin-top:6px">${s.notes}</div>` : ''}
        </div>
        <div class="detail-actions">
          <button class="btn-sm btn-edit" onclick="openEditStudent(${s.id})">Modifier</button>
          <button class="btn-sm btn-danger" onclick="deleteStudent(${s.id})">Supprimer</button>
        </div>
      </div>

      <div class="detail-stats">
        <div class="stat-card">
          <div class="stat-value ${moyClass}">${moyVal}</div>
          <div class="stat-label">MOYENNE /20</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${absClass}">${absTotal}</div>
          <div class="stat-label">ABSENCES</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${absInjust > 0 ? 'danger' : 'success'}">${absInjust}</div>
          <div class="stat-label">NON JUSTIF.</div>
        </div>
      </div>

      <div class="section-title">
        NOTES
        <button class="btn-sm btn-edit" onclick="openAddGrade(${s.id})">+ Note</button>
      </div>
      <div class="grade-list">${gradesHTML}</div>

      <div class="section-title">
        ABSENCES
        <button class="btn-sm btn-edit" onclick="openAddAbsence(${s.id})">+ Absence</button>
      </div>
      <div class="absence-list">${absencesHTML}</div>
    </div>
  `
}

// ──────────────────────────────────────────────
// MODALS — ÉLÈVE
// ──────────────────────────────────────────────

function openAddStudent() {
  document.getElementById('modalTitle').textContent = 'Ajouter un élève'
  document.getElementById('sId').value = ''
  document.getElementById('sPrenom').value = ''
  document.getElementById('sNom').value = ''
  document.getElementById('sClasse').value = ''
  document.getElementById('sDateNaissance').value = ''
  document.getElementById('sNotes').value = ''
  document.getElementById('modalStudent').style.display = 'flex'
}

async function openEditStudent(id) {
  const s = students.find(x => x.id === id)
  if (!s) return
  document.getElementById('modalTitle').textContent = 'Modifier l\'élève'
  document.getElementById('sId').value = s.id
  document.getElementById('sPrenom').value = s.prenom
  document.getElementById('sNom').value = s.nom
  document.getElementById('sClasse').value = s.classe
  document.getElementById('sDateNaissance').value = s.date_naissance || ''
  document.getElementById('sNotes').value = s.notes || ''
  document.getElementById('modalStudent').style.display = 'flex'
}

async function saveStudent(e) {
  e.preventDefault()
  const id = document.getElementById('sId').value
  const body = {
    prenom: document.getElementById('sPrenom').value,
    nom: document.getElementById('sNom').value,
    classe: document.getElementById('sClasse').value,
    date_naissance: document.getElementById('sDateNaissance').value || null,
    notes: document.getElementById('sNotes').value || null,
  }
  const url = id ? `${API}/api/students/${id}` : `${API}/api/students`
  const method = id ? 'PUT' : 'POST'
  await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
  closeModal('modalStudent')
  await loadStudents()
  if (id) selectStudent(parseInt(id))
}

async function deleteStudent(id) {
  if (!confirm('Supprimer cet élève ?')) return
  await fetch(`${API}/api/students/${id}`, { method: 'DELETE' })
  selectedStudentId = null
  document.getElementById('studentDetail').innerHTML = `
    <div class="detail-placeholder">
      <div class="placeholder-icon">👨‍🎓</div>
      <p>Sélectionnez un élève pour voir ses détails</p>
    </div>`
  await loadStudents()
}

// ──────────────────────────────────────────────
// MODALS — NOTES
// ──────────────────────────────────────────────

function openAddGrade(studentId) {
  document.getElementById('gStudentId').value = studentId
  document.getElementById('gActivite').value = ''
  document.getElementById('gNote').value = ''
  document.getElementById('gNoteMax').value = '20'
  document.getElementById('gDate').value = new Date().toISOString().split('T')[0]
  document.getElementById('gCommentaire').value = ''
  document.getElementById('modalGrade').style.display = 'flex'
}

async function saveGrade(e) {
  e.preventDefault()
  const body = {
    student_id: parseInt(document.getElementById('gStudentId').value),
    activite: document.getElementById('gActivite').value,
    note: parseFloat(document.getElementById('gNote').value),
    note_max: parseFloat(document.getElementById('gNoteMax').value),
    date: document.getElementById('gDate').value,
    commentaire: document.getElementById('gCommentaire').value || null,
  }
  await fetch(`${API}/api/grades`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
  closeModal('modalGrade')
  await loadStudents()
  selectStudent(body.student_id)
}

async function deleteGrade(gradeId, studentId) {
  if (!confirm('Supprimer cette note ?')) return
  await fetch(`${API}/api/grades/${gradeId}`, { method: 'DELETE' })
  await loadStudents()
  selectStudent(studentId)
}

// ──────────────────────────────────────────────
// MODALS — ABSENCES
// ──────────────────────────────────────────────

function openAddAbsence(studentId) {
  document.getElementById('aStudentId').value = studentId
  document.getElementById('aDate').value = new Date().toISOString().split('T')[0]
  document.getElementById('aJustifiee').checked = false
  document.getElementById('aCommentaire').value = ''
  document.getElementById('modalAbsence').style.display = 'flex'
}

async function saveAbsence(e) {
  e.preventDefault()
  const body = {
    student_id: parseInt(document.getElementById('aStudentId').value),
    date: document.getElementById('aDate').value,
    justifiee: document.getElementById('aJustifiee').checked,
    commentaire: document.getElementById('aCommentaire').value || null,
  }
  await fetch(`${API}/api/absences`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
  closeModal('modalAbsence')
  await loadStudents()
  selectStudent(body.student_id)
}

async function deleteAbsence(absenceId, studentId) {
  if (!confirm('Supprimer cette absence ?')) return
  await fetch(`${API}/api/absences/${absenceId}`, { method: 'DELETE' })
  await loadStudents()
  selectStudent(studentId)
}

// ──────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────

async function loadStats() {
  const container = document.getElementById('statsContainer')
  try {
    const [statsRes, studentsRes] = await Promise.all([
      fetch(`${API}/api/stats`),
      fetch(`${API}/api/students`)
    ])
    const stats = await statsRes.json()
    const allStudents = await studentsRes.json()

    if (!stats.length) {
      container.innerHTML = '<p style="color:var(--text-dim);padding:24px">Aucune donnée. Ajoutez des élèves d\'abord.</p>'
      return
    }

    // Top/Flop global
    const withGrades = allStudents.filter(s => s.moyenne !== null)
    const top3 = [...withGrades].sort((a,b) => b.moyenne - a.moyenne).slice(0, 3)
    const flop3 = [...withGrades].sort((a,b) => a.moyenne - b.moyenne).slice(0, 3)
    const mostAbsent = [...allStudents].sort((a,b) => b.absences_total - a.absences_total).slice(0, 5).filter(s => s.absences_total > 0)

    container.innerHTML = `
      <h2 style="font-family:var(--font-hud);font-size:0.9rem;color:var(--cyan);letter-spacing:0.15rem;margin-bottom:20px">
        TABLEAU DE BORD — ${new Date().toLocaleDateString('fr-FR')}
      </h2>
      <div class="stats-grid">
        ${stats.map(c => `
          <div class="stats-card">
            <div class="stats-card-title">🏫 CLASSE ${c.classe}</div>
            <div class="stats-row"><span class="stats-key">Élèves</span><span class="stats-val">${c.nb_eleves}</span></div>
            <div class="stats-row"><span class="stats-key">Absences totales</span><span class="stats-val" style="color:${c.total_absences > 10 ? 'var(--danger)' : 'var(--text)'}">${c.total_absences}</span></div>
            <div class="stats-row"><span class="stats-key">Moyenne de classe</span><span class="stats-val" style="color:${c.moyenne_classe < 10 ? 'var(--danger)' : 'var(--success)'}">${c.moyenne_classe !== null ? c.moyenne_classe + '/20' : '—'}</span></div>
            ${c.eleves_en_difficulte.length ? `
              <div style="margin-top:10px">
                <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:6px">⚠️ EN DIFFICULTÉ</div>
                <div class="difficulte-list">${c.eleves_en_difficulte.map(n => `<div class="difficulte-item">${n}</div>`).join('')}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}

        ${top3.length ? `
          <div class="stats-card">
            <div class="stats-card-title">🏆 TOP PERFORMANCES</div>
            ${top3.map((s, i) => `
              <div class="stats-row">
                <span class="stats-key">${['1️⃣','2️⃣','3️⃣'][i]} ${s.prenom} ${s.nom} <small style="color:var(--text-dim)">(${s.classe})</small></span>
                <span class="stats-val" style="color:var(--success)">${s.moyenne}/20</span>
              </div>`).join('')}
          </div>` : ''}

        ${flop3.length ? `
          <div class="stats-card">
            <div class="stats-card-title">📉 À SURVEILLER</div>
            ${flop3.map(s => `
              <div class="stats-row">
                <span class="stats-key">${s.prenom} ${s.nom} <small style="color:var(--text-dim)">(${s.classe})</small></span>
                <span class="stats-val" style="color:${s.moyenne < 10 ? 'var(--danger)' : 'var(--warning)'}">${s.moyenne}/20</span>
              </div>`).join('')}
          </div>` : ''}

        ${mostAbsent.length ? `
          <div class="stats-card">
            <div class="stats-card-title">🗓️ ABSENCES FRÉQUENTES</div>
            ${mostAbsent.map(s => `
              <div class="stats-row">
                <span class="stats-key">${s.prenom} ${s.nom} <small style="color:var(--text-dim)">(${s.classe})</small></span>
                <span class="stats-val" style="color:var(--danger)">${s.absences_total} abs.</span>
              </div>`).join('')}
          </div>` : ''}
      </div>
    `
  } catch {
    container.innerHTML = '<p style="color:var(--danger);padding:24px">Erreur de chargement des statistiques.</p>'
  }
}

// ──────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────

function closeModal(id) {
  document.getElementById(id).style.display = 'none'
}

// Fermer les modals en cliquant en dehors
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none'
  }
})
