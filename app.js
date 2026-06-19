var LS = 'suivi_omr_v2';
var LS_AJUST = 'suivi_omr_crh_ajust';
var CODE_ADMIN = '2403';
var CODE_RECHERCHE = 'RECHERCHE';
var appMode = null;
var editingId = null;
var modalMode = 'new';
var addingMissionId = null;
var rows = [];

function isAdmin() { return appMode === 'admin'; }
function isReadOnly() { return appMode === 'recherche'; }

function checkAccessCode(code) {
  var raw = String(code || '').trim();
  if (raw === CODE_ADMIN) return 'admin';
  if (raw.toUpperCase() === CODE_RECHERCHE) return 'recherche';
  return null;
}

function setAccessMode(mode) {
  appMode = mode;
}

function clearAccessMode() {
  appMode = null;
}

function applyAccessMode() {
  document.body.classList.toggle('MODE-ADMIN', isAdmin());
  document.body.classList.toggle('MODE-RECHERCHE', isReadOnly());

  ['BTN-AJOUTER', 'BTN-AJUST', 'BTN-CRH', 'BTN-CRH-XLS'].forEach(function (id) {
    var el = $(id);
    if (el) el.classList.toggle('hidden', isReadOnly());
  });

  var hdrCrh = document.querySelector('.HDR-CRH');
  if (hdrCrh && hdrCrh.parentElement) {
    hdrCrh.classList.toggle('hidden', isReadOnly());
  }

  var search = $('SEARCH');
  if (search) {
    search.placeholder = isReadOnly()
      ? 'Rechercher par nom prénom…'
      : 'Rechercher par nom, lieu, date, N° OMR, code imputation…';
  }

  var sub = document.querySelector('.HDR-SUB');
  if (sub) {
    sub.textContent = isReadOnly()
      ? 'Consultation échelon — recherche par nom uniquement'
      : 'Saisie manuelle · plusieurs personnes par mission · recherche';
  }

  var badge = $('MODE-BADGE');
  if (badge) {
    if (isReadOnly()) {
      badge.textContent = 'Mode consultation';
      badge.className = 'MODE-BADGE MODE-BADGE-RO';
    } else if (isAdmin()) {
      badge.textContent = 'Mode bureau';
      badge.className = 'MODE-BADGE MODE-BADGE-ADM';
    }
    badge.classList.toggle('hidden', !appMode);
  }

  var vide = $('VIDE');
  if (vide) {
    vide.textContent = isReadOnly()
      ? 'Aucun missionnaire ne correspond à la recherche.'
      : 'Aucune ligne — cliquez sur « Ajouter une mission ».';
  }
}

function showAccessModal() {
  document.body.classList.add('ACCESS-LOCKED');
  var m = $('MODAL-ACCESS');
  if (m) m.classList.remove('hidden');
  var inp = $('INP-ACCESS');
  if (inp) {
    inp.value = '';
    setTimeout(function () { inp.focus(); }, 50);
  }
}

function hideAccessModal() {
  document.body.classList.remove('ACCESS-LOCKED');
  var m = $('MODAL-ACCESS');
  if (m) m.classList.add('hidden');
}

function submitAccess(e) {
  e.preventDefault();
  var mode = checkAccessCode($('INP-ACCESS').value);
  if (!mode) {
    msg('Code incorrect.', 'err');
    return;
  }
  setAccessMode(mode);
  hideAccessModal();
  applyAccessMode();
  load();
  initAmountAbtButtons();
  render();
}

function bootApp() {
  try { sessionStorage.removeItem('suivi_omr_access_mode'); } catch (e) {}
  showAccessModal();
}

var CODES_INTERNES = ['FDYDDR4FCT', 'FDYDDR4FRM'];

var AMOUNTS = [
  { key: 'repas', label: 'Repas', short: 'Repas' },
  { key: 'hebergement', label: 'Hébergement', short: 'Héb.' },
  { key: 'sncf', label: 'SNCF', short: 'SNCF' },
  { key: 'transportCommun', label: 'Transport en commun', short: 'T.C.' },
  { key: 'bateau', label: 'Bateau', short: 'Bat.' },
  { key: 'avion', label: 'Avion', short: 'Av.' },
  { key: 'indemniteKm', label: 'Indemnité kilométrique', short: 'I.K.' },
  { key: 'divers', label: 'Divers', short: 'Div.' }
];

var CHECKS = [
  { key: 'demandeOmr', label: 'Demande OMR', short: 'Dem. OMR' },
  { key: 'omValide', label: 'OM validé', short: 'OM validé' },
  { key: 'retourOm', label: 'Retour OM', short: 'Retour OM' },
  { key: 'omLiquider', label: 'OM liquider', short: 'Liquider' }
];

function $(id) { return document.getElementById(id); }
function uid() { return 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }
function rowUid() { return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function normCode(c) {
  return String(c || '').trim().toUpperCase().replace(/\s/g, '');
}

function isCodeInterne(code) {
  return CODES_INTERNES.indexOf(normCode(code)) >= 0;
}

function codeCellClass(code) {
  if (!normCode(code)) return '';
  return isCodeInterne(code) ? ' CODE-INT' : ' CODE-EXT';
}

var ABT_KEYS = ['hebergement', 'sncf', 'bateau', 'avion', 'divers'];

function canAbt(key) {
  return ABT_KEYS.indexOf(key) >= 0;
}

function isAbt(v) {
  return String(v || '').trim().toUpperCase() === 'ABT';
}

function normAmountValue(v, key) {
  var s = String(v || '').trim();
  if (canAbt(key) && s.toUpperCase() === 'ABT') return 'ABT';
  return s;
}

function parseMontant(v) {
  if (isAbt(v)) return 0;
  if (!v) return 0;
  var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function fmtCrhAmount(stats, key) {
  var n = stats.totals[key] || 0;
  var abt = (stats.abtCounts && stats.abtCounts[key]) || 0;
  if (abt > 0 && n > 0) return fmtMontantPdf(n) + ' + ' + abt + ' ABT';
  if (abt > 0) return abt + ' ABT';
  return fmtMontantPdf(n);
}

function fmtMontant(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function normNumeroOm(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return String(parseInt(s, 10)).padStart(4, '0');
  return s;
}

function rowTotal(r) {
  var t = 0;
  AMOUNTS.forEach(function (a) { t += parseMontant(r[a.key]); });
  return t;
}

function missionKey(r) {
  return r.missionId || r.id;
}

function emptyRow() {
  var id = rowUid();
  return {
    id: id,
    missionId: uid(),
    numeroOm: '',
    grade: '',
    nomPrenom: '',
    objet: '',
    lieu: '',
    dateDebut: '',
    dateFin: '',
    codeImputation: '',
    demandeOmr: false,
    omValide: false,
    retourOm: false,
    omLiquider: false,
    repas: '',
    hebergement: '',
    sncf: '',
    transportCommun: '',
    bateau: '',
    avion: '',
    indemniteKm: '',
    divers: ''
  };
}

function load() {
  try {
    rows = JSON.parse(localStorage.getItem(LS) || '[]');
  } catch (e) {
    rows = [];
  }
  var changed = false;
  rows.forEach(function (r) {
    if (!r.missionId) r.missionId = r.id;
    if (!r.codeImputation && r.codeFd) r.codeImputation = r.codeFd;
    CHECKS.forEach(function (c) {
      if (r[c.key] == null) r[c.key] = false;
    });
    AMOUNTS.forEach(function (a) {
      if (r[a.key] == null) r[a.key] = '';
    });
    ['numeroOm', 'grade', 'nomPrenom', 'objet', 'lieu', 'dateDebut', 'dateFin', 'codeImputation'].forEach(function (k) {
      if (r[k] == null) r[k] = '';
    });
    var nOm = normNumeroOm(r.numeroOm);
    if (nOm !== r.numeroOm) {
      r.numeroOm = nOm;
      changed = true;
    }
  });
  if (changed) save();
}

function save() {
  if (isReadOnly()) return;
  localStorage.setItem(LS, JSON.stringify(rows));
}

function getRow(id) {
  return rows.find(function (r) { return r.id === id; });
}

function msg(text, type) {
  var el = $('MSG');
  el.textContent = text;
  el.className = 'MSG ' + (type || 'ok');
  el.classList.remove('hidden');
  setTimeout(function () { el.classList.add('hidden'); }, 4000);
}

var MOIS_FR = [
  'JANVIER', 'F\u00c9VRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AO\u00dbT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'D\u00c9CEMBRE'
];

function parseDateFr(s) {
  var m = String(s || '').trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m) return null;
  var day = parseInt(m[1], 10);
  var month = parseInt(m[2], 10) - 1;
  var year = parseInt(m[3], 10);
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900) return null;
  var d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

function fmtDateFr(d) {
  return String(d.getDate()).padStart(2, '0') + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function daysUntil(from, to) {
  var a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  var b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

var RETOUR_OM_DELAI = 30;

function retourOmDeadline(r) {
  var fin = parseDateFr(r.dateFin);
  if (!fin) return null;
  var dl = new Date(fin);
  dl.setDate(dl.getDate() + RETOUR_OM_DELAI);
  return dl;
}

function retourOmAlert(r) {
  if (r.retourOm) return null;
  var deadline = retourOmDeadline(r);
  if (!deadline) return null;
  var daysLeft = daysUntil(new Date(), deadline);
  if (daysLeft < 0) return 'late';
  if (daysLeft <= 2) return 'critical';
  if (daysLeft <= 5) return 'urgent';
  if (daysLeft <= 10) return 'warning';
  return null;
}

function retourOmAlertClass(level) {
  if (level === 'warning') return 'TR-ALERT-WARN';
  if (level === 'urgent') return 'TR-ALERT-URG';
  if (level === 'critical') return 'TR-ALERT-CRIT';
  if (level === 'late') return 'TR-ALERT-LATE';
  return '';
}

function retourOmAlertTitle(r) {
  var level = retourOmAlert(r);
  if (!level) return '';
  var deadline = retourOmDeadline(r);
  var daysLeft = daysUntil(new Date(), deadline);
  var ech = fmtDateFr(deadline);
  if (level === 'late') {
    return 'Retour OM non coché — échéance ' + ech + ' dépassée de ' + Math.abs(daysLeft) + ' jour(s)';
  }
  var j = daysLeft === 0 ? 'dernier jour' : 'J-' + daysLeft;
  return 'Retour OM non coché — échéance ' + ech + ' (' + j + ')';
}

function parseDateDebutPeriode(d) {
  var dt = parseDateFr(d);
  if (!dt) return null;
  return { year: dt.getFullYear(), month: dt.getMonth() + 1, key: dt.getFullYear() * 100 + (dt.getMonth() + 1) };
}

function periodeKey(r) {
  var p = parseDateDebutPeriode(r.dateDebut);
  return p ? p.key : 0;
}

function periodeLabel(key) {
  if (!key) return 'SANS DATE';
  var year = Math.floor(key / 100);
  var month = key % 100;
  return MOIS_FR[month - 1] + ' ' + year;
}

function rowSortWithinPeriode(a, b) {
  var na = parseInt(a.numeroOm, 10);
  var nb = parseInt(b.numeroOm, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return nb - na;
  if (String(a.numeroOm) !== String(b.numeroOm)) {
    return String(b.numeroOm).localeCompare(String(a.numeroOm), 'fr');
  }
  var ma = missionKey(a);
  var mb = missionKey(b);
  if (ma !== mb) return ma.localeCompare(mb);
  return String(a.nomPrenom).localeCompare(String(b.nomPrenom), 'fr');
}

function filteredRows() {
  var q = ($('SEARCH').value || '').toLowerCase().trim();
  var list = rows.slice();
  if (q) {
    if (isReadOnly()) {
      list = list.filter(function (r) {
        return String(r.nomPrenom || '').toLowerCase().indexOf(q) >= 0;
      });
    } else {
      list = list.filter(function (r) {
        var h = [
          r.numeroOm, r.grade, r.nomPrenom, r.objet, r.lieu,
          r.dateDebut, r.dateFin, r.codeImputation
        ].join(' ').toLowerCase();
        return h.indexOf(q) >= 0;
      });
    }
  }
  return list.sort(function (a, b) {
    var pa = periodeKey(a);
    var pb = periodeKey(b);
    if (pa !== pb) return pb - pa;
    return rowSortWithinPeriode(a, b);
  });
}

function missionSizeMap(list) {
  var m = {};
  list.forEach(function (r) {
    var k = missionKey(r);
    m[k] = (m[k] || 0) + 1;
  });
  return m;
}

function suggestNumero() {
  var max = 0;
  rows.forEach(function (r) {
    var n = parseInt(r.numeroOm, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return String(max + 1).padStart(4, '0');
}

function updateCodeHint() {
  var inp = $('INP-CODE');
  var hint = $('CODE-HINT');
  if (!inp || !hint) return;
  var v = inp.value.trim();
  if (!v) {
    hint.classList.add('hidden');
    return;
  }
  hint.classList.remove('hidden');
  if (isCodeInterne(v)) {
    hint.className = 'CODE-HINT CODE-HINT-INT';
    hint.textContent = '✓ Budget 4° RIISC (code interne)';
  } else {
    hint.className = 'CODE-HINT CODE-HINT-EXT';
    hint.textContent = '⚠ Code extérieur — hors budget FDYDDR4FCT / FDYDDR4FRM';
  }
}

function setModalMode(mode) {
  modalMode = mode;
  var multi = $('BLOCK-PERS-MULTI');
  var one = $('BLOCK-PERS-ONE');
  var numInp = $('FORM-AJOUT').elements.numeroOm;
  if (mode === 'new') {
    multi.classList.remove('hidden');
    one.classList.add('hidden');
    numInp.readOnly = false;
    $('BTN-ADD-PERS').classList.remove('hidden');
    $('BTN-SUBMIT').textContent = 'Valider';
  } else if (mode === 'addPerson') {
    multi.classList.add('hidden');
    one.classList.remove('hidden');
    numInp.readOnly = true;
    $('BTN-SUBMIT').textContent = 'Ajouter la personne';
  } else {
    multi.classList.add('hidden');
    one.classList.remove('hidden');
    numInp.readOnly = false;
    $('BTN-SUBMIT').textContent = 'Enregistrer';
  }
}

function persRowHtml(grade, nom, idx, canRemove) {
  return (
    '<div class="PERS-ROW" data-idx="' + idx + '">' +
      '<label>Grade<input type="text" class="pers-grade" value="' + esc(grade) + '" placeholder="CCH"></label>' +
      '<label>Nom prénom<input type="text" class="pers-nom" value="' + esc(nom) + '" placeholder="Obligatoire"></label>' +
      (canRemove
        ? '<button type="button" class="PERS-DEL" title="Retirer">×</button>'
        : '<span class="PERS-PH"></span>') +
    '</div>'
  );
}

function renderPersList(items) {
  var el = $('LISTE-PERS');
  if (!items.length) items = [{ grade: '', nomPrenom: '' }];
  el.innerHTML = items.map(function (p, i) {
    return persRowHtml(p.grade || '', p.nomPrenom || '', i, items.length > 1);
  }).join('');
  el.querySelectorAll('.PERS-DEL').forEach(function (btn) {
    btn.onclick = function () {
      btn.closest('.PERS-ROW').remove();
      if (!el.querySelector('.PERS-ROW')) addPersRow();
      el.querySelectorAll('.PERS-ROW').forEach(function (row, i) {
        var del = row.querySelector('.PERS-DEL');
        if (del && el.querySelectorAll('.PERS-ROW').length <= 1) {
          del.replaceWith('<span class="PERS-PH"></span>');
        }
      });
    };
  });
}

function addPersRow(grade, nom) {
  var el = $('LISTE-PERS');
  var n = el.querySelectorAll('.PERS-ROW').length;
  el.insertAdjacentHTML('beforeend', persRowHtml(grade || '', nom || '', n, true));
  el.querySelectorAll('.PERS-ROW').forEach(function (row) {
    if (!row.querySelector('.PERS-DEL') && el.querySelectorAll('.PERS-ROW').length > 1) {
      var ph = row.querySelector('.PERS-PH');
      if (ph) ph.outerHTML = '<button type="button" class="PERS-DEL" title="Retirer">×</button>';
    }
  });
  var last = el.querySelector('.PERS-ROW:last-child .pers-nom');
  if (last) last.focus();
}

function readPersList() {
  var pers = [];
  document.querySelectorAll('#LISTE-PERS .PERS-ROW').forEach(function (row) {
    var g = (row.querySelector('.pers-grade') || {}).value || '';
    var n = (row.querySelector('.pers-nom') || {}).value || '';
    g = g.trim();
    n = n.trim();
    if (g || n) pers.push({ grade: g, nomPrenom: n });
  });
  return pers;
}

function fillMissionFields(row) {
  var f = $('FORM-AJOUT');
  f.elements.numeroOm.value = normNumeroOm(row.numeroOm);
  f.elements.lieu.value = row.lieu || '';
  f.elements.objet.value = row.objet || '';
  f.elements.dateDebut.value = row.dateDebut || '';
  f.elements.dateFin.value = row.dateFin || '';
  f.elements.codeImputation.value = row.codeImputation || '';
  updateCodeHint();
}

function fillAmountFields(row) {
  var f = $('FORM-AJOUT');
  AMOUNTS.forEach(function (a) {
    var inp = f.elements[a.key];
    var v = row ? (row[a.key] || '') : '';
    var abt = isAbt(v);
    inp.value = abt ? 'ABT' : v;
    inp.disabled = abt;
    var btn = inp.parentElement && inp.parentElement.querySelector('.BTN-ABT');
    if (btn) btn.classList.toggle('active', abt);
  });
}

function resetAmountFormFields() {
  var f = $('FORM-AJOUT');
  if (!f) return;
  AMOUNTS.forEach(function (a) {
    var inp = f.elements[a.key];
    if (inp) inp.disabled = false;
    var btn = inp.parentElement && inp.parentElement.querySelector('.BTN-ABT');
    if (btn) btn.classList.remove('active');
  });
}

function toggleAbtForm(key) {
  var f = $('FORM-AJOUT');
  var inp = f.elements[key];
  if (!inp) return;
  if (isAbt(inp.value)) {
    inp.value = '';
    inp.disabled = false;
    inp.focus();
  } else {
    inp.value = 'ABT';
    inp.disabled = true;
  }
  var btn = inp.parentElement && inp.parentElement.querySelector('.BTN-ABT');
  if (btn) btn.classList.toggle('active', isAbt(inp.value));
}

function initAmountAbtButtons() {
  ABT_KEYS.forEach(function (k) {
    var inp = document.querySelector('#FORM-AJOUT [name="' + k + '"]');
    if (!inp || !inp.parentElement || inp.parentElement.querySelector('.BTN-ABT')) return;
    var label = inp.parentElement;
    var wrap = document.createElement('div');
    wrap.className = 'AMT-ROW';
    label.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'BTN-ABT';
    btn.textContent = 'ABT';
    btn.title = 'Prise en charge administration (gratuit)';
    btn.onclick = function () { toggleAbtForm(k); };
    wrap.appendChild(btn);
    label.classList.add('AMT-FLD');
  });
}

function toggleAbtRow(id, key) {
  if (isReadOnly()) return;
  var row = getRow(id);
  if (!row || !canAbt(key)) return;
  row[key] = isAbt(row[key]) ? '' : 'ABT';
  save();
  render();
}

function displayAmountVal(v) {
  if (isAbt(v)) return '<span class="VAL-ABT">ABT</span>';
  var n = parseMontant(v);
  if (!n && !String(v || '').trim()) return '<span class="VAL-EMPTY">—</span>';
  return esc(fmtMontant(n));
}

function amountCellHtml(r, a) {
  var val = r[a.key] || '';
  if (isReadOnly()) {
    return '<td class="TD-AMT TD-AMT-RO">' + displayAmountVal(val) + '</td>';
  }
  var abt = isAbt(val);
  if (!canAbt(a.key)) {
    return '<td class="TD-AMT"><input type="text" class="INP-AMT" inputmode="decimal" data-id="' + r.id +
      '" data-k="' + a.key + '" value="' + esc(val) + '" placeholder="0" title="' + a.label + '"></td>';
  }
  return '<td class="TD-AMT TD-AMT-ABT">' +
    '<div class="AMT-CELL">' +
      '<input type="text" class="INP-AMT' + (abt ? ' INP-ABT' : '') + '" inputmode="decimal" data-id="' + r.id +
      '" data-k="' + a.key + '" value="' + esc(abt ? 'ABT' : val) + '" placeholder="0" title="' + a.label + '"' +
      (abt ? ' readonly' : '') + '>' +
      '<button type="button" class="BTN-ABT-SML' + (abt ? ' active' : '') + '" data-id="' + r.id +
      '" data-k="' + a.key + '" title="Prise en charge administration (gratuit)">ABT</button>' +
    '</div></td>';
}

function fillForm(row) {
  fillMissionFields(row);
  var f = $('FORM-AJOUT');
  f.elements.grade.value = row.grade || '';
  f.elements.nomPrenom.value = row.nomPrenom || '';
  fillAmountFields(row);
}

function readMissionFromForm(f) {
  return {
    numeroOm: normNumeroOm(f.numeroOm.value),
    lieu: f.lieu.value.trim(),
    objet: f.objet.value.trim(),
    dateDebut: f.dateDebut.value.trim(),
    dateFin: f.dateFin.value.trim(),
    codeImputation: f.codeImputation.value.trim()
  };
}

function readAmountsFromForm(f) {
  var a = {};
  AMOUNTS.forEach(function (x) {
    a[x.key] = normAmountValue(f.elements[x.key].value, x.key);
  });
  return a;
}

function buildRowFromParts(missionId, mission, person, amounts) {
  var row = emptyRow();
  row.missionId = missionId;
  row.numeroOm = mission.numeroOm;
  row.lieu = mission.lieu;
  row.objet = mission.objet;
  row.dateDebut = mission.dateDebut;
  row.dateFin = mission.dateFin;
  row.codeImputation = mission.codeImputation;
  row.grade = person.grade;
  row.nomPrenom = person.nomPrenom;
  AMOUNTS.forEach(function (a) { row[a.key] = amounts[a.key] || ''; });
  return row;
}

function openModalNew() {
  if (isReadOnly()) return;
  editingId = null;
  addingMissionId = null;
  $('FORM-AJOUT').reset();
  resetAmountFormFields();
  $('FORM-AJOUT').elements.numeroOm.value = suggestNumero();
  setModalMode('new');
  renderPersList([{ grade: '', nomPrenom: '' }]);
  $('MODAL-TITRE').textContent = 'Nouvelle mission';
  updateCodeHint();
  $('MODAL-AJOUT').classList.remove('hidden');
  document.body.classList.add('MODAL-OPEN');
  $('FORM-AJOUT').elements.numeroOm.focus();
}

function openEditModal(id) {
  if (isReadOnly()) return;
  var row = getRow(id);
  if (!row) return;
  editingId = row.id;
  addingMissionId = null;
  $('FORM-AJOUT').reset();
  fillForm(row);
  setModalMode('edit');
  $('MODAL-TITRE').textContent = 'Modifier — ' + row.nomPrenom + ' (OMR N°' + row.numeroOm + ')';
  $('MODAL-AJOUT').classList.remove('hidden');
  document.body.classList.add('MODAL-OPEN');
}

function openAddPersonModal(id) {
  if (isReadOnly()) return;
  var row = getRow(id);
  if (!row) return;
  editingId = null;
  addingMissionId = missionKey(row);
  $('FORM-AJOUT').reset();
  fillMissionFields(row);
  fillAmountFields(null);
  var f = $('FORM-AJOUT');
  f.elements.grade.value = '';
  f.elements.nomPrenom.value = '';
  setModalMode('addPerson');
  $('MODAL-TITRE').textContent = 'Ajouter une personne — OMR N°' + row.numeroOm;
  $('MODAL-AJOUT').classList.remove('hidden');
  document.body.classList.add('MODAL-OPEN');
  f.elements.grade.focus();
}

function closeModal() {
  editingId = null;
  addingMissionId = null;
  modalMode = 'new';
  $('MODAL-AJOUT').classList.add('hidden');
  if (!$('MODAL-AJUST') || $('MODAL-AJUST').classList.contains('hidden')) {
    document.body.classList.remove('MODAL-OPEN');
  }
}

function render() {
  var list = filteredRows();
  var el = $('LISTE');
  var vide = $('VIDE');
  var sizes = missionSizeMap(list);

  if (!list.length) {
    el.innerHTML = '';
    vide.classList.remove('hidden');
    renderSynth();
    return;
  }
  vide.classList.add('hidden');

  var actTh = isReadOnly() ? '' : '<th></th>';
  var head =
    '<thead><tr>' +
    '<th>N° OMR</th><th>Grade</th><th>Nom prénom</th><th>Objet</th>' +
    '<th>Début</th><th>Fin</th><th>Code imput.</th>' +
    AMOUNTS.map(function (a) {
      return '<th class="TH-AMT" title="' + a.label + '">' + a.short + '</th>';
    }).join('') +
    '<th class="TH-TOT" title="Total ligne">Total</th>' +
    CHECKS.map(function (c) { return '<th class="TH-CHK" title="' + c.label + '">' + c.short + '</th>'; }).join('') +
    actTh + '</tr></thead>';

  var colSpan = 7 + AMOUNTS.length + 1 + CHECKS.length + (isReadOnly() ? 0 : 1);

  function rowHtml(r) {
    var code = r.codeImputation || '';
    var mk = missionKey(r);
    var multi = sizes[mk] > 1;
    var amts = AMOUNTS.map(function (a) {
      return amountCellHtml(r, a);
    }).join('');
    var chks = CHECKS.map(function (c) {
      if (isReadOnly()) {
        return '<td class="TD-CHK TD-CHK-RO" title="' + c.label + '">' +
          (r[c.key] ? '<span class="CHK-DONE">✓</span>' : '') + '</td>';
      }
      return '<td class="TD-CHK"><input type="checkbox" data-id="' + r.id + '" data-k="' + c.key + '"' +
        (r[c.key] ? ' checked' : '') + ' title="' + c.label + '"></td>';
    }).join('');
    var numCell = esc(normNumeroOm(r.numeroOm));
    if (multi) numCell += '<span class="BADGE-MIS" title="Mission collective">×' + sizes[mk] + '</span>';
    var actCell = isReadOnly() ? '' :
      '<td class="TD-ACT">' +
        '<button type="button" class="BTN-SML" data-a="addpers" data-id="' + r.id + '" title="Ajouter une personne sur cette mission">+ Pers.</button> ' +
        '<button type="button" class="BTN-SML" data-a="edit" data-id="' + r.id + '">Modif.</button> ' +
        '<button type="button" class="BTN-SML BTN-DEL" data-a="del" data-id="' + r.id + '">Suppr.</button> ' +
      '</td>';
    var alertLevel = retourOmAlert(r);
    var trCls = [];
    if (multi) trCls.push('TR-MULTI');
    if (alertLevel) trCls.push(retourOmAlertClass(alertLevel));
    var trAttr = trCls.length ? ' class="' + trCls.join(' ') + '"' : '';
    var trTitle = retourOmAlertTitle(r);
    if (trTitle) trAttr += ' title="' + esc(trTitle) + '"';
    return (
      '<tr data-id="' + r.id + '"' + trAttr + '>' +
      '<td class="TD-NUM">' + numCell + '</td>' +
      '<td>' + esc(r.grade) + '</td>' +
      '<td class="TD-NOM">' + esc(r.nomPrenom) + '</td>' +
      '<td class="TD-OBJ" title="' + esc(r.objet) + '">' + esc(r.objet) + '</td>' +
      '<td>' + esc(r.dateDebut) + '</td>' +
      '<td>' + esc(r.dateFin) + '</td>' +
      '<td class="TD-CODE' + codeCellClass(code) + '">' + esc(code) + '</td>' +
      amts +
      '<td class="TD-TOT" data-tot="' + r.id + '">' + fmtMontant(rowTotal(r)) + '</td>' +
      chks +
      actCell +
      '</tr>'
    );
  }

  var bodyParts = [];
  var lastPeriode = null;
  list.forEach(function (r) {
    var pk = periodeKey(r);
    if (pk !== lastPeriode) {
      lastPeriode = pk;
      bodyParts.push(
        '<tr class="TR-PERIODE"><td colspan="' + colSpan + '">' + esc(periodeLabel(pk)) + '</td></tr>'
      );
    }
    bodyParts.push(rowHtml(r));
  });
  var body = bodyParts.join('');

  el.innerHTML = '<table class="TBL">' + head + '<tbody>' + body + '</tbody></table>';

  if (isReadOnly()) {
    renderSynth();
    return;
  }

  function syncField(inp) {
    var row = getRow(inp.dataset.id);
    if (!row) return;
    row[inp.dataset.k] = normAmountValue(inp.value, inp.dataset.k);
    save();
    if (inp.classList.contains('INP-AMT')) {
      var tot = el.querySelector('[data-tot="' + inp.dataset.id + '"]');
      if (tot) tot.textContent = fmtMontant(rowTotal(row));
      renderSynth();
      if (canAbt(inp.dataset.k) && isAbt(row[inp.dataset.k])) render();
    }
  }

  el.querySelectorAll('.INP-AMT').forEach(function (inp) {
    inp.oninput = function () { syncField(inp); };
    inp.onchange = function () { syncField(inp); };
  });

  el.querySelectorAll('.BTN-ABT-SML').forEach(function (btn) {
    btn.onclick = function () { toggleAbtRow(btn.dataset.id, btn.dataset.k); };
  });

  el.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.onchange = function () {
      var row = getRow(cb.dataset.id);
      if (row) {
        row[cb.dataset.k] = cb.checked;
        save();
        renderSynth();
        render();
      }
    };
  });

  el.querySelectorAll('[data-a]').forEach(function (b) {
    b.onclick = function () {
      if (b.dataset.a === 'edit') openEditModal(b.dataset.id);
      else if (b.dataset.a === 'addpers') openAddPersonModal(b.dataset.id);
      else if (b.dataset.a === 'del') delRow(b.dataset.id);
    };
  });

  renderSynth();
}

function delRow(id) {
  if (isReadOnly()) return;
  var row = getRow(id);
  if (!row || !confirm('Supprimer OMR N°' + row.numeroOm + ' — ' + row.nomPrenom + ' ?')) return;
  rows = rows.filter(function (x) { return x.id !== id; });
  save();
  render();
}

function submitForm(e) {
  e.preventDefault();
  if (isReadOnly()) return;
  var f = e.target;
  var mission = readMissionFromForm(f);
  if (!mission.numeroOm) { msg('Indiquez le N° OMR.', 'err'); return; }
  var amounts = readAmountsFromForm(f);

  if (modalMode === 'edit') {
    var exist = getRow(editingId);
    if (!exist) { msg('Ligne introuvable.', 'err'); return; }
    var nom = f.nomPrenom.value.trim();
    if (!nom) { msg('Indiquez le nom prénom.', 'err'); return; }
    exist.numeroOm = mission.numeroOm;
    exist.lieu = mission.lieu;
    exist.objet = mission.objet;
    exist.dateDebut = mission.dateDebut;
    exist.dateFin = mission.dateFin;
    exist.codeImputation = mission.codeImputation;
    exist.grade = f.grade.value.trim();
    exist.nomPrenom = nom;
    AMOUNTS.forEach(function (a) { exist[a.key] = amounts[a.key]; });
    save();
    closeModal();
    render();
    msg('Ligne modifiée.', 'ok');
    return;
  }

  if (modalMode === 'addPerson') {
    var nomA = f.nomPrenom.value.trim();
    if (!nomA) { msg('Indiquez le nom prénom.', 'err'); return; }
    var rowA = buildRowFromParts(addingMissionId, mission, {
      grade: f.grade.value.trim(),
      nomPrenom: nomA
    }, amounts);
    rows.unshift(rowA);
    save();
    closeModal();
    render();
    msg('Personne ajoutée sur OMR N°' + mission.numeroOm + '.', 'ok');
    return;
  }

  var pers = readPersList().filter(function (p) { return p.nomPrenom; });
  if (!pers.length) { msg('Ajoutez au moins un missionnaire (nom prénom).', 'err'); return; }

  var missionId = uid();
  var created = [];
  pers.forEach(function (p) {
    created.push(buildRowFromParts(missionId, mission, p, amounts));
  });
  created.reverse().forEach(function (r) { rows.unshift(r); });
  save();
  closeModal();
  render();
  msg(created.length + ' ligne(s) créée(s) pour OMR N°' + mission.numeroOm + '.', 'ok');
}

function isCodeExterne(code) {
  var n = normCode(code);
  return n.length > 0 && !isCodeInterne(code);
}

function statsForList(list) {
  var counts = {};
  CHECKS.forEach(function (c) {
    counts[c.key] = list.filter(function (r) { return r[c.key]; }).length;
  });
  var totals = {};
  var abtCounts = {};
  var grand = 0;
  AMOUNTS.forEach(function (a) {
    var s = 0;
    var abt = 0;
    list.forEach(function (r) {
      if (isAbt(r[a.key])) abt++;
      else s += parseMontant(r[a.key]);
    });
    totals[a.key] = s;
    abtCounts[a.key] = abt;
    grand += s;
  });
  return { counts: counts, totals: totals, abtCounts: abtCounts, grand: grand, nb: list.length };
}

function emptyAjustBlock() {
  var b = { checks: {}, amounts: {} };
  CHECKS.forEach(function (c) { b.checks[c.key] = ''; });
  AMOUNTS.forEach(function (x) { b.amounts[x.key] = ''; });
  return b;
}

function emptyAjust() {
  return { reg: emptyAjustBlock(), ext: emptyAjustBlock() };
}

function loadAjust() {
  try {
    var a = JSON.parse(localStorage.getItem(LS_AJUST) || '{}');
    var out = emptyAjust();
    if (a.reg || a.ext) {
      ['reg', 'ext'].forEach(function (side) {
        var src = a[side] || {};
        CHECKS.forEach(function (c) {
          if (src.checks && src.checks[c.key] != null) out[side].checks[c.key] = String(src.checks[c.key]);
        });
        AMOUNTS.forEach(function (x) {
          if (src.amounts && src.amounts[x.key] != null) out[side].amounts[x.key] = String(src.amounts[x.key]);
        });
      });
      return out;
    }
    if (a.checks || a.amounts) {
      CHECKS.forEach(function (c) {
        if (a.checks && a.checks[c.key] != null) out.reg.checks[c.key] = String(a.checks[c.key]);
      });
      AMOUNTS.forEach(function (x) {
        if (a.amounts && a.amounts[x.key] != null) out.reg.amounts[x.key] = String(a.amounts[x.key]);
      });
    }
    return out;
  } catch (e) {
    return emptyAjust();
  }
}

function saveAjust(a) {
  if (isReadOnly()) return;
  localStorage.setItem(LS_AJUST, JSON.stringify(a));
}

function readAjustBlockFromForm(f, side) {
  var b = emptyAjustBlock();
  var p = side + '_';
  CHECKS.forEach(function (c) { b.checks[c.key] = (f.elements[p + c.key].value || '').trim(); });
  AMOUNTS.forEach(function (x) { b.amounts[x.key] = (f.elements[p + x.key].value || '').trim(); });
  return b;
}

function fillAjustForm(f, a) {
  ['reg', 'ext'].forEach(function (side) {
    var p = side + '_';
    CHECKS.forEach(function (c) {
      f.elements[p + c.key].value = a[side].checks[c.key] || '';
    });
    AMOUNTS.forEach(function (x) {
      f.elements[p + x.key].value = a[side].amounts[x.key] || '';
    });
  });
}

function clearAjustForm(f) {
  fillAjustForm(f, emptyAjust());
}

function statsFromAjustBlock(block) {
  var counts = {};
  CHECKS.forEach(function (c) {
    counts[c.key] = parseInt(block.checks[c.key], 10) || 0;
  });
  var totals = {};
  var grand = 0;
  AMOUNTS.forEach(function (a) {
    totals[a.key] = parseMontant(block.amounts[a.key]);
    grand += totals[a.key];
  });
  return { counts: counts, totals: totals, abtCounts: {}, grand: grand, nb: 0 };
}

function combineStats(a, b) {
  var counts = {};
  CHECKS.forEach(function (c) {
    counts[c.key] = a.counts[c.key] + b.counts[c.key];
  });
  var totals = {};
  var abtCounts = {};
  var grand = 0;
  AMOUNTS.forEach(function (x) {
    totals[x.key] = a.totals[x.key] + b.totals[x.key];
    abtCounts[x.key] = (a.abtCounts[x.key] || 0) + (b.abtCounts[x.key] || 0);
    grand += totals[x.key];
  });
  return {
    counts: counts,
    totals: totals,
    abtCounts: abtCounts,
    grand: grand,
    nb: a.nb + b.nb
  };
}

function ajustHasData(s) {
  if (!s) return false;
  var c = CHECKS.some(function (k) { return (s.counts[k.key] || 0) > 0; });
  var m = AMOUNTS.some(function (a) { return (s.totals[a.key] || 0) > 0; });
  return c || m;
}

function openAjustModal() {
  if (isReadOnly()) return;
  fillAjustForm($('FORM-AJUST'), loadAjust());
  $('MODAL-AJUST').classList.remove('hidden');
  document.body.classList.add('MODAL-OPEN');
}

function closeAjustModal() {
  $('MODAL-AJUST').classList.add('hidden');
  if (!$('MODAL-AJOUT') || $('MODAL-AJOUT').classList.contains('hidden')) {
    document.body.classList.remove('MODAL-OPEN');
  }
}

function submitAjust(e) {
  e.preventDefault();
  if (isReadOnly()) return;
  var f = e.target;
  var a = {
    reg: readAjustBlockFromForm(f, 'reg'),
    ext: readAjustBlockFromForm(f, 'ext')
  };
  saveAjust(a);
  closeAjustModal();
  renderSynth();
  msg('Compl\u00e9ments CRH enregistr\u00e9s.', 'ok');
}

function effacerAjust() {
  if (isReadOnly()) return;
  if (!confirm('Effacer tous les compl\u00e9ments manuels ?')) return;
  saveAjust(emptyAjust());
  clearAjustForm($('FORM-AJUST'));
  renderSynth();
  msg('Compl\u00e9ments effac\u00e9s.', 'ok');
}

function computeSynthStats(list) {
  var ajust = loadAjust();
  var sManualReg = statsFromAjustBlock(ajust.reg);
  var sManualExt = statsFromAjustBlock(ajust.ext);
  var sManualAll = combineStats(sManualReg, sManualExt);
  var regList = list.filter(function (r) { return isCodeInterne(r.codeImputation); });
  var extList = list.filter(function (r) { return isCodeExterne(r.codeImputation); });
  var sRegApp = statsForList(regList);
  var sExtApp = statsForList(extList);
  var sApp = statsForList(list);
  return {
    sComb: combineStats(sApp, sManualAll),
    sReg: combineStats(sRegApp, sManualReg),
    sExt: combineStats(sExtApp, sManualExt)
  };
}

var synthPrev = '';

function renderSynth() {
  var el = $('SYNTH');
  if (!el) return;
  var stats = computeSynthStats(rows);
  var hdrShort = { demandeOmr: 'Dem.', omValide: 'Valid.', retourOm: 'Ret.', omLiquider: 'Liq.' };
  var snap = CHECKS.map(function (c) { return stats.sComb.counts[c.key]; }).join(',') + '|' +
    stats.sReg.grand.toFixed(2) + '|' + stats.sExt.grand.toFixed(2);
  var anim = synthPrev !== '' && synthPrev !== snap;
  synthPrev = snap;

  function flipFace(val, animCls) {
    return (
      '<div class="FLIP-FACE' + (animCls ? ' FLIP-ANIM' : '') + '">' +
        '<span class="FLIP-NUM">' + val + '</span>' +
      '</div>'
    );
  }

  var chkHtml = CHECKS.map(function (c) {
    var n = stats.sComb.counts[c.key];
    return (
      '<div class="FLIP-TILE" title="' + esc(c.label) + '">' +
        '<span class="FLIP-LBL">' + (hdrShort[c.key] || c.short) + '</span>' +
        flipFace(n, anim) +
      '</div>'
    );
  }).join('');

  var stackHtml =
    '<div class="FLIP-TILE FLIP-WIDE FLIP-REG" title="Imputation régimentaire FDYDDR4FCT / FDYDDR4FRM">' +
      '<span class="FLIP-LBL">Rég.</span>' +
      flipFace(fmtMontant(stats.sReg.grand), anim) +
    '</div>' +
    '<div class="FLIP-TILE FLIP-WIDE FLIP-EXT" title="Imputation extérieure">' +
      '<span class="FLIP-LBL">Ext.</span>' +
      flipFace(fmtMontant(stats.sExt.grand), anim) +
    '</div>';

  el.innerHTML =
    '<div class="FLIP-ROW">' + chkHtml + '</div>' +
    '<div class="FLIP-STACK">' + stackHtml + '</div>';
}

function fmtMontantPdf(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
}

function processLogoTransparent(dataUrl, cb) {
  var img = new Image();
  img.onload = function () {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      var px = d.data;
      for (var i = 0; i < px.length; i += 4) {
        if (px[i] > 220 && px[i + 1] > 220 && px[i + 2] > 220) px[i + 3] = 0;
      }
      ctx.putImageData(d, 0, 0);
      cb(c.toDataURL('image/png'));
    } catch (e) {
      cb(dataUrl);
    }
  };
  img.onerror = function () { cb(dataUrl); };
  img.src = dataUrl;
}

var logoPdfCache = null;

function logoDataUrl(cb) {
  if (logoPdfCache) {
    cb(logoPdfCache);
    return;
  }
  function finish(url) {
    processLogoTransparent(url, function (t) {
      logoPdfCache = t;
      cb(t);
    });
  }
  if (typeof LOGO_PDF_B64 !== 'undefined' && LOGO_PDF_B64) {
    finish(LOGO_PDF_B64);
    return;
  }
  function toData(el) {
    try {
      var w = el.naturalWidth || 192;
      var h = el.naturalHeight || 192;
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(el, 0, 0, w, h);
      finish(c.toDataURL('image/png'));
    } catch (e) {
      cb(null);
    }
  }
  function srcUrl() {
    try {
      return new URL('icon-192.png', window.location.href).href;
    } catch (e) {
      return 'icon-192.png';
    }
  }
  var dom = document.querySelector('.LOGO-TRIGONE');
  if (dom && dom.complete && dom.naturalWidth > 0) {
    toData(dom);
    return;
  }
  var i = new Image();
  i.onload = function () { toData(i); };
  i.onerror = function () { cb(null); };
  i.src = srcUrl();
}

function addLogoPdf(doc, logo, pw) {
  if (!logo) return false;
  try {
    var lw = 18;
    doc.addImage(logo, 'PNG', (pw - lw) / 2, 16, lw, lw);
    return true;
  } catch (e) {
    return false;
  }
}

function drawCrhSection(doc, x, y, w, title, stats, theme, maxY) {
  var headH = 7;
  doc.setFillColor(theme.r, theme.g, theme.b);
  doc.roundedRect(x, y, w, headH, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + w / 2, y + 4.8, { align: 'center' });

  y += headH + 1;

  var rows = CHECKS.map(function (c) {
    return [c.label, String(stats.counts[c.key])];
  });
  rows.push(['Poste de d\u00e9pense', 'Montant']);
  AMOUNTS.forEach(function (a) {
    rows.push([a.label, fmtCrhAmount(stats, a.key)]);
  });
  rows.push(['TOTAL', fmtMontantPdf(stats.grand)]);

  var amtHeadIdx = CHECKS.length;
  var totalIdx = rows.length - 1;

  doc.autoTable({
    startY: y,
    margin: { left: x, right: doc.internal.pageSize.getWidth() - x - w, bottom: maxY ? (doc.internal.pageSize.getHeight() - maxY) : 20 },
    tableWidth: w,
    head: [['Avancement', 'Nb']],
    body: rows,
    theme: 'grid',
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.5, cellPadding: 1.1, lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: {
      fillColor: theme.r,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1
    },
    bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: w * 0.62 },
      1: { cellWidth: w * 0.38, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: theme.light },
    didParseCell: function (data) {
      if (data.section !== 'body') return;
      if (data.row.index === amtHeadIdx) {
        data.cell.styles.fillColor = theme.dark;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = data.column.index === 1 ? 'right' : 'left';
      }
      if (data.row.index === totalIdx) {
        data.cell.styles.fillColor = theme.r;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
      }
      if (data.row.index < amtHeadIdx && data.column.index === 1) {
        data.cell.styles.halign = 'center';
      }
      if (data.column.index === 1 && String(data.cell.raw || '').indexOf('ABT') >= 0) {
        data.cell.styles.textColor = [124, 58, 237];
      }
    }
  });

  return doc.lastAutoTable.finalY;
}

function computeCrhData(list) {
  var ajust = loadAjust();
  var sManualReg = statsFromAjustBlock(ajust.reg);
  var sManualExt = statsFromAjustBlock(ajust.ext);
  var sManualAll = combineStats(sManualReg, sManualExt);
  var regList = list.filter(function (r) { return isCodeInterne(r.codeImputation); });
  var extList = list.filter(function (r) { return isCodeExterne(r.codeImputation); });
  var sansCode = list.filter(function (r) { return !normCode(r.codeImputation); });
  var sRegApp = statsForList(regList);
  var sExtApp = statsForList(extList);
  var sApp = statsForList(list);
  return {
    sansCode: sansCode,
    sManualReg: sManualReg,
    sManualExt: sManualExt,
    sManualAll: sManualAll,
    sReg: combineStats(sRegApp, sManualReg),
    sExt: combineStats(sExtApp, sManualExt),
    sComb: combineStats(sApp, sManualAll),
    sApp: sApp
  };
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 500);
}

function xlsThinBorder() {
  var b = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  return { top: b, left: b, bottom: b, right: b };
}

function xlsStyleRow(ws, row, c1, c2, fillArgb, fontArgb, bold, size) {
  for (var c = c1; c <= c2; c++) {
    var cell = ws.getCell(row, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cell.font = { bold: bold !== false, color: { argb: fontArgb || 'FFFFFFFF' }, size: size || 10 };
    cell.border = xlsThinBorder();
    cell.alignment = { vertical: 'middle' };
  }
}

function writeCrhSectionExcel(ws, startRow, title, stats, theme) {
  ws.mergeCells(startRow, 1, startRow, 2);
  var t = ws.getCell(startRow, 1);
  t.value = title;
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  xlsStyleRow(ws, startRow, 1, 2, theme.main, 'FFFFFFFF', true, 11);

  var r = startRow + 1;
  ws.getCell(r, 1).value = 'Avancement';
  ws.getCell(r, 2).value = 'Nb';
  xlsStyleRow(ws, r, 1, 2, theme.main, 'FFFFFFFF', true, 9);
  ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
  r++;

  CHECKS.forEach(function (c, i) {
    var bg = i % 2 === 0 ? theme.light : 'FFFFFFFF';
    ws.getCell(r, 1).value = c.label;
    ws.getCell(r, 2).value = stats.counts[c.key];
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws.getCell(r, 1).border = xlsThinBorder();
    ws.getCell(r, 2).border = xlsThinBorder();
    ws.getCell(r, 1).font = { size: 10, color: { argb: 'FF1A1A1A' } };
    ws.getCell(r, 2).font = { size: 10, bold: true, color: { argb: 'FF1A1A1A' } };
    ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    r++;
  });

  ws.getCell(r, 1).value = 'Poste de d\u00e9pense';
  ws.getCell(r, 2).value = 'Montant (\u20AC)';
  xlsStyleRow(ws, r, 1, 2, theme.dark, 'FFFFFFFF', true, 9);
  ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getCell(r, 2).alignment = { horizontal: 'right', vertical: 'middle' };
  r++;

  AMOUNTS.forEach(function (a, i) {
    var bg = i % 2 === 0 ? theme.light : 'FFFFFFFF';
    var abt = (stats.abtCounts && stats.abtCounts[a.key]) || 0;
    var n = stats.totals[a.key] || 0;
    var c1 = ws.getCell(r, 1);
    var c2 = ws.getCell(r, 2);
    c1.value = a.label;
    if (abt > 0) {
      c2.value = fmtCrhAmount(stats, a.key);
      c2.font = { size: 10, bold: true, color: { argb: 'FF7C3AED' } };
    } else {
      c2.value = n;
      c2.numFmt = '#,##0.00 "\u20AC"';
      c2.font = { size: 10, bold: true, color: { argb: 'FF1A1A1A' } };
    }
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    c1.border = xlsThinBorder();
    c2.border = xlsThinBorder();
    c1.font = { size: 10, color: { argb: 'FF1A1A1A' } };
    c2.alignment = { horizontal: 'right', vertical: 'middle' };
    r++;
  });

  ws.getCell(r, 1).value = 'TOTAL';
  ws.getCell(r, 2).value = stats.grand || 0;
  ws.getCell(r, 2).numFmt = '#,##0.00 "\u20AC"';
  xlsStyleRow(ws, r, 1, 2, theme.main, 'FFFFFFFF', true, 10);
  ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getCell(r, 2).alignment = { horizontal: 'right', vertical: 'middle' };
  return r + 2;
}

function exportCrhExcel() {
  if (isReadOnly()) return;
  var list = filteredRows();
  if (!list.length) {
    msg('Aucune ligne pour le CRH.', 'err');
    return;
  }
  if (typeof ExcelJS === 'undefined') {
    msg('Biblioth\u00e8que Excel non charg\u00e9e (connexion internet requise).', 'err');
    return;
  }

  var btn = $('BTN-CRH-XLS');
  if (btn) { btn.disabled = true; btn.textContent = 'G\u00e9n\u00e9ration\u2026'; }

  var d = computeCrhData(list);
  var wb = new ExcelJS.Workbook();
  wb.creator = 'TRIGONE — 4\u00b0 RIISC';
  var ws = wb.addWorksheet('CRH OMR', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.55, right: 0.55, top: 0.6, bottom: 0.6, header: 0, footer: 0 }
    }
  });

  ws.columns = [{ width: 42 }, { width: 18 }];

  ws.mergeCells(1, 1, 1, 2);
  var titleCell = ws.getCell(1, 1);
  titleCell.value = 'SUIVI OMR - 4\u00b0 RIISC';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A1A1A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  var row = 3;
  row = writeCrhSectionExcel(ws, row, 'IMPUTATION R\u00c9GIMENTAIRE', d.sReg, {
    main: 'FF3D6B52', dark: 'FF2D5040', light: 'FFECFDF5'
  });
  row = writeCrhSectionExcel(ws, row, 'IMPUTATION EXT\u00c9RIEURE', d.sExt, {
    main: 'FFC2410C', dark: 'FF9A340A', light: 'FFFEF9C3'
  });

  row = writeCrhSectionExcel(ws, row, 'TOTAL G\u00c9N\u00c9RAL (application + compl\u00e9ments)', d.sComb, {
    main: 'FF1A1A1A', dark: 'FF333333', light: 'FFF5F0EA'
  });

  if (d.sansCode.length) {
    ws.mergeCells(row, 1, row, 2);
    ws.getCell(row, 1).value = d.sansCode.length + ' dossier(s) sans code imputation (non inclus)';
    ws.getCell(row, 1).font = { size: 9, color: { argb: 'FFB45309' }, italic: true };
    ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  var fname = 'CRH_OMR_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  wb.xlsx.writeBuffer().then(function (buf) {
    downloadBlob(new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), fname);
    msg('CRH Excel t\u00e9l\u00e9charg\u00e9.', 'ok');
    if (btn) { btn.disabled = false; btn.textContent = 'CRH EXCEL'; }
  }).catch(function (e) {
    console.error(e);
    msg('Erreur lors de la g\u00e9n\u00e9ration Excel.', 'err');
    if (btn) { btn.disabled = false; btn.textContent = 'CRH EXCEL'; }
  });
}

function imprimerCrh() {
  if (isReadOnly()) return;
  var list = filteredRows();
  if (!list.length) {
    msg('Aucune ligne pour le CRH.', 'err');
    return;
  }
  if (typeof jspdf === 'undefined') {
    msg('Biblioth\u00e8que PDF non charg\u00e9e (connexion internet requise).', 'err');
    return;
  }

  var btn = $('BTN-CRH');
  if (btn) { btn.disabled = true; btn.textContent = 'G\u00e9n\u00e9ration\u2026'; }

  logoDataUrl(function (logo) {
    try {
      var d = computeCrhData(list);
      var sansCode = d.sansCode;
      var sManualReg = d.sManualReg;
      var sManualExt = d.sManualExt;
      var sManualAll = d.sManualAll;
      var sReg = d.sReg;
      var sExt = d.sExt;
      var sComb = d.sComb;
      var sApp = d.sApp;

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pw = doc.internal.pageSize.getWidth();
      var ph = doc.internal.pageSize.getHeight();
      var m = 14;
      var footH = 18;
      var footY = ph - 8 - footH;
      var maxContentY = footY - 4;
      var tableW = pw - m * 2;

      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, pw, 12, 'F');
      doc.setFillColor(184, 149, 110);
      doc.rect(0, 12, pw, 1, 'F');

      var hasLogo = logo ? addLogoPdf(doc, logo, pw) : false;
      var logoBottom = hasLogo ? 34 : 13;

      doc.setTextColor(26, 26, 26);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      var titleY = logoBottom + 6;
      doc.text('SUIVI OMR - 4\u00b0 RIISC', pw / 2, titleY, { align: 'center' });

      var lineY = titleY + 5;
      if (sansCode.length) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 83, 9);
        doc.text(sansCode.length + ' dossier(s) sans code imputation (non inclus ci-dessous)', pw / 2, titleY + 5, { align: 'center' });
        lineY = titleY + 10;
      }

      doc.setDrawColor(184, 149, 110);
      doc.setLineWidth(0.5);
      doc.line(m, lineY, pw - m, lineY);

      var startY = lineY + 3;

      var themeReg = { r: 61, g: 107, b: 82, dark: [45, 80, 62], light: [236, 253, 245] };
      var themeExt = { r: 194, g: 65, b: 12, dark: [154, 52, 10], light: [254, 249, 195] };

      var yAfterReg = drawCrhSection(doc, m, startY, tableW, 'IMPUTATION R\u00c9GIMENTAIRE', sReg, themeReg, maxContentY);
      drawCrhSection(doc, m, yAfterReg + 4, tableW, 'IMPUTATION EXT\u00c9RIEURE', sExt, themeExt, maxContentY);

      doc.setFillColor(26, 26, 26);
      doc.roundedRect(m, footY, pw - m * 2, footH, 2, 2, 'F');
      doc.setFillColor(184, 149, 110);
      doc.rect(m, footY, 4, footH, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL G\u00c9N\u00c9RAL (application + compl\u00e9ments)', m + 9, footY + 6);

      doc.setFontSize(12);
      doc.setTextColor(184, 149, 110);
      doc.text(fmtMontantPdf(sComb.grand), pw - m - 5, footY + 7, { align: 'right' });

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(210, 210, 210);
      var chkLine = CHECKS.map(function (c) {
        return c.label + ' : ' + sComb.counts[c.key];
      }).join('   \u2022   ');
      doc.text(chkLine, m + 9, footY + 11, { maxWidth: pw - m * 2 - 14 });

      var amtDetail = AMOUNTS.map(function (a) {
        return a.short + ' ' + fmtCrhAmount(sComb, a.key);
      }).join('  \u2022  ');
      doc.text(amtDetail, pw / 2, footY + 15, { align: 'center', maxWidth: pw - m * 2 - 10 });

      if (ajustHasData(sManualAll)) {
        doc.setFontSize(6);
        doc.setTextColor(160, 160, 160);
        var det = 'Dont application : ' + fmtMontantPdf(sApp.grand);
        if (ajustHasData(sManualReg)) det += '  |  Compl. r\u00e9g. : ' + fmtMontantPdf(sManualReg.grand);
        if (ajustHasData(sManualExt)) det += '  |  Compl. ext. : ' + fmtMontantPdf(sManualExt.grand);
        doc.text(det, pw / 2, footY + footH - 1.5, { align: 'center', maxWidth: pw - m * 2 - 10 });
      }

      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text('TRIGONE \u00b7 4\u00b0 RIISC \u2014 Document interne', pw / 2, ph - 4, { align: 'center' });

      doc.save('CRH_OMR_' + new Date().toISOString().slice(0, 10) + '.pdf');
      msg('CRH PDF t\u00e9l\u00e9charg\u00e9.', 'ok');
    } catch (e) {
      console.error(e);
      msg('Erreur lors de la g\u00e9n\u00e9ration du PDF.', 'err');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'CRH PDF'; }
  });
}

function quitAccessMode() {
  clearAccessMode();
  var search = $('SEARCH');
  if (search) search.value = '';
  showAccessModal();
}

$('BTN-AJOUTER').onclick = openModalNew;
$('BTN-ADD-PERS').onclick = function () { addPersRow(); };
$('MODAL-FERMER').onclick = closeModal;
$('MODAL-ANNULER').onclick = closeModal;
$('FORM-AJOUT').onsubmit = submitForm;
$('INP-CODE').oninput = updateCodeHint;
$('SEARCH').oninput = render;
$('BTN-CRH').onclick = imprimerCrh;
$('BTN-CRH-XLS').onclick = exportCrhExcel;
$('BTN-AJUST').onclick = openAjustModal;
$('AJUST-FERMER').onclick = closeAjustModal;
$('AJUST-ANNULER').onclick = closeAjustModal;
$('AJUST-EFFACER').onclick = effacerAjust;
$('FORM-AJUST').onsubmit = submitAjust;
$('MODAL-AJUST').onclick = function (e) {
  if (e.target === $('MODAL-AJUST')) closeAjustModal();
};

$('MODAL-AJOUT').onclick = function (e) {
  if (e.target === $('MODAL-AJOUT')) closeModal();
};

var formAccess = $('FORM-ACCESS');
if (formAccess) formAccess.onsubmit = submitAccess;
var btnQuitAccess = $('BTN-QUIT-ACCESS');
if (btnQuitAccess) btnQuitAccess.onclick = quitAccessMode;

bootApp();
