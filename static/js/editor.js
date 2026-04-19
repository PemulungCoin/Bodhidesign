/* ═══════════════════════════════════════
   BODHI Visual Editor v3
   - True drag-and-drop (grab & move freely)
   - Hide/Show with hidden elements panel
   - Multi-theme persistence via data-edit
   ═══════════════════════════════════════ */
(function() {
    'use strict';

    // ─── STATE ───
    var editMode = false;
    var selectedEl = null;
    var savedData = {};     // { selector: { prop: val } }
    var hiddenSelectors = {}; // { selector: true } — track hidden elements
    var deletedSelectors = {}; // { selector: true } — track permanently deleted elements
    var history = [];
    var historyIdx = -1;

    // Drag state
    var isDragging = false;
    var dragEl = null;
    var dragStartX = 0, dragStartY = 0;
    var dragOrigTx = 0, dragOrigTy = 0;

    // ─── INIT ───
    var _inited = false;
    document.addEventListener('DOMContentLoaded', init);
    if (document.readyState !== 'loading') init();

    function init() {
        if (_inited) return;
        _inited = true;
        createBar();
        createPanel();
        loadSaved();
        restoreHidden();
        setupKeys();
    }

    // ─── EDITOR BAR (bottom) ───
    function createBar() {
        var bar = document.createElement('div');
        bar.id = 'editor-bar';
        bar.innerHTML =
            '<button id="eb-edit">✏️ Edit</button>' +
            '<button id="eb-hidden">🙈 Tersembunyi (<span id="hidden-count">0</span>)</button>' +
            '<button id="eb-deleted">🗑️ Terhapus (<span id="deleted-count">0</span>)</button>' +
            '<button id="eb-undo">↩️</button>' +
            '<button id="eb-redo">↪️</button>' +
            '<button class="save-btn" id="eb-save">💾 Simpan</button>' +
            '<button class="reset-btn" id="eb-reset">🔄 Reset</button>' +
            '<span class="status" id="eb-status">Ready</span>';
        document.body.appendChild(bar);

        document.getElementById('eb-edit').onclick = toggleEdit;
        document.getElementById('eb-hidden').onclick = showHiddenPanel;
        document.getElementById('eb-deleted').onclick = showDeletedPanel;
        document.getElementById('eb-save').onclick = saveLayout;
        document.getElementById('eb-reset').onclick = resetLayout;
        document.getElementById('eb-undo').onclick = undo;
        document.getElementById('eb-redo').onclick = redo;
    }

    // ─── PROPERTIES PANEL (right sidebar) ───
    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'props-panel';
        panel.innerHTML =
            '<div id="props-header">Properties</div>' +
            '<div id="props-body">' +
                '<div id="no-sel" style="padding:20px;text-align:center;color:#555;">' +
                    '<div style="font-size:36px;">👆</div>' +
                    '<p>Klik elemen untuk edit</p>' +
                '</div>' +
                '<div id="props-form" style="display:none;"></div>' +
            '</div>';
        document.body.appendChild(panel);
    }

    // ─── TOGGLE EDIT MODE ───
    function toggleEdit() {
        editMode = !editMode;
        document.body.classList.toggle('editor-on', editMode);
        var btn = document.getElementById('eb-edit');
        btn.textContent = editMode ? '✏️ Edit: ON' : '✏️ Edit';
        btn.classList.toggle('active', editMode);

        if (editMode) {
            document.addEventListener('click', onClick, true);
            document.addEventListener('mousedown', onDragStart, false);
            // Show hidden elements with special styling
            showHiddenInEdit();
            status('Edit ON — klik elemen, drag untuk geser');
        } else {
            deselect();
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('mousedown', onDragStart, false);
            hideHiddenAfterEdit();
            status('Edit OFF');
        }
    }

    // ─── CLICK TO SELECT ───
    function onClick(e) {
        if (!editMode) return;
        var el = e.target;

        // Skip editor UI elements
        if (el.closest('#editor-bar, #props-panel, #hidden-panel')) return;
        if (el === document.body || el === document.documentElement) return;
        if (el.classList.contains('editor-hidden-label')) return;

        // If dragging, don't select
        if (isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        deselect();
        selectedEl = el;
        el.classList.add('editor-selected');
        showProps(el);
    }

    function deselect() {
        if (selectedEl) {
            selectedEl.classList.remove('editor-selected');
            selectedEl.classList.remove('editor-dragging');
        }
        selectedEl = null;
        document.getElementById('no-sel').style.display = '';
        document.getElementById('props-form').style.display = 'none';
        // Remove panel if exists
        var dp = document.getElementById('hidden-panel');
        if (dp) dp.remove();
    }

    // ─── TRUE DRAG AND DROP ───
    function onDragStart(e) {
        if (!editMode) return;
        var el = e.target;
        if (el.closest('#editor-bar, #props-panel, #hidden-panel')) return;
        if (el === document.body || el === document.documentElement) return;

        // Only start drag if clicking on a data-edit element or its children
        var target = el.closest('[data-edit]') || el;
        if (!target || target === document.body) return;

        isDragging = false;
        dragEl = target;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        // Read current translate values
        var t = target.style.transform || '';
        var mx = t.match(/translateX\(([^)]+)px\)/);
        var my = t.match(/translateY\(([^)]+)px\)/);
        dragOrigTx = mx ? parseFloat(mx[1]) : 0;
        dragOrigTy = my ? parseFloat(my[1]) : 0;

        document.addEventListener('mousemove', onDragMove, true);
        document.addEventListener('mouseup', onDragEnd, true);
    }

    function onDragMove(e) {
        if (!dragEl) return;

        var dx = e.clientX - dragStartX;
        var dy = e.clientY - dragStartY;

        // Threshold to start actual drag (3px)
        if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            isDragging = true;
            dragEl.classList.add('editor-dragging');
        }

        if (!isDragging) return;
        e.preventDefault();

        var newTx = dragOrigTx + dx;
        var newTy = dragOrigTy + dy;

        // Apply transform
        var parts = [];
        if (newTx !== 0) parts.push('translateX(' + newTx + 'px)');
        if (newTy !== 0) parts.push('translateY(' + newTy + 'px)');
        dragEl.style.transform = parts.join(' ');

        // Update panel if this element is selected
        if (selectedEl === dragEl) {
            updateDragValues(newTx, newTy);
        }
    }

    function onDragEnd(e) {
        document.removeEventListener('mousemove', onDragMove, true);
        document.removeEventListener('mouseup', onDragEnd, true);

        if (isDragging && dragEl) {
            dragEl.classList.remove('editor-dragging');
            var sel = getSelector(dragEl);
            var t = dragEl.style.transform || '';
            var mx = t.match(/translateX\(([^)]+)px\)/);
            var my = t.match(/translateY\(([^)]+)px\)/);
            track(sel, 'transform', t);
            saveHistory();
            status('📍 Dipindah');
        }

        // Reset drag state after a tick (so onClick doesn't fire)
        setTimeout(function() { isDragging = false; }, 10);
        dragEl = null;
    }

    function updateDragValues(tx, ty) {
        var txEl = document.getElementById('pp-tx');
        var tyEl = document.getElementById('pp-ty');
        if (txEl) txEl.value = Math.round(tx);
        if (tyEl) tyEl.value = Math.round(ty);
    }

    // ─── PROPERTIES PANEL ───
    function showProps(el) {
        document.getElementById('no-sel').style.display = 'none';
        var form = document.getElementById('props-form');
        form.style.display = '';

        var cs = window.getComputedStyle(el);
        var tag = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') tag += '.' + el.className.trim().split(/\s+/)[0];
        if (el.id) tag += '#' + el.id;

        var isText = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','LI','BUTTON','LABEL','STRONG'].indexOf(el.tagName) >= 0;
        var isImg = el.tagName === 'IMG';

        // Read current translate
        var t = el.style.transform || '';
        var mx = t.match(/translateX\(([^)]+)px\)/);
        var my = t.match(/translateY\(([^)]+)px\)/);
        var tx = mx ? parseFloat(mx[1]) : 0;
        var ty = my ? parseFloat(my[1]) : 0;

        var html = '<div class="prop-row-title">📍 Elemen</div>';
        html += '<div class="prop-row"><label><span>Tag</span><input type="text" value="' + esc(tag) + '" readonly style="background:#0a0a15;color:#a78bfa;border:1px solid #2a2745;padding:4px 8px;border-radius:4px;font-size:11px;width:100%;"></label></div>';

        if (isText) {
            html += '<div class="prop-row-title">📝 Teks</div>';
            html += '<div class="prop-row"><label><span>Isi</span><input type="text" id="pp-text" value="' + esc(el.textContent.trim().substring(0, 100)) + '" style="width:100%;background:#0a0a15;color:#e2e8f0;border:1px solid #2a2745;padding:4px 8px;border-radius:4px;font-size:11px;"></label></div>';
            html += '<div class="prop-row"><label><span>Size</span><input type="range" id="pp-fs" min="8" max="120" value="' + (parseInt(cs.fontSize) || 16) + '"><span class="val-display" id="pp-fs-v">' + (parseInt(cs.fontSize) || 16) + 'px</span></label></div>';
            html += '<div class="prop-row"><label><span>Weight</span><select id="pp-fw" style="flex:1;background:#0a0a15;color:#e2e8f0;border:1px solid #2a2745;padding:4px;border-radius:4px;font-size:11px;"><option value=""' + (!cs.fontWeight || cs.fontWeight === '400' ? ' selected' : '') + '>Default</option><option value="300"' + (cs.fontWeight === '300' ? ' selected' : '') + '>Light</option><option value="600"' + (cs.fontWeight === '600' ? ' selected' : '') + '>Semi</option><option value="700"' + (cs.fontWeight === '700' ? ' selected' : '') + '>Bold</option><option value="800"' + (cs.fontWeight === '800' ? ' selected' : '') + '>Extra</option></select></label></div>';
            html += '<div class="prop-row"><label><span>Warna</span><input type="color" id="pp-color" value="' + rgbToHex(cs.color) + '" style="width:28px;height:28px;border:2px solid #2a2745;border-radius:4px;background:none;padding:0;"></label></div>';
            html += '<div class="prop-row"><label><span>Align</span><select id="pp-align" style="flex:1;background:#0a0a15;color:#e2e8f0;border:1px solid #2a2745;padding:4px;border-radius:4px;font-size:11px;"><option value=""' + (cs.textAlign === 'start' ? ' selected' : '') + '>Default</option><option value="left"' + (cs.textAlign === 'left' ? ' selected' : '') + '>Kiri</option><option value="center"' + (cs.textAlign === 'center' ? ' selected' : '') + '>Tengah</option><option value="right"' + (cs.textAlign === 'right' ? ' selected' : '') + '>Kanan</option></select></label></div>';
        }

        if (isImg) {
            html += '<div class="prop-row-title">🖼️ Gambar</div>';
            html += '<div class="prop-row"><label><span>Width</span><input type="range" id="pp-imgw" min="20" max="1200" value="' + (el.offsetWidth || 300) + '"><span class="val-display" id="pp-imgw-v">' + (el.offsetWidth || 300) + 'px</span></label></div>';
            html += '<div class="prop-row"><label><span>Upload</span><input type="file" id="pp-imgfile" accept="image/*" style="flex:1;font-size:11px;color:#94a3b8;"></label></div>';
        }

        html += '<div class="prop-row-title">🎨 Style</div>';
        html += '<div class="prop-row"><label><span>BG</span><input type="color" id="pp-bg" value="' + rgbToHex(cs.backgroundColor) + '" style="width:28px;height:28px;border:2px solid #2a2745;border-radius:4px;background:none;padding:0;"></label></div>';
        html += '<div class="prop-row"><label><span>Radius</span><input type="range" id="pp-radius" min="0" max="100" value="' + (parseInt(cs.borderRadius) || 0) + '"><span class="val-display" id="pp-radius-v">' + (parseInt(cs.borderRadius) || 0) + 'px</span></label></div>';
        html += '<div class="prop-row"><label><span>Opacity</span><input type="range" id="pp-opacity" min="0" max="100" value="' + Math.round(parseFloat(cs.opacity) * 100) + '"><span class="val-display" id="pp-opacity-v">' + Math.round(parseFloat(cs.opacity) * 100) + '%</span></label></div>';

        html += '<div class="prop-row-title">📐 Posisi & Spacing</div>';
        html += '<div class="prop-row"><label><span>↔ Drag X</span><input type="range" id="pp-tx" min="-800" max="800" value="' + Math.round(tx) + '"><span class="val-display" id="pp-tx-v">' + Math.round(tx) + 'px</span></label></div>';
        html += '<div class="prop-row"><label><span>↕ Drag Y</span><input type="range" id="pp-ty" min="-800" max="800" value="' + Math.round(ty) + '"><span class="val-display" id="pp-ty-v">' + Math.round(ty) + 'px</span></label></div>';
        html += '<div class="prop-row"><label><span>Margin T</span><input type="range" id="pp-mt" min="-100" max="200" value="' + (parseInt(cs.marginTop) || 0) + '"><span class="val-display" id="pp-mt-v">' + (parseInt(cs.marginTop) || 0) + 'px</span></label></div>';
        html += '<div class="prop-row"><label><span>Margin B</span><input type="range" id="pp-mb" min="-100" max="200" value="' + (parseInt(cs.marginBottom) || 0) + '"><span class="val-display" id="pp-mb-v">' + (parseInt(cs.marginBottom) || 0) + 'px</span></label></div>';
        html += '<div class="prop-row"><label><span>Padding</span><input type="range" id="pp-pad" min="0" max="100" value="' + (parseInt(cs.paddingTop) || 0) + '"><span class="val-display" id="pp-pad-v">' + (parseInt(cs.paddingTop) || 0) + 'px</span></label></div>';
        html += '<div class="prop-row"><label><span>Width</span><input type="text" id="pp-width" value="' + (el.style.width || '') + '" placeholder="auto" style="flex:1;background:#0a0a15;color:#e2e8f0;border:1px solid #2a2745;padding:4px 8px;border-radius:4px;font-size:11px;"></label></div>';

        html += '<div class="prop-row-title">⚡ Aksi</div>';
        html += '<div style="display:flex;gap:6px;padding:4px 14px;">';
        html += '<button class="action" id="pp-hide" style="flex:1;background:#7f1d1d;border-color:#dc2626;color:#f87171;">🙈 Sembunyikan</button>';
        html += '<button class="action" id="pp-delete" style="flex:1;background:#450a0a;border-color:#991b1b;color:#fca5a5;">🗑️ Hapus</button>';
        html += '<button class="action" id="pp-reset-pos" style="flex:1;">↩️ Reset</button>';
        html += '</div>';

        form.innerHTML = html;

        // Bind change handlers
        var self = el;
        function onPropChange(inputId, prop, unit, wrapper) {
            var inp = document.getElementById(inputId);
            if (!inp) return;
            var valDisp = document.getElementById(inputId + '-v');

            inp.oninput = function() {
                var v = parseFloat(this.value) || 0;
                if (valDisp) valDisp.textContent = v + (unit || '');
                var val = wrapper ? wrapper + '(' + v + 'px)' : (v + (unit || ''));
                if (unit === '%') val = v / 100;
                if (!unit && !wrapper) val = this.value;
                self.style.setProperty(prop, val, 'important');
                var sel2 = getSelector(self);
                track(sel2, prop, val);
            };
        }

        onPropChange('pp-fs', 'font-size', 'px');
        onPropChange('pp-radius', 'border-radius', 'px');
        onPropChange('pp-opacity', 'opacity', '%');
        onPropChange('pp-mt', 'margin-top', 'px');
        onPropChange('pp-mb', 'margin-bottom', 'px');
        onPropChange('pp-pad', 'padding', 'px');
        onPropChange('pp-imgw', 'width', 'px');

        // Transform (drag position)
        var txInp = document.getElementById('pp-tx');
        var tyInp = document.getElementById('pp-ty');
        var txV = document.getElementById('pp-tx-v');
        var tyV = document.getElementById('pp-ty-v');

        function updateTransform() {
            var x = parseFloat(txInp.value) || 0;
            var y = parseFloat(tyInp.value) || 0;
            if (txV) txV.textContent = x + 'px';
            if (tyV) tyV.textContent = y + 'px';
            var parts = [];
            if (x !== 0) parts.push('translateX(' + x + 'px)');
            if (y !== 0) parts.push('translateY(' + y + 'px)');
            self.style.transform = parts.join(' ');
            var sel3 = getSelector(self);
            track(sel3, 'transform', self.style.transform);
        }
        if (txInp) txInp.oninput = updateTransform;
        if (tyInp) tyInp.oninput = updateTransform;

        // Text content
        var textInp = document.getElementById('pp-text');
        if (textInp) {
            textInp.oninput = function() {
                self.textContent = this.value;
                var sel4 = getSelector(self);
                track(sel4, 'content', this.value);
            };
        }

        // Font weight
        var fwSel = document.getElementById('pp-fw');
        if (fwSel) {
            fwSel.onchange = function() {
                self.style.fontWeight = this.value;
                var sel5 = getSelector(self);
                track(sel5, 'font-weight', this.value);
            };
        }

        // Color
        var colInp = document.getElementById('pp-color');
        if (colInp) {
            colInp.oninput = function() {
                self.style.color = this.value;
                var sel6 = getSelector(self);
                track(sel6, 'color', this.value);
            };
        }

        // BG color
        var bgInp = document.getElementById('pp-bg');
        if (bgInp) {
            bgInp.oninput = function() {
                self.style.backgroundColor = this.value;
                var sel7 = getSelector(self);
                track(sel7, 'background-color', this.value);
            };
        }

        // Align
        var alignSel = document.getElementById('pp-align');
        if (alignSel) {
            alignSel.onchange = function() {
                self.style.textAlign = this.value;
                var sel8 = getSelector(self);
                track(sel8, 'text-align', this.value);
            };
        }

        // Width
        var wInp = document.getElementById('pp-width');
        if (wInp) {
            wInp.onchange = function() {
                self.style.width = this.value;
                var sel9 = getSelector(self);
                track(sel9, 'width', this.value);
            };
        }

        // Image upload
        var imgFile = document.getElementById('pp-imgfile');
        if (imgFile) {
            imgFile.onchange = function() {
                if (!this.files || !this.files[0]) return;
                var fd = new FormData();
                fd.append('image', this.files[0]);
                fetch('/api/upload-image', { method: 'POST', body: fd })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    self.src = d.url;
                    status('🖼️ Gambar diupload');
                })
                .catch(function(e) { status('❌ Upload gagal: ' + e.message); });
            };
        }

        // Image width slider
        var imgwInp = document.getElementById('pp-imgw');
        if (imgwInp) {
            imgwInp.oninput = function() {
                self.style.width = this.value + 'px';
                self.style.height = 'auto';
                var imgwV = document.getElementById('pp-imgw-v');
                if (imgwV) imgwV.textContent = this.value + 'px';
                var sel10 = getSelector(self);
                track(sel10, 'width', this.value + 'px');
            };
        }

        // Hide button
        var hideBtn = document.getElementById('pp-hide');
        if (hideBtn) {
            hideBtn.onclick = function() {
                var target = self.closest('[data-edit]') || self;
                var sel11 = getSelector(target);
                hiddenSelectors[sel11] = true;
                target.style.setProperty('display', 'none', 'important');
                target.classList.add('editor-hidden-visible');
                target.style.removeProperty('display');
                updateHiddenCount();
                deselect();
                status('🙈 Disembunyikan — klik "Tersembunyi" untuk tampilkan lagi');
            };
        }

        // Delete button (permanent)
        var deleteBtn = document.getElementById('pp-delete');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                var target = self.closest('[data-edit]') || self;
                var selDel = getSelector(target);
                if (!confirm('Hapus permanen elemen ini?\n\n(' + selDel + ')\n\nKlik "Terhapus" di bar bawah untuk restore.')) return;
                deletedSelectors[selDel] = true;
                target.remove();
                updateHiddenCount();
                deselect();
                status('🗑️ Dihapus — klik "Terhapus" untuk restore');
            };
        }

        // Reset position button
        var resetBtn = document.getElementById('pp-reset-pos');
        if (resetBtn) {
            resetBtn.onclick = function() {
                self.style.transform = '';
                self.style.marginTop = '';
                self.style.marginBottom = '';
                self.style.marginLeft = '';
                self.style.marginRight = '';
                var sel12 = getSelector(self);
                track(sel12, 'transform', '');
                showProps(self);
                status('↩️ Posisi direset');
            };
        }
    }

    // ─── HIDDEN ELEMENTS PANEL ───
    function showHiddenPanel() {
        // Remove existing panel
        var old = document.getElementById('hidden-panel');
        if (old) old.remove();

        var panel = document.createElement('div');
        panel.id = 'hidden-panel';
        panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;max-height:70vh;background:#110f1f;border:1px solid #2a2745;border-radius:12px;z-index:100000;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

        var keys = Object.keys(hiddenSelectors);
        var html = '<div style="padding:16px 20px;background:#0f0d1a;border-bottom:1px solid #2a2745;display:flex;justify-content:space-between;align-items:center;">';
        html += '<strong style="color:#f59e0b;">🙈 Elemen Tersembunyi (' + keys.length + ')</strong>';
        html += '<button id="hp-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>';
        html += '</div><div style="padding:12px;overflow-y:auto;max-height:50vh;">';

        if (keys.length === 0) {
            html += '<div style="text-align:center;padding:30px;color:#555;">Tidak ada elemen tersembunyi</div>';
        } else {
            keys.forEach(function(sel, i) {
                // Try to get element text for label
                var label = sel;
                try {
                    var el = document.querySelector(sel);
                    if (el) {
                        var txt = el.textContent.trim().substring(0, 40);
                        if (txt) label = txt + ' (' + sel.substring(0, 30) + ')';
                    }
                } catch(e) {}

                html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #1a1a2e;">';
                html += '<span style="flex:1;font-size:12px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(label) + '</span>';
                html += '<button class="hp-show" data-sel="' + esc(sel) + '" style="background:#065f46;border:1px solid #059669;color:#34d399;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">👁️ Tampilkan</button>';
                html += '</div>';
            });
        }

        html += '</div>';
        panel.innerHTML = html;
        document.body.appendChild(panel);

        // Bind close
        document.getElementById('hp-close').onclick = function() { panel.remove(); };

        // Bind show buttons
        panel.querySelectorAll('.hp-show').forEach(function(btn) {
            btn.onclick = function() {
                var sel = this.dataset.sel;
                delete hiddenSelectors[sel];
                // Remove inline display:none
                try {
                    document.querySelectorAll(sel).forEach(function(el) {
                        el.style.removeProperty('display');
                        el.classList.remove('editor-hidden-visible');
                    });
                } catch(e) {}
                updateHiddenCount();
                this.closest('div').remove();
                status('👁️ Ditampilkan: ' + sel);
                if (Object.keys(hiddenSelectors).length === 0) {
                    panel.querySelector('div[style]').textContent = 'Tidak ada elemen tersembunyi';
                }
            };
        });
    }

    // ─── DELETED ELEMENTS PANEL ───
    function showDeletedPanel() {
        var old = document.getElementById('deleted-panel');
        if (old) old.remove();

        var panel = document.createElement('div');
        panel.id = 'deleted-panel';
        panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;max-height:70vh;background:#110f1f;border:1px solid #2a2745;border-radius:12px;z-index:100000;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

        var keys = Object.keys(deletedSelectors);
        var html = '<div style="padding:16px 20px;background:#0f0d1a;border-bottom:1px solid #2a2745;display:flex;justify-content:space-between;align-items:center;">';
        html += '<strong style="color:#f87171;">🗑️ Elemen Terhapus (' + keys.length + ')</strong>';
        html += '<button id="dp-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>';
        html += '</div><div style="padding:12px;overflow-y:auto;max-height:50vh;">';

        if (keys.length === 0) {
            html += '<div style="text-align:center;padding:30px;color:#555;">Tidak ada elemen terhapus</div>';
        } else {
            keys.forEach(function(sel) {
                html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #1a1a2e;">';
                html += '<span style="flex:1;font-size:12px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(sel) + '</span>';
                html += '<button class="dp-restore" data-sel="' + esc(sel) + '" style="background:#065f46;border:1px solid #059669;color:#34d399;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">♻️ Restore</button>';
                html += '</div>';
            });
        }

        html += '</div>';
        panel.innerHTML = html;
        document.body.appendChild(panel);

        document.getElementById('dp-close').onclick = function() { panel.remove(); };

        panel.querySelectorAll('.dp-restore').forEach(function(btn) {
            btn.onclick = function() {
                var sel = this.dataset.sel;
                delete deletedSelectors[sel];
                updateHiddenCount();
                this.closest('div').remove();
                status('♻️ Direstore: ' + sel + ' — Save & refresh');
                if (Object.keys(deletedSelectors).length === 0) {
                    panel.querySelector('div[style]').textContent = 'Tidak ada elemen terhapus';
                }
            };
        });
    }

    function updateHiddenCount() {
        var el = document.getElementById('hidden-count');
        if (el) el.textContent = Object.keys(hiddenSelectors).length;
        var dl = document.getElementById('deleted-count');
        if (dl) dl.textContent = Object.keys(deletedSelectors).length;
    }

    // ─── SHOW/HIDDEN ELEMENTS IN EDIT MODE ───
    function showHiddenInEdit() {
        Object.keys(hiddenSelectors).forEach(function(sel) {
            try {
                document.querySelectorAll(sel).forEach(function(el) {
                    // Temporarily show the element
                    el.classList.add('editor-hidden-visible');
                });
            } catch(e) {}
        });
        // Show deleted elements with red indicator
        Object.keys(deletedSelectors).forEach(function(sel) {
            try {
                document.querySelectorAll(sel).forEach(function(el) {
                    el.style.removeProperty('display');
                    el.classList.add('editor-deleted-visible');
                });
            } catch(e) {}
        });
    }

    function hideHiddenAfterEdit() {
        document.querySelectorAll('.editor-hidden-visible').forEach(function(el) {
            el.classList.remove('editor-hidden-visible');
            el.style.setProperty('display', 'none', 'important');
        });
        document.querySelectorAll('.editor-deleted-visible').forEach(function(el) {
            el.classList.remove('editor-deleted-visible');
            el.style.setProperty('display', 'none', 'important');
        });
    }

    // ─── RESTORE HIDDEN ON PAGE LOAD ───
    function restoreHidden() {
        Object.keys(hiddenSelectors).forEach(function(sel) {
            try {
                document.querySelectorAll(sel).forEach(function(el) {
                    el.style.setProperty('display', 'none', 'important');
                });
            } catch(e) {}
        });
    }

    // ─── SELECTOR GENERATOR ───
    function getSelector(el) {
        // Prefer data-edit attribute (works across ALL themes)
        if (el.hasAttribute('data-edit')) {
            return '[data-edit="' + el.getAttribute('data-edit') + '"]';
        }
        if (el.id) return '#' + el.id;
        // Fallback: stable DOM path
        var path = [];
        var node = el;
        while (node && node !== document.body) {
            var part = node.tagName.toLowerCase();
            if (node.id) { path.unshift('#' + node.id); break; }
            if (node.className && typeof node.className === 'string') {
                var cls = node.className.trim().split(/\s+/).filter(function(c) {
                    return c && !c.startsWith('editor-') && !c.startsWith('bodhi-');
                })[0];
                if (cls) part += '.' + cls;
            }
            var parent = node.parentElement;
            if (parent) {
                var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === node.tagName; });
                if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
            }
            path.unshift(part);
            node = node.parentElement;
        }
        return path.join(' > ');
    }

    // ─── SAVE / LOAD ───
    function track(sel, prop, val) {
        if (!savedData[sel]) savedData[sel] = {};
        savedData[sel][prop] = val;
    }

    function saveLayout() {
        // Build CSS from savedData
        var cssLines = [];
        var rules = [];
        var textContents = {}; // { selector: text } — saved separately from CSS
        for (var sel in savedData) {
            var props = savedData[sel];
            var cssParts = [];
            for (var p in props) {
                var v = props[p];
                if (p === 'content') {
                    // Text content — save separately, not as CSS
                    textContents[sel] = v;
                    continue;
                }
                if (v !== '' && v !== null && v !== undefined) {
                    cssParts.push(p + ': ' + v + ' !important');
                }
            }
            if (cssParts.length > 0) {
                cssLines.push(sel + ' { ' + cssParts.join('; ') + '; }');
                rules.push({ selector: sel, css: cssParts.join('; ') });
            }
        }

        // Add hidden elements to CSS
        for (var hSel in hiddenSelectors) {
            cssLines.push(hSel + ' { display: none !important; }');
            rules.push({ selector: hSel, css: 'display: none !important' });
        }

        // Add deleted elements to CSS (display:none on normal page)
        for (var dSel in deletedSelectors) {
            cssLines.push(dSel + ' { display: none !important; }');
            rules.push({ selector: dSel, css: 'display: none !important; /* deleted */' });
        }

        var cssText = cssLines.join('\n');

        // Don't overwrite with empty data
        if (!cssText.trim() && Object.keys(textContents).length === 0) {
            status('ℹ️ Tidak ada perubahan');
            return;
        }

        fetch('/api/save-editor-css', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ css: cssText, rules: rules, textContents: textContents })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            saveHistory();
            status('💾 Disimpan! ' + rules.length + ' rules');
        })
        .catch(function(e) { status('❌ Error: ' + e.message); });
    }

    function loadSaved() {
        fetch('/api/load-editor-css')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.rules) {
                // Handle both array format and object format
                if (Array.isArray(data.rules)) {
                    data.rules.forEach(function(rule) {
                        if (rule.selector && rule.css) {
                            // Check if marked as deleted
                            if (rule.css.indexOf('/* deleted */') >= 0) {
                                deletedSelectors[rule.selector] = true;
                                // Hide on page load (element still in DOM)
                                try {
                                    document.querySelectorAll(rule.selector).forEach(function(el) {
                                        el.style.setProperty('display', 'none', 'important');
                                    });
                                } catch(e) {}
                                return;
                            }
                            if (!savedData[rule.selector]) savedData[rule.selector] = {};
                            // Parse CSS string into properties
                            rule.css.split(';').forEach(function(part) {
                                var kv = part.split(':');
                                if (kv.length >= 2) {
                                    var k = kv[0].trim();
                                    var v = kv.slice(1).join(':').trim().replace(/\s*!important\s*$/, '');
                                    if (k === 'display' && v === 'none') {
                                        hiddenSelectors[rule.selector] = true;
                                    } else {
                                        savedData[rule.selector][k] = v;
                                    }
                                }
                            });
                        }
                    });
                } else if (typeof data.rules === 'object') {
                    // Object format: { selector: "css" }
                    for (var sel in data.rules) {
                        var cssStr = data.rules[sel];
                        // Check if marked as deleted
                        if (cssStr.indexOf('/* deleted */') >= 0) {
                            deletedSelectors[sel] = true;
                            // Hide on page load
                            try {
                                document.querySelectorAll(sel).forEach(function(el) {
                                    el.style.setProperty('display', 'none', 'important');
                                });
                            } catch(e) {}
                            continue;
                        }
                        if (!savedData[sel]) savedData[sel] = {};
                        cssStr.split(';').forEach(function(part) {
                            var kv = part.split(':');
                            if (kv.length >= 2) {
                                var k = kv[0].trim();
                                var v = kv.slice(1).join(':').trim().replace(/\s*!important\s*$/, '');
                                if (k === 'display' && v === 'none') {
                                    hiddenSelectors[sel] = true;
                                } else {
                                    savedData[sel][k] = v;
                                }
                            }
                        });
                    }
                }

                // Apply to DOM
                for (var applySel in savedData) {
                    try {
                        document.querySelectorAll(applySel).forEach(function(el) {
                            for (var p in savedData[applySel]) {
                                el.style.setProperty(p, savedData[applySel][p], 'important');
                            }
                        });
                    } catch(e) {}
                }

                // Apply text contents
                if (data.textContents) {
                    for (var tcSel in data.textContents) {
                        try {
                            document.querySelectorAll(tcSel).forEach(function(el) {
                                el.textContent = data.textContents[tcSel];
                            });
                        } catch(e) {}
                        // Also save to savedData so editor panel shows correct text
                        if (!savedData[tcSel]) savedData[tcSel] = {};
                        savedData[tcSel]['content'] = data.textContents[tcSel];
                    }
                }

                updateHiddenCount();
            }
        })
        .catch(function() {});
    }

    function resetLayout() {
        if (!confirm('Reset semua perubahan?')) return;
        fetch('/api/reset-editor-css', { method: 'POST' })
        .then(function() {
            savedData = {};
            hiddenSelectors = {};
            deletedSelectors = {};
            updateHiddenCount();
            location.reload();
        });
    }

    // ─── HISTORY ───
    function saveHistory() {
        historyIdx++;
        history = history.slice(0, historyIdx);
        history.push(JSON.stringify({ saved: savedData, hidden: hiddenSelectors, deleted: deletedSelectors }));
    }

    function undo() {
        if (historyIdx <= 0) return;
        historyIdx--;
        restoreHistory();
    }

    function redo() {
        if (historyIdx >= history.length - 1) return;
        historyIdx++;
        restoreHistory();
    }

    function restoreHistory() {
        var snap = JSON.parse(history[historyIdx] || '{}');
        savedData = snap.saved || {};
        hiddenSelectors = snap.hidden || {};
        deletedSelectors = snap.deleted || {};
        updateHiddenCount();
        // Re-apply
        document.querySelectorAll('[style]').forEach(function(el) {
            el.removeAttribute('style');
        });
        for (var sel in savedData) {
            try {
                document.querySelectorAll(sel).forEach(function(el) {
                    for (var p in savedData[sel]) {
                        el.style.setProperty(p, savedData[sel][p], 'important');
                    }
                });
            } catch(e) {}
        }
    }

    // ─── KEYBOARD ───
    function setupKeys() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveLayout(); }
            if (e.key === 'Escape') { deselect(); var hp = document.getElementById('hidden-panel'); if (hp) hp.remove(); }
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }

            // Arrow keys to move selected element
            if (selectedEl && editMode) {
                var step = e.shiftKey ? 10 : 1;
                var t = selectedEl.style.transform || '';
                var mx = t.match(/translateX\(([^)]+)px\)/);
                var my = t.match(/translateY\(([^)]+)px\)/);
                var tx = mx ? parseFloat(mx[1]) : 0;
                var ty = my ? parseFloat(my[1]) : 0;
                var moved = false;

                if (e.key === 'ArrowLeft') { tx -= step; moved = true; }
                if (e.key === 'ArrowRight') { tx += step; moved = true; }
                if (e.key === 'ArrowUp') { ty -= step; moved = true; }
                if (e.key === 'ArrowDown') { ty += step; moved = true; }

                if (moved) {
                    e.preventDefault();
                    var parts = [];
                    if (tx !== 0) parts.push('translateX(' + tx + 'px)');
                    if (ty !== 0) parts.push('translateY(' + ty + 'px)');
                    selectedEl.style.transform = parts.join(' ');
                    updateDragValues(tx, ty);
                    var sel = getSelector(selectedEl);
                    track(sel, 'transform', selectedEl.style.transform);
                }
            }
        });
    }

    // ─── HELPERS ───
    function status(msg) {
        var el = document.getElementById('eb-status');
        if (el) el.textContent = msg;
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '#ffffff';
        var m = rgb.match(/\d+/g);
        if (!m || m.length < 3) return '#ffffff';
        return '#' + m.slice(0, 3).map(function(x) { return parseInt(x).toString(16).padStart(2, '0'); }).join('');
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

})();
