function stripVersionHeader(text) {
    if (!text) return "";
    var lines = text.split('\n');
    var idx = 0;
    while (idx < lines.length && !lines[idx].trim()) idx++;
    if (idx < lines.length) {
        var first = lines[idx].trim();
        if (/^#{1,2}\s+(?:\[[^\]]*\]\([^)]*\)|v?\d[\w.\-+]*)\s*(?:\([^)]*\))?\s*$/.test(first)) {
            lines.splice(idx, 1);
        }
    }
    return lines.join('\n').trim();
}

function _isStructuredSection(lines) {
    var nonEmpty = [];
    for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (t) nonEmpty.push(t);
    }
    if (nonEmpty.length === 0) return false;
    var listItems = 0;
    for (var j = 0; j < nonEmpty.length; j++) {
        if (/^[*\-]/.test(nonEmpty[j])) listItems++;
    }
    return (listItems / nonEmpty.length) > 0.5;
}

function _parseStructuredEntries(raw, section) {
    var entries = [];
    for (var j = 0; j < raw.length; j++) {
        var rl = raw[j].replace(/^[\s]*[-*]\s+/, '');
        entries.push(rl);
    }
    entries.forEach(function(text) {
        var commitLink = '';
        var body = text;
        var commitMatch = text.match(/\s*\(\[([a-f0-9]{6,40})\]\(([^)]+)\)\)\s*$/);
        if (commitMatch) {
            commitLink = commitMatch[0].trim();
            body = text.slice(0, text.indexOf(commitMatch[0])).trim();
        }
        var scopeMatch = body.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
        if (scopeMatch) {
            section.entries.push({ type: 'change', scope: scopeMatch[1].trim(), description: cleanEntryDesc(scopeMatch[2]), commitLink: commitLink });
            return;
        }
        var csMatch = body.match(/^(feat|fix|chore|docs|refactor)\(([^)]+)\):\s*(.+)/);
        if (csMatch) {
            section.entries.push({ type: 'change', scope: csMatch[2].trim(), description: cleanEntryDesc(csMatch[3]), changeType: csMatch[1], commitLink: commitLink });
            return;
        }
        var boldScope = body.match(/^\*\*([^*]+)\*\*\s+(.+)/);
        if (boldScope) {
            section.entries.push({ type: 'change', scope: boldScope[1].trim(), description: cleanEntryDesc(boldScope[2]), commitLink: commitLink });
            return;
        }
        var actionAppMatch = body.match(/^(add|fix|update|remove|bump|improve)\s+(.+)/i);
        if (actionAppMatch) {
            section.entries.push({ type: 'change', scope: cleanEntryDesc(actionAppMatch[2]), description: actionAppMatch[1].toLowerCase(), changeType: actionAppMatch[1].toLowerCase(), commitLink: commitLink });
            return;
        }
        if (commitLink) {
            var desc = cleanEntryDesc(body);
            if (desc) {
                section.entries.push({ type: 'change', scope: desc, description: '', commitLink: commitLink });
                return;
            }
        }
        var colonSplit = body.match(/^([A-Za-z][A-Za-z0-9 ._-]+?):\s*(.+)/);
        if (colonSplit) {
            section.entries.push({ type: 'change', scope: colonSplit[1].trim(), description: cleanEntryDesc(colonSplit[2]), commitLink: commitLink });
            return;
        }
        var desc = cleanEntryDesc(body);
        if (desc) {
            section.entries.push({ type: 'change', scope: '', description: desc, commitLink: commitLink });
        }
    });
}

function parseReleaseNotes(text) {
    if (!text) return [];
    var sections = [];
    var currentSection = null;
    var lines = text.split('\n');
    function startSection(heading) {
        currentSection = { heading: heading, rawLines: [], entries: [], markdown: '' };
        sections.push(currentSection);
    }
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        if (/^#{1,2}\s+(?:\[[\w.\-+]+\]\([^)]*\)|[\w.]+[\w.-]*)\s*(?:\([\w\-\s,:]+\))?\s*$/.test(trimmed)) continue;
        if (/^\[.+\]\(.+\)/.test(trimmed) && trimmed.indexOf('|') !== -1) continue;
        if (/^###\s*\S/.test(trimmed)) {
            startSection(trimmed.replace(/^###\s+/, '').trim());
            continue;
        }
        if (/^={2,}\s*$/.test(trimmed) && i > 0) {
            var nameLine = lines[i - 1].trim();
            if (nameLine && !nameLine.startsWith('#') && !nameLine.startsWith('=') && nameLine.length < 60) {
                startSection(nameLine);
                continue;
            }
        }
        if (/^={2,}\s*$/.test(trimmed) || /^-{2,}\s*$/.test(trimmed)) continue;
        if (currentSection) {
            if (trimmed) currentSection.rawLines.push(trimmed);
        } else if (trimmed) {
            startSection("Overview");
            currentSection.rawLines.push(trimmed);
        }
    }
    sections.forEach(function(section) {
        if (_isStructuredSection(section.rawLines)) {
            section.mode = 'structured';
            _parseStructuredEntries(section.rawLines, section);
        } else {
            section.mode = 'markdown';
            section.markdown = section.rawLines.join('\n');
        }
        delete section.rawLines;
    });
    sections = sections.filter(function(s) {
        if (s.mode === 'structured') return s.entries.length > 0;
        return s.markdown.trim().length > 0;
    });
    sections = sections.filter(function(s) {
        var h = s.heading.trim();
        if (/^v?[\d]+\.[\d]+/.test(h)) return false;
        return true;
    });
    return sections;
}

function cleanEntryDesc(str) {
    if (!str) return "";
    return str
        .replace(/\s*\(\[#[0-9]+\]\([^)]+\)\)\s*$/, '')
        .replace(/\s*\[\#[0-9]+\]\([^)]+\)\s*$/, '')
        .replace(/\s*\(#[0-9]+\)\s*$/, '')
        .trim();
}

function renderInlineMarkdown(str) {
    if (!str) return "";
    var html = escHtml(str);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return html;
}

function renderMarkdown(text) {
    if (!text) return '';
    var blocks = text.split('\n\n');
    var html = '';
    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i].trim();
        if (!block) continue;
        if (/^\|/.test(block) && /\|[-:]+\|/.test(block)) {
            var rows = block.split('\n');
            html += '<table>';
            for (var r = 0; r < rows.length; r++) {
                var cells = rows[r].split('|');
                if (cells.length > 0 && cells[0].trim() === '') cells.shift();
                if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
                if (r === 1 && /^\s*[-:]+\s*$/.test(cells.join(''))) continue;
                var tag = r === 1 ? 'th' : 'td';
                html += '<tr>';
                for (var c = 0; c < cells.length; c++) {
                    html += '<' + tag + '>' + renderInlineMarkdown(cells[c].trim()) + '</' + tag + '>';
                }
                html += '</tr>';
            }
            html += '</table>';
            continue;
        }
        if (/^>\s?/.test(block)) {
            var qlines = block.split('\n');
            var qhtml = '';
            for (var q = 0; q < qlines.length; q++) {
                qhtml += (qhtml ? '\n' : '') + qlines[q].replace(/^>\s?/, '').trim();
            }
            html += '<blockquote><p>' + renderInlineMarkdown(qhtml) + '</p></blockquote>';
            continue;
        }
        if (/^-{3,}\s*$/.test(block) || /^\*{3,}\s*$/.test(block)) {
            html += '<hr>';
            continue;
        }
        if (/^[*\-]\s/.test(block)) {
            var llines = block.split('\n');
            html += '<ul>';
            for (var l = 0; l < llines.length; l++) {
                var li = llines[l].replace(/^[*\-]\s+/, '').trim();
                if (li) html += '<li>' + renderInlineMarkdown(li) + '</li>';
            }
            html += '</ul>';
            continue;
        }
        html += '<p>' + renderInlineMarkdown(block) + '</p>';
    }
    return html;
}

function renderCommitLink(linkText) {
    if (!linkText) return '';
    var match = linkText.match(/\(\[([a-f0-9]{6,40})\]\(([^)]+)\)\)/);
    if (match) {
        return '<a href="' + escHtml(match[2]) + '" target="_blank" rel="noopener" class="release-commit-link" title="' + escHtml(match[2]) + '">' + escHtml(match[1]) + '</a>';
    }
    return renderInlineMarkdown(linkText);
}

function getSectionClass(heading) {
    var h = heading.toLowerCase();
    if (h.indexOf('bug fix') !== -1 || h.indexOf('fix') !== -1 || h.indexOf('\u{1F41B}') !== -1) return 'release-section--fixes';
    if (h.indexOf('feature') !== -1 || h.indexOf('feat') !== -1 || h.indexOf('\u2728') !== -1) return 'release-section--features';
    if (h.indexOf('support') !== -1 || h.indexOf('update') !== -1 || h.indexOf('\u{1F680}') !== -1) return 'release-section--support';
    return 'release-section--other';
}

function getSectionLabel(heading) {
    var h = heading.toLowerCase();
    if (h.indexOf('bug fix') !== -1 || h.indexOf('fix') !== -1 || h.indexOf('\u{1F41B}') !== -1) return 'Bug Fixes';
    if (h.indexOf('feature') !== -1 || h.indexOf('feat') !== -1 || h.indexOf('\u2728') !== -1) return 'Features';
    if (h.indexOf('support') !== -1 || h.indexOf('update') !== -1 || h.indexOf('\u{1F680}') !== -1) return 'Updates';
    if (h.indexOf('announce') !== -1) return 'Announcement';
    return heading;
}

function renderChangeType(type) {
    if (!type) return '';
    var t = type.toLowerCase();
    if (t === 'add' || t === 'bump' || t === 'feat') return '<span class="change-type change-type--add">+</span>';
    if (t === 'fix') return '<span class="change-type change-type--fix">\u2713</span>';
    if (t === 'remove') return '<span class="change-type change-type--remove">\u2212</span>';
    if (t === 'update' || t === 'chore' || t === 'refactor') return '<span class="change-type change-type--update">\u21BB</span>';
    if (t === 'improve' || t === 'docs') return '<span class="change-type change-type--improve">\u2191</span>';
    return '';
}

function renderReleaseSections(parsed) {
    if (!parsed || parsed.length === 0) return '';
    var html = '';
    parsed.forEach(function(section) {
        var sectionClass = getSectionClass(section.heading);
        var sectionLabel = getSectionLabel(section.heading);
        html += '<div class="release-section ' + sectionClass + '">';
        html += '<div class="release-section-header">' + escHtml(sectionLabel) + '</div>';

        if (section.mode === 'markdown') {
            html += '<div class="release-section-markdown">' + renderMarkdown(section.markdown) + '</div>';
        } else {
            section.entries.forEach(function(entry) {
                if (entry.type === 'change') {
                    html += '<div class="release-entry">';
                    var ctHtml = renderChangeType(entry.changeType);
                    if (ctHtml) {
                        html += ctHtml;
                    }
                    if (entry.scope) {
                        var parts = entry.scope.split(' - ');
                        var appName = parts[0];
                        var featureName = parts.length > 1 ? parts.slice(1).join(' - ') : '';
                        html += '<span class="release-entry-scope">' + escHtml(appName) + '</span>';
                        if (featureName) {
                            html += '<span class="release-entry-feature">' + escHtml(featureName) + '</span>';
                        }
                    }
                    if (entry.description && !ctHtml) {
                        html += '<span class="release-entry-desc">' + renderInlineMarkdown(entry.description) + '</span>';
                    }
                    if (entry.commitLink) {
                        html += renderCommitLink(entry.commitLink);
                    }
                    html += '</div>';
                } else if (entry.type === 'text') {
                    html += '<div class="release-entry release-entry--text">' + renderInlineMarkdown(entry.text) + '</div>';
                }
            });
        }

        html += '</div>';
    });
    return html;
}
