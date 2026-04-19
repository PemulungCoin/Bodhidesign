/* ═══════════════════════════════════════════
   Visual Editor — CSS-Based
   Uses [data-edit="..."] selectors
   Works on ALL themes (v1 + v2)
   ═══════════════════════════════════════════ */
(function(){
  'use strict';

  var savedData = {};
  var selected = null;
  var editMode = false;
  var hiddenEls = []; // track elemen yang di-hide
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    createBar();
    createPanel();
    loadSaved();
  }

  /* ── BAR ───────────────────────────── */
  function createBar(){
    var b = document.createElement('div');
    b.id = 'editor-bar';
    b.innerHTML =
      '<span style="font-weight:700;color:#a78bfa">🎨 Visual Editor</span>' +
      '<button id="eb-toggle">✏️ Edit Mode</button>' +
      '<button id="eb-save" class="save-btn">💾 Save</button>' +
      '<button id="eb-reset" class="reset-btn">🔄 Reset</button>' +
      '<span id="eb-status" class="status">Ready</span>';
    document.body.appendChild(b);
    document.getElementById('eb-toggle').onclick = toggleEdit;
    document.getElementById('eb-save').onclick = saveCSS;
    document.getElementById('eb-reset').onclick = resetCSS;
  }

  /* ── PANEL ─────────────────────────── */
  function createPanel(){
    var p = document.createElement('div');
    p.id = 'props-panel';
    p.innerHTML = '<div id="props-header">Properties</div><div id="props-content"><p style="padding:14px;color:#9ca3af;text-align:center">Klik Edit Mode,<br>lalu klik elemen</p></div>';
    document.body.appendChild(p);
  }

  /* ── TOGGLE ────────────────────────── */
  function toggleEdit(){
    editMode = !editMode;
    document.body.classList.toggle('editor-on', editMode);
    var btn = document.getElementById('eb-toggle');
    btn.classList.toggle('active', editMode);
    btn.textContent = editMode ? '👁️ View' : '✏️ Edit';
    document.getElementById('props-panel').classList.toggle('open', editMode);
    setStatus(editMode ? 'Klik elemen untuk edit' : 'View mode');
    if(editMode){
      document.addEventListener('click', onClick, true);
      // ── Restore hidden elements in edit mode ──
      hiddenEls = [];
      // 1) From saved data (CSS rules)
      for(var sel in savedData){
        if(savedData[sel] && savedData[sel]['display'] === 'none'){
          var targets = document.querySelectorAll(sel);
          targets.forEach(function(t){
            hiddenEls.push({el: t, origDisplay: t.style.display, origImportant: t.style.getPropertyPriority('display')});
            t.style.removeProperty('display');
            t.classList.add('editor-hidden-visible');
          });
        }
      }
      // 2) From inline style (user might have hidden directly)
      document.querySelectorAll('[data-edit]').forEach(function(el){
        if(el.style.display === 'none' && !el.classList.contains('editor-hidden-visible')){
          hiddenEls.push({el: el, origDisplay: 'none', origImportant: el.style.getPropertyPriority('display')});
          el.style.removeProperty('display');
          el.classList.add('editor-hidden-visible');
        }
      });
    } else {
      deselect();
      document.removeEventListener('click', onClick, true);
      // ── Re-hide elements when leaving edit mode ──
      hiddenEls.forEach(function(item){
        item.el.classList.remove('editor-hidden-visible');
        if(item.origDisplay === 'none'){
          item.el.style.setProperty('display','none','important');
        }
      });
      hiddenEls = [];
    }
  }

  /* ── CLICK ─────────────────────────── */
  function onClick(e){
    var el = e.target.closest('[data-edit]');
    if(!el || el.closest('#editor-bar, #props-panel')) return;
    e.preventDefault();
    e.stopPropagation();
    select(el);
  }

  function select(el){
    deselect();
    selected = el;
    el.classList.add('editor-selected');
    showProps(el);
  }

  function deselect(){
    if(selected) selected.classList.remove('editor-selected');
    selected = null;
    var c = document.getElementById('props-content');
    if(c) c.innerHTML = '<p style="padding:14px;color:#9ca3af;text-align:center">Klik elemen untuk edit</p>';
  }

  /* ── SELECTOR ──────────────────────── */
  function getSel(el){
    var de = el.getAttribute('data-edit');
    if(de) return '[data-edit="' + de + '"]';
    // Fallback
    if(el.id) return '#' + el.id;
    return el.tagName.toLowerCase();
  }

  /* ── PROPERTIES ────────────────────── */
  function showProps(el){
    var cs = window.getComputedStyle(el);
    var tag = el.tagName.toLowerCase();
    var isImg = tag === 'img';
    var sel = getSel(el);
    var name = el.getAttribute('data-edit') || tag;

    var h = '<div style="padding:8px 14px;background:#1e1b4b;margin-bottom:6px;font-size:11px;color:#a78bfa;border-radius:6px">📌 ' + name + '</div>';

    if(!isImg){
      // Font size
      var fs = parseInt(cs.fontSize) || 16;
      h += slider('Font Size', 'font-size', fs, 8, 120, 'px');
      // Font weight
      var fw = cs.fontWeight || '400';
      h += '<div class="prop-row"><label><span>Weight</span><select data-prop="font-weight" class="editor-set" style="background:#1e1b4b;border:1px solid #444;color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;width:90px">' +
        ['400','500','600','700','800'].map(function(w){
          return '<option value="'+w+'"'+(fw===w?' selected':'')+'>'+({'400':'Normal','500':'Medium','600':'Semi','700':'Bold','800':'Extra'}[w])+'</option>';
        }).join('') + '</select></label></div>';
      // Color
      var col = rgb2hex(cs.color);
      h += '<div class="prop-row"><label><span>Color</span><input type="color" value="'+col+'" data-prop="color" class="editor-set"><span class="color-hex">'+col+'</span></label></div>';
    }

    // Spacing
    h += '<div class=\"prop-row-title\">📐 Spacing</div>';
    h += slider('Margin Top', 'margin-top', parseInt(cs.marginTop)||0, -100, 200, 'px');
    h += slider('Margin Bottom', 'margin-bottom', parseInt(cs.marginBottom)||0, -100, 200, 'px');
    h += slider('⬅ Margin Kiri', 'margin-left', parseInt(cs.marginLeft)||0, -500, 1000, 'px');
    h += slider('Margin Kanan ➡', 'margin-right', parseInt(cs.marginRight)||0, -500, 1000, 'px');
    h += slider('Padding', 'padding', parseInt(cs.paddingTop)||0, 0, 100, 'px');

    // translateX — free positioning
    var txMatch = (el.style.transform || '').match(/translateX\(([^)]+)px\)/);
    var txVal = txMatch ? parseInt(txMatch[1]) : 0;
    h += slider('↔ Geser Horizontal', 'transform', txVal, -500, 500, 'px', 'translateX');

    // Size for images
    if(isImg){
      h += '<div class="prop-row-title">📏 Size</div>';
      h += slider('Width', 'width', parseInt(cs.width)||100, 10, 800, 'px');
      h += slider('Height', 'height', parseInt(cs.height)||100, 10, 800, 'px');
    }

    // Background
    if(!isImg){
      h += '<div class="prop-row-title">🎨 Style</div>';
      var bg = rgb2hex(cs.backgroundColor);
      h += '<div class="prop-row"><label><span>BG Color</span><input type="color" value="'+bg+'" data-prop="background-color" class="editor-set"><span class="color-hex">'+bg+'</span></label></div>';
      h += slider('Radius', 'border-radius', parseInt(cs.borderRadius)||0, 0, 50, 'px');
    }

    // Actions — Hide/Show & Revert
    h += '<div style="padding:10px 14px;border-top:1px solid #333;margin-top:8px">';
    // Find closest element with data-edit (section or sub-element)
    var target = el.closest('[data-edit]') || el;
    if(target && target !== document.body && target.getAttribute('data-edit')){
      var targetSel = '[data-edit="' + target.getAttribute('data-edit') + '"]';
      var isHidden = target.style.display === 'none';
      var targetName = target.getAttribute('data-edit');
      h += '<div style="margin-bottom:6px;font-size:11px;color:#9ca3af">Target: <b style="color:#a78bfa">' + targetName + '</b></div>';
      h += '<div style="display:flex;gap:6px">';
      h += '<button class="action" id="btn-hide-target" style="background:' + (isHidden ? '#22c55e' : '#dc2626') + '">' + (isHidden ? '👁️ Tampilkan' : '🙈 Sembunyikan') + '</button>';
      h += '</div>';
    }
    h += '<div style="display:flex;gap:6px;margin-top:6px">';
    h += '<button class="action btn-revert" id="btn-revert">↩️ Revert Elemen</button>';
    h += '</div>';
    h += '</div>';

    document.getElementById('props-content').innerHTML = h;
    bindPanel(el, sel);
  }

  function slider(label, prop, val, min, max, unit, wrapper){
    var dataExtra = wrapper ? ' data-wrapper="'+wrapper+'"' : '';
    return '<div class="prop-row"><label><span>'+label+'</span>' +
      '<input type="range" min="'+min+'" max="'+max+'" value="'+val+'" data-prop="'+prop+'" data-unit="'+unit+'"'+dataExtra+' class="editor-slider">' +
      '<span class="val-display">'+val+unit+'</span></label></div>';
  }

  function bindPanel(el, sel){
    document.querySelectorAll('.editor-slider').forEach(function(inp){
      inp.oninput = function(){
        var p = this.dataset.prop, u = this.dataset.unit || '';
        var w = this.dataset.wrapper;
        var v;
        if(w){
          // translateX wrapper
          var numVal = parseInt(this.value) || 0;
          v = numVal !== 0 ? w + '(' + numVal + 'px)' : '';
          el.style.setProperty(p, v, 'important');
          this.parentElement.querySelector('.val-display').textContent = numVal + u;
          track(sel, p, v);
        } else {
          v = this.value + u;
          el.style.setProperty(p, v, 'important');
          this.parentElement.querySelector('.val-display').textContent = v;
          track(sel, p, v);
        }
      };
    });
    document.querySelectorAll('.editor-set').forEach(function(inp){
      inp.onchange = function(){
        var p = this.dataset.prop, v = this.value;
        el.style.setProperty(p, v, 'important');
        track(sel, p, v);
        if(p === 'color' || p === 'background-color'){
          var hex = this.parentElement.querySelector('.color-hex');
          if(hex) hex.textContent = v;
        }
      };
    });
    var hideBtn = document.getElementById('btn-hide-target');
    if(hideBtn) hideBtn.onclick = function(){
      var target = el.closest('[data-edit]') || el;
      if(!target || !target.getAttribute('data-edit')) return;
      var targetSel = '[data-edit="' + target.getAttribute('data-edit') + '"]';
      if(!savedData[targetSel]) savedData[targetSel] = {};
      if(target.style.display === 'none'){
        target.style.removeProperty('display');
        delete savedData[targetSel]['display'];
        setStatus('👁️ Ditampilkan');
      } else {
        target.style.setProperty('display','none','important');
        savedData[targetSel]['display'] = 'none';
        setStatus('🙈 Disembunyikan');
      }
      deselect();
    };
    var revBtn = document.getElementById('btn-revert');
    if(revBtn) revBtn.onclick = function(){
      delete savedData[sel];
      el.removeAttribute('style');
      deselect();
      setStatus('Reverted');
    };
  }

  /* ── TRACK ─────────────────────────── */
  function track(sel, prop, value){
    if(!savedData[sel]) savedData[sel] = {};
    savedData[sel][prop] = value;
    setStatus('⚠️ Unsaved');
  }

  /* ── SAVE ──────────────────────────── */
  function saveCSS(){
    var rules = [];
    Object.keys(savedData).forEach(function(sel){
      var props = [];
      Object.keys(savedData[sel]).forEach(function(p){
        props.push(p + ': ' + savedData[sel][p] + ' !important');
      });
      if(props.length) rules.push(sel + ' { ' + props.join('; ') + ' }');
    });
    var css = rules.join('\n');

    fetch('/api/save-editor-css', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({css: css, data: savedData})
    }).then(function(r){ return r.json(); }).then(function(d){
      setStatus('✅ Saved!');
      setTimeout(function(){ setStatus(editMode ? 'Editing' : 'Ready'); }, 2000);
    }).catch(function(e){ setStatus('❌ Error'); });
  }

  /* ── RESET ─────────────────────────── */
  function resetCSS(){
    if(!confirm('Reset semua perubahan?')) return;
    fetch('/api/save-editor-css',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({css:'', data:{}})
    }).then(function(){ location.reload(); });
  }

  /* ── LOAD ──────────────────────────── */
  function loadSaved(){
    fetch('/api/load-editor-css').then(function(r){ return r.json(); }).then(function(d){
      var data = d.data || d.rules || {};
      savedData = data;
      Object.keys(data).forEach(function(sel){
        var el;
        try { el = document.querySelector(sel); } catch(e){ return; }
        if(!el) return;
        Object.keys(data[sel]).forEach(function(p){
          el.style.setProperty(p, data[sel][p], 'important');
        });
      });
    }).catch(function(){});
  }

  /* ── HELPERS ───────────────────────── */
  function setStatus(t){ var s = document.getElementById('eb-status'); if(s) s.textContent = t; }
  function rgb2hex(c){
    if(!c || c==='transparent') return '#ffffff';
    var m = c.match(/\d+/g);
    if(!m||m.length<3) return '#ffffff';
    return '#'+m.slice(0,3).map(function(x){ return parseInt(x).toString(16).padStart(2,'0'); }).join('');
  }
  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Expose for external use
  window._editorToggle = toggleEdit;
  window._editorSave = saveCSS;
  window._editorReset = resetCSS;
})();
