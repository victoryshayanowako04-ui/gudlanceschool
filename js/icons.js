(function () {
    const iconMap = {
        '🏠': 'house', '⚙️': 'settings', '📝': 'file-pen-line', '🌱': 'sprout',
        '👨‍🏫': 'presentation', '👩‍🏫': 'presentation', '👨‍👩‍👧': 'users-round',
        '📅': 'calendar-days', '💰': 'wallet', '👕': 'shirt', '📚': 'book-open',
        '💼': 'briefcase-business', '↩️': 'undo-2', '🚪': 'log-out', '🔄': 'refresh-cw',
        '🔃': 'refresh-cw', '☁️': 'cloud', '🌐': 'globe', '⚠️': 'triangle-alert',
        '📋': 'clipboard-list', '📥': 'inbox', '📱': 'smartphone', '📸': 'camera',
        '🤖': 'bot', '🖨️': 'printer', '🗑️': 'trash-2', '💾': 'save', '🏫': 'school',
        '📊': 'bar-chart-3', '👁️': 'eye', '🔍': 'search', '🔎': 'search',
        '✅': 'circle-check', '❌': 'circle-x', '❎': 'circle-x', '✔️': 'check', '✖️': 'x',
        '➕': 'circle-plus', '➖': 'circle-minus', '⚡': 'zap', '🔒': 'lock-keyhole',
        '🔓': 'lock-keyhole-open', '🔔': 'bell', '🧾': 'receipt', '💳': 'credit-card',
        '💵': 'banknote', '🛒': 'shopping-cart', '👥': 'users-round', '👤': 'user-round',
        '📦': 'package', '📞': 'phone', '🚌': 'bus', '🎓': 'graduation-cap', '🛠️': 'wrench',
        '🔧': 'wrench', '🚗': 'car-front', '💡': 'lightbulb', '🔑': 'key-round',
        '📌': 'map-pin', '📍': 'map-pin', '🗓️': 'calendar-days', '⏰': 'clock-3',
        '⏳': 'hourglass', '🔗': 'link', '📄': 'file-text', '📃': 'file-text',
        '📤': 'send', '📧': 'mail', '✉️': 'mail', '💬': 'message-circle', '📢': 'megaphone',
        '📣': 'megaphone', '🎉': 'party-popper', '✨': 'sparkles', '⭐': 'star', '🌟': 'star',
        '❤️': 'heart', '🧹': 'brush', '🔔': 'bell-ring', '⬅️': 'arrow-left',
        '➡️': 'arrow-right', '⬆️': 'arrow-up', '⬇️': 'arrow-down', '↻': 'refresh-cw',
        '☰': 'menu', '⋮': 'ellipsis-vertical', '⋯': 'ellipsis', '⏪': 'rewind',
        '⏩': 'fast-forward', '▶️': 'play', '⏸️': 'pause', '⏹️': 'square',
        '🔊': 'volume-2', '🔇': 'volume-x', '🛡️': 'shield-check', '🚀': 'rocket',
        '🧮': 'calculator', '📈': 'bar-chart-3', '📉': 'bar-chart-3',
        '🧑‍🏫': 'presentation', '🧑‍🎓': 'graduation-cap', '👇': 'arrow-down', '👆': 'arrow-up',
        '🚨': 'siren', '👈': 'arrow-left', '🛑': 'octagon-alert', '☢️': 'radiation',
        '🌍': 'earth', '✍️': 'pen-line', '🎯': 'target', '📁': 'folder', '🏆': 'trophy',
        '💻': 'laptop', '🪑': 'armchair', '👍': 'thumbs-up', '📑': 'files', '📜': 'scroll',
        '📂': 'folder-open', '🏦': 'landmark', '💸': 'banknote', '✏️': 'pencil',
        '🔐': 'lock-keyhole', '↔': 'move-horizontal', '🔴': 'circle', '🟢': 'circle-check',
        '🎁': 'gift', '💥': 'zap', '👉': 'arrow-right', '🧠': 'brain', '🚚': 'truck',
        '🧭': 'compass', '⏱️': 'timer', '⚖️': 'scale', '🪄': 'wand-sparkles',
        '▪️': 'square', '🖥️': 'monitor', '⛔': 'circle-stop', '👔': 'briefcase-business',
        '📡': 'radio', '🟡': 'circle', '🧨': 'bomb', '🎨': 'palette', '👨‍👩‍👧‍👦': 'users-round',
        '🔢': 'list-ordered', '📘': 'book-open', '🍽️': 'utensils', '🚩': 'flag',
        '🖼️': 'image', '🏁': 'flag-triangle-right', '✖': 'x', '🔴': 'circle', '💸': 'banknote',
        '👋': 'hand', '📲': 'smartphone', '🔀': 'shuffle', '⬅': 'arrow-left', 'ℹ️': 'info',
        '✔': 'check', '🕰️': 'clock-3', '🔥': 'flame'
    };
    const hostsSelector = 'button, a, [role="button"], [class*="btn-"], .nav-btn, .tab-btn, .section-header, .form-section-title, h1, h2, h3, h4, h5, h6, label, th, .badge, [class*="status"], div[style*="font-size: 18px"]';
    const emojiPattern = new RegExp(Object.keys(iconMap)
        .sort((left, right) => right.length - left.length)
        .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'), 'gu');

    function replaceTextNode(textNode) {
        const text = textNode.nodeValue;
        emojiPattern.lastIndex = 0;
        if (!emojiPattern.test(text)) return;
        emojiPattern.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let previousIndex = 0;
        for (const match of text.matchAll(emojiPattern)) {
            fragment.append(document.createTextNode(text.slice(previousIndex, match.index)));
            const icon = document.createElement('i');
            icon.dataset.lucide = iconMap[match[0]];
            icon.className = 'system-icon';
            icon.setAttribute('aria-hidden', 'true');
            fragment.append(icon);
            previousIndex = match.index + match[0].length;
        }
        fragment.append(document.createTextNode(text.slice(previousIndex)));
        textNode.replaceWith(fragment);
    }

    function processHost(host) {
        if (!host || host.closest('script, style, textarea, input, select, option, code, pre, [contenteditable="true"]')) return;
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach(replaceTextNode);
    }

    function scan(root) {
        if (!window.lucide || !root) return;
        const hosts = new Set();
        if (root.nodeType === Node.TEXT_NODE) {
            const host = root.parentElement?.closest(hostsSelector);
            if (host) hosts.add(host);
        } else if (root.nodeType === Node.ELEMENT_NODE) {
            if (root.matches(hostsSelector)) hosts.add(root);
            root.querySelectorAll(hostsSelector).forEach(host => hosts.add(host));
        } else if (root === document) {
            root.querySelectorAll(hostsSelector).forEach(host => hosts.add(host));
        }

        hosts.forEach(processHost);
        if (document.querySelector('i.system-icon[data-lucide]')) window.lucide.createIcons();
    }

    const iconStyle = document.createElement('style');
    iconStyle.textContent = '.lucide { display: inline-block; width: 1em; height: 1em; margin-right: .3em; vertical-align: -.14em; stroke-width: 2; flex: none; }';
    document.head.append(iconStyle);

    scan(document);
    const pendingRoots = new Set();
    let scanScheduled = false;
    const observer = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => pendingRoots.add(node)));
        if (scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(() => {
            scanScheduled = false;
            pendingRoots.forEach(scan);
            pendingRoots.clear();
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();