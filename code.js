/*
 Texting Block Insert - code.js
 - Detects [[texting]]...[[/texting]] or single [[texting]] markers in newly added message nodes
 - If inner HTML already contains a .chat-body/.chatbox structure, it simply wraps it in a .texting-block container
 - Otherwise it will parse a simple plain-text format of lines like "noah: hello" or "eden: hi" into message divs
 - Names and times will be generated automatically; consecutive messages by the same sender will omit repeated meta lines
*/

(function () {
  const TIME_OPTIONS = { hour: 'numeric', minute: '2-digit', hour12: true };

  function formatTime(date) {
    try {
      return new Intl.DateTimeFormat(undefined, TIME_OPTIONS).format(date);
    } catch (e) {
      // fallback simple 12h format
      let h = date.getHours();
      const m = date.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
  }

  function createTextingHTMLFromPlain(lines, defaultChar, defaultUser) {
    // lines: array of "name: message" strings
    let lastSender = null;
    const parts = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // match "name: message" (first colon)
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (!m) {
        // if line has no colon, treat as continued text from last sender
        if (lastSender && parts.length) {
          parts[parts.length - 1].text += "\n" + line;
        }
        continue;
      }
      const name = m[1].trim();
      const text = m[2].trim();
      // determine left/right by matching to defaultChar or defaultUser (case-insensitive)
      let side = 'left';
      if (defaultUser && name.toLowerCase() === defaultUser.toLowerCase()) side = 'right';
      else if (defaultChar && name.toLowerCase() === defaultChar.toLowerCase()) side = 'left';
      else {
        // if name doesn't match known actors, choose left for others
        side = 'left';
      }

      const time = formatTime(new Date());
      if (lastSender && lastSender === name) {
        // append without meta
        parts.push({ name, text, side, time, repeatMeta: false });
      } else {
        parts.push({ name, text, side, time, repeatMeta: true });
      }
      lastSender = name;
    }

    // build HTML
    const htmlParts = [];
    for (const p of parts) {
      const metaHtml = p.repeatMeta ? `<div class="meta"><span class="name">${escapeHtml(p.name)}</span><span class="dot">•</span><span class="time">${p.time}</span></div>` : '';
      htmlParts.push(`<div class="message ${p.side}">${metaHtml}<div class="bubble ${p.side}">${escapeHtml(p.text)}</div></div>`);
    }
    return htmlParts.join("\n");
  }

  function escapeHtml(s) {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  function buildTextingBlock(innerHtml) {
    // If innerHtml already contains .chatbox or .chat-body, keep it and just wrap
    if (/\bclass=["']?(?:[^"'>]*\bchatbox\b|[^"'>]*\bchat-body\b)/i.test(innerHtml)) {
      return `<div class="texting-block">${innerHtml}</div>`;
    }

    // Otherwise, if innerHtml contains HTML elements, try to use them directly
    if (/<[^>]+>/.test(innerHtml)) {
      return `<div class="texting-block"><div class="chatbox"><div class="header"><strong>${getCharacterOrPlaceholder()} ↔ ${getUserOrPlaceholder()}</strong></div><div class="chat-body">${innerHtml}</div></div></div>`;
    }

    // Plain text fallback: parse lines like "name: message"
    const lines = innerHtml.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = createTextingHTMLFromPlain(lines, getCharacterOrPlaceholder(), getUserOrPlaceholder());
    return `<div class="texting-block"><div class="chatbox"><div class="header"><strong>${getCharacterOrPlaceholder()} ↔ ${getUserOrPlaceholder()}</strong></div><div class="chat-body">${parsed}</div></div></div>`;
  }

  function getCharacterOrPlaceholder() {
    // try common globals used in ST/Guinevere; fallback to "{{char}}"
    return (window.active_character_name || window.active_character || window.current_character_name || "{{char}}");
  }
  function getUserOrPlaceholder() {
    return (window.main_api_user || window.userName || window.username || "{{user}}");
  }

  function processNode(node) {
    try {
      // Some themes put message text inside .mes .mes__text or .mes_text or .mes .mes__body etc.
      // Find any descendant text-containing elements
      const textEls = node.querySelectorAll && node.querySelectorAll('.mes_text, .mes__text, .mes__body, .mes p, .mes, .message__text, .st-block, .text');
      // Use the node itself as fallback
      const candidates = textEls && textEls.length ? textEls : [node];

      candidates.forEach(el => {
        const html = el.innerHTML;
        if (!html) return;
        let replaced = html;
        // pattern: [[texting]] ... [[/texting]]
        const reBlock = /\\[\\[texting\\]\\]([\\s\\S]*?)\\[\\[\\/texting\\]\\]/gi;
        if (reBlock.test(html)) {
          replaced = html.replace(reBlock, function(_, inner) {
            return buildTextingBlock(inner.trim());
          });
        } else {
          // single marker [[texting]] followed by some text until end
          const reSingle = /\\[\\[texting\\]\\]\\s*([\\s\\S]*)/i;
          if (reSingle.test(html)) {
            replaced = html.replace(reSingle, function(_, inner) {
              return buildTextingBlock(inner.trim());
            });
          }
        }
        if (replaced !== html) {
          el.innerHTML = replaced;
        }
      });
    } catch (e) {
      console.error("[Texting Block] processNode error", e);
    }
  }

  // Observe newly added message nodes
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        // If node looks like a chat message section
        if (n.matches && (n.matches('.mes') || n.matches('.mes_text') || n.matches('.st-block') || n.matches('.message'))) {
          processNode(n);
        } else {
          // also process descendants to catch messages inside wrappers
          const mes = n.querySelector && (n.querySelector('.mes') || n.querySelector('.mes_text') || n.querySelector('.st-block') || n.querySelector('.message'));
          if (mes) processNode(n);
        }
      }
    }
  });

  // Also run an initial pass on existing nodes
  function initialPass() {
    const all = document.querySelectorAll('.mes, .mes_text, .st-block, .message, .mes__text, .mes__body');
    all.forEach(n => processNode(n));
  }

  observer.observe(document.body, { childList: true, subtree: true });

  // run initial pass shortly after load
  setTimeout(initialPass, 500);
})();