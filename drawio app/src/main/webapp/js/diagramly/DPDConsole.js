/* +--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
| Task 112, Sprint 2                                     |
+--------------------------------------------------------+

 */
/**
 * Creates a console in the right sidebar for displaying DPD rule violations.
 * Integrates with draw.io's existing sidebar panels
 */

/**
 * DPD Console Constructor
 * Creates a violation log console that appears in the right sidebar
 * * @param {EditorUi} editorUi - The editor UI instance
 * @param {HTMLElement} container - The container element for the console
 */
var DPDConsole = function(editorUi, container)
{
	this.editorUi = editorUi;
	this.container = container;
	this.violations = [];
	this.maxViolations = 50; // Keep last 50 violations

	// NOLAI: Sequential counter used to assign #1, #2 … labels to violations.
	// Resets to 0 on clear() so numbering always starts from #1 after a fresh run.
	this.indexCounter = 0;

	// NOLAI: Optional callback invoked after clear() completes.
	this.onClear = null;

	// NOLAI: Called when the user clicks the highlight toggle button.
	// dpd.js sets this lazily so it can flip highlights on/off on the canvas.
	this.onToggleHighlights = null;

	this.init();
};

/**
 * Initialize the DPD Console UI
 */
DPDConsole.prototype.init = function()
{
	this.container.style.cssText = `
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0; /* CRITICAL: Allows flex child to trigger scrolling */
		overflow: hidden; /* CRITICAL: Passes overflow responsibility to the inner logArea */
		border-top: 1px solid light-dark(var(--border-color), var(--dark-border-color));
		background-color: light-dark(var(--ge-panel-color), var(--ge-dark-panel-color));
	`;

	// Header with title and clear button
	this.createHeader();
	
	// Console log area (scrollable)
	this.createConsoleArea();
	
	// Footer with stats
	this.createFooter();
};

/**
 * Create the console header with title and control buttons
 */
DPDConsole.prototype.createHeader = function()
{
	var header = document.createElement('div');
	header.style.cssText = `
		padding: 8px 12px;
		background-color: light-dark(var(--ge-panel-color), var(--dark-toolbar-color));
		border-bottom: 1px solid light-dark(var(--border-color), var(--dark-border-color));
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
	`;

	// Title
	var title = document.createElement('div');
	title.style.cssText = `
		font-weight: 600;
		font-size: 12px;
		color: light-dark(var(--text-color), var(--dark-text-color));
		text-transform: uppercase;
		letter-spacing: 0.5px;
	`;
	title.textContent = 'DPD Violations';
	header.appendChild(title);

	// Control buttons container
	var controls = document.createElement('div');
	controls.style.cssText = `
		display: flex;
		gap: 4px;
	`;

	// NOLAI: "Highlights" toggle button
	var toggleBtn = document.createElement('button');
	toggleBtn.title = 'Run validation and show highlights on the diagram';
	toggleBtn.textContent = 'Highlights';
	toggleBtn.style.cssText = [
		'background:none',
		'border:1px solid currentColor',
		'border-radius:10px',
		'color:light-dark(var(--text-color), var(--dark-text-color))',
		'cursor:pointer',
		'font-size:10px',
		'font-weight:600',
		'padding:2px 8px',
		'opacity:0.45',
		'transition:opacity 0.2s, background 0.2s, color 0.2s',
		'letter-spacing:0.3px',
	].join(';');

	toggleBtn.onmouseover = function() { toggleBtn.style.opacity = '1'; };
	toggleBtn.onmouseout  = function() {
		toggleBtn.style.opacity = toggleBtn._active ? '1' : '0.45';
	};

	toggleBtn.onclick = mxUtils.bind(this, function()
	{
		if (typeof this.onToggleHighlights === 'function')
		{
			this.onToggleHighlights();
		}
	});

	this.toggleBtn = toggleBtn;
	controls.appendChild(toggleBtn);

	// Clear button
	var clearBtn = document.createElement('button');
	clearBtn.title = 'Clear violations';
	clearBtn.textContent = '✕';
	clearBtn.style.cssText = `
		background: none;
		border: none;
		color: light-dark(var(--text-color), var(--dark-text-color));
		cursor: pointer;
		font-size: 14px;
		padding: 2px 4px;
		opacity: 0.6;
		transition: opacity 0.2s;
	`;
	
	clearBtn.onmouseover = function() { clearBtn.style.opacity = '1'; };
	clearBtn.onmouseout = function() { clearBtn.style.opacity = '0.6'; };
	
	clearBtn.onclick = mxUtils.bind(this, function()
	{
		this.clear();
	});
	
	controls.appendChild(clearBtn);
	header.appendChild(controls);
	
	this.container.appendChild(header);
	this.header = header;
};

/**
 * Create the scrollable console log area
 */
DPDConsole.prototype.createConsoleArea = function()
{
	this.logArea = document.createElement('div');
	this.logArea.style.cssText = `
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px;
		background-color: light-dark(var(--ge-panel-color), var(--ge-dark-panel-color));
		font-family: 'Courier New', monospace;
		font-size: 11px;
		line-height: 1.4;
		color: light-dark(var(--text-color), var(--dark-text-color));
	`;
	
	// Empty state message
	var emptyMsg = document.createElement('div');
	emptyMsg.id = 'dpdEmptyMessage';
	emptyMsg.style.cssText = `
		color: light-dark(var(--text-color), var(--dark-text-color));
		opacity: 0.5;
		text-align: center;
		padding: 20px 10px;
		font-style: italic;
		user-select: none;
	`;
	emptyMsg.textContent = 'No violations detected';
	this.logArea.appendChild(emptyMsg);

	this.container.appendChild(this.logArea);
};

/**
 * Create footer with violation count and severity stats
 */
DPDConsole.prototype.createFooter = function()
{
	this.footer = document.createElement('div');
	this.footer.style.cssText = `
		padding: 6px 12px;
		background-color: light-dark(var(--ge-panel-color), var(--dark-color));
		border-top: 1px solid light-dark(var(--border-color), var(--dark-border-color));
		font-size: 11px;
		color: light-dark(var(--text-color), var(--dark-text-color));
		opacity: 0.7;
		display: flex;
		justify-content: space-between;
		flex-shrink: 0;
	`;
	
	this.statsText = document.createElement('div');
	this.statsText.textContent = '0 violations';
	this.footer.appendChild(this.statsText);
	
	this.container.appendChild(this.footer);
};

/**
 * Add a violation to the console
 */
DPDConsole.prototype.addViolation = function(ruleName, message, severity, details)
{
	severity = severity || 'error';
	details = details || {};

	this.indexCounter += 1;

	var violation = {
		ruleName: ruleName,
		message: message,
		severity: severity,
		index: this.indexCounter,
		timestamp: new Date(),
		details: details
	};
	
	this.violations.push(violation);
	
	if (this.violations.length > this.maxViolations)
	{
		this.violations.shift();
	}
	
	var emptyMsg = this.logArea.querySelector('#dpdEmptyMessage');
	if (emptyMsg && this.violations.length === 1)
	{
		emptyMsg.style.display = 'none';
	}
	
	this.createViolationEntry(violation);
	this.updateStats();
	this.logArea.scrollTop = this.logArea.scrollHeight;
};

/**
 * Create and append a violation entry DOM element
 */
DPDConsole.prototype.createViolationEntry = function(violation)
{
	var entry = document.createElement('div');
	entry.className = 'dpdViolationEntry';
	entry.style.cssText = `
		margin-bottom: 8px;
		padding: 6px 8px;
		border-left: 3px solid ${violation.severity === 'error' ? '#ff4444' : '#ffaa00'};
		background-color: light-dark(#f9f9f9, #1f1f1f);
		border-radius: 2px;
		box-sizing: border-box;
		transition: background-color 0.2s;
	`;
	
	entry.onmouseover = function()
	{
		entry.style.backgroundColor = violation.severity === 'error' ? 
			'light-dark(#ffe6e6, #3a1f1f)' : 'light-dark(#fff5e6, #3a2f1f)';
	};
	entry.onmouseout = function()
	{
		entry.style.backgroundColor = 'light-dark(#f9f9f9, #1f1f1f)';
	};
	
	var color = violation.severity === 'error' ? '#ff4444' : '#ffaa00';

	var headerRow = document.createElement('div');
	headerRow.style.cssText = 'margin-bottom:3px;';

	var indexBadge = document.createElement('span');
	indexBadge.style.cssText = [
		'display:inline-block',
		'background:' + color,
		'color:#fff',
		'border-radius:3px',
		'padding:1px 5px',
		'font-weight:bold',
		'font-size:10px',
		'margin-right:5px',
		'vertical-align:middle',
	].join(';');
	indexBadge.textContent = '#' + violation.index;
	headerRow.appendChild(indexBadge);

	var ruleLabel = document.createElement('span');
	ruleLabel.style.cssText = 'font-size:9px;opacity:0.55;vertical-align:middle;';
	ruleLabel.textContent = violation.ruleName;
	headerRow.appendChild(ruleLabel);

	entry.appendChild(headerRow);

	var msgDiv = document.createElement('div');
	msgDiv.style.cssText = [
		'color:light-dark(var(--text-color), var(--dark-text-color))',
		'font-size:11px',
		'white-space:normal',
		'word-wrap:break-word',
		'overflow-wrap:break-word',
		'word-break:break-word',
	].join(';');
	msgDiv.textContent = violation.message;
	entry.appendChild(msgDiv);
	
	if (this.editorUi.showTimestamps !== false) 
	{
		var timeSpan = document.createElement('div');
		timeSpan.style.cssText = `
			font-size: 9px;
			opacity: 0.5;
			margin-top: 2px;
		`;
		timeSpan.textContent = violation.timestamp.toLocaleTimeString();
		entry.appendChild(timeSpan);
	}
	
	if (Object.keys(violation.details).length > 0)
	{
		var detailsBtn = document.createElement('div');
		detailsBtn.style.cssText = `
			font-size: 9px;
			color: light-dark(#0066cc, #6ab0ff);
			cursor: pointer;
			margin-top: 4px;
			user-select: none;
		`;
		detailsBtn.textContent = '▶ details';
		
		var detailsDiv = document.createElement('div');
		detailsDiv.style.cssText = `
			display: none;
			margin-top: 4px;
			padding: 4px;
			background-color: light-dark(var(--ge-panel-color), var(--dark-color));
			border: 1px solid light-dark(var(--border-color), var(--dark-border-color));
			border-radius: 2px;
			font-size: 10px;
			color: light-dark(var(--text-color), var(--dark-text-color));
		`;
		
		var detailsText = Object.entries(violation.details)
			.map(function(kv) { return kv[0] + ': ' + kv[1]; })
			.join('\n');
		
		detailsDiv.textContent = detailsText;
		
		detailsBtn.onclick = function()
		{
			var isVisible = detailsDiv.style.display !== 'none';
			detailsDiv.style.display = isVisible ? 'none' : 'block';
			detailsBtn.textContent = isVisible ? '▶ details' : '▼ details';
		};
		
		entry.appendChild(detailsBtn);
		entry.appendChild(detailsDiv);
	}
	
	this.logArea.appendChild(entry);
};

/**
 * Update violation statistics in footer
 */
DPDConsole.prototype.updateStats = function()
{
	var totalCount = this.violations.length;
	var errorCount = this.violations.filter(function(v) { return v.severity === 'error'; }).length;
	var warningCount = this.violations.filter(function(v) { return v.severity === 'warning'; }).length;
	
	var statsHtml = totalCount + ' violation' + (totalCount !== 1 ? 's' : '');
	if (errorCount > 0 || warningCount > 0)
	{
		statsHtml += ' (';
		var parts = [];
		if (errorCount > 0) parts.push(errorCount + ' error' + (errorCount !== 1 ? 's' : ''));
		if (warningCount > 0) parts.push(warningCount + ' warning' + (warningCount !== 1 ? 's' : ''));
		statsHtml += parts.join(', ') + ')';
	}
	
	this.statsText.textContent = statsHtml;
};

/**
 * NOLAI: Update the toggle button to reflect whether highlights are currently visible
 */
DPDConsole.prototype.setHighlightToggleState = function(visible)
{
	if (!this.toggleBtn) return;

	if (visible)
	{
		this.toggleBtn.title      = 'Highlights active — diagram editing locked. Click to unlock.';
		this.toggleBtn.style.background = '#ff8800';
		this.toggleBtn.style.color      = '#fff';
		this.toggleBtn.style.borderColor = '#ff8800';
		this.toggleBtn.style.opacity    = '1';
		this.toggleBtn._active = true;
	}
	else
	{
		this.toggleBtn.title      = 'Run validation and show highlights';
		this.toggleBtn.style.background  = 'none';
		this.toggleBtn.style.color       = 'light-dark(var(--text-color), var(--dark-text-color))';
		this.toggleBtn.style.borderColor = 'currentColor';
		this.toggleBtn.style.opacity     = '0.45';
		this.toggleBtn._active = false;
	}
};

/**
 * Clear all violations from the console
 */
DPDConsole.prototype.clear = function()
{
	this.violations = [];
	this.indexCounter = 0;

	if (this.toggleBtn)
	{
		this.setHighlightToggleState(false);
	}

	this.logArea.innerHTML = '';

	var emptyMsg = document.createElement('div');
	emptyMsg.id = 'dpdEmptyMessage';
	emptyMsg.style.cssText = `
		color: light-dark(var(--text-color), var(--dark-text-color));
		opacity: 0.5;
		text-align: center;
		padding: 20px 10px;
		font-style: italic;
		user-select: none;
	`;
	emptyMsg.textContent = 'No violations detected';
	this.logArea.appendChild(emptyMsg);

	this.updateStats();

	if (typeof this.onClear === 'function')
	{
		this.onClear();
	}
};