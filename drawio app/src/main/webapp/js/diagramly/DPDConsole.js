/* 

+--------------------------------------------------------+
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
 * 
 * @param {EditorUi} editorUi - The editor UI instance
 * @param {HTMLElement} container - The container element for the console
 */
var DPDConsole = function(editorUi, container)
{
	this.editorUi = editorUi;
	this.container = container;
	this.violations = [];
	this.maxViolations = 50; // Keep last 50 violations
	
	this.init();
};

/**
 * Initialize the DPD Console UI
 */
DPDConsole.prototype.init = function()
{
	// Keep layout properties (flex basis/size) from parent and only set console-specific styles.
	this.container.style.display = 'flex';
	this.container.style.flexDirection = 'column';
	this.container.style.minHeight = '0';
	this.container.style.height = '100%';
	this.container.style.overflow = 'hidden';
	this.container.style.borderTop = '1px solid light-dark(var(--border-color), var(--dark-border-color))';
	this.container.style.backgroundColor = 'light-dark(var(--ge-panel-color), var(--ge-dark-panel-color))';

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
		background-color: light-dark(var(--ge-panel-color), var(--ge-dark-panel-color));
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
		background-color: light-dark(var(--ge-panel-color), var(--ge-dark-panel-color));
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
 * 
 * @param {string} ruleName - Name of the DPD rule
 * @param {string} message - Violation description
 * @param {string} severity - 'error' or 'warning'
 * @param {Object} details - Optional additional details {elementId, timestamp, etc}
 */
DPDConsole.prototype.addViolation = function(ruleName, message, severity, details)
{
	severity = severity || 'error';
	details = details || {};
	
	var violation = {
		ruleName: ruleName,
		message: message,
		severity: severity,
		timestamp: new Date(),
		details: details
	};
	
	this.violations.push(violation);
	
	// Keep only last N violations
	if (this.violations.length > this.maxViolations)
	{
		this.violations.shift();
	}
	
	// Clear empty message if this is first violation
	var emptyMsg = this.logArea.querySelector('#dpdEmptyMessage');
	if (emptyMsg && this.violations.length === 1)
	{
		emptyMsg.style.display = 'none';
	}
	
	// Add violation entry to log
	this.createViolationEntry(violation);
	
	// Update stats
	this.updateStats();
	
	// Auto-scroll to bottom
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
		border-left: 3px solid ${violation.severity === 'error' ? 'light-dark(#d93025, #ff8a80)' : 'light-dark(#e37400, #ffb74d)'};
		background-color: ${violation.severity === 'error' ? 'light-dark(#fff5f5, #2b1f1f)' : 'light-dark(#fff8e6, #2f2a1e)'};
		border-radius: 2px;
		word-wrap: break-word;
		transition: background-color 0.2s;
	`;
	
	// Hover effect
	entry.onmouseover = function()
	{
		entry.style.backgroundColor = violation.severity === 'error' ? 
			'light-dark(#ffeaea, #332525)' : 'light-dark(#fff2db, #353022)';
	};
	entry.onmouseout = function()
	{
		entry.style.backgroundColor = violation.severity === 'error' ?
			'light-dark(#fff5f5, #2b1f1f)' : 'light-dark(#fff8e6, #2f2a1e)';
	};
	
	// Rule name (bold)
	var ruleName = document.createElement('strong');
	ruleName.style.color = violation.severity === 'error' ?
		'light-dark(#b3261e, #ff8a80)' : 'light-dark(#b06000, #ffcc80)';
	ruleName.textContent = violation.ruleName;
	entry.appendChild(ruleName);
	
	// Message
	var msgSpan = document.createElement('span');
	msgSpan.textContent = ': ' + violation.message;
	msgSpan.style.color = 'light-dark(var(--text-color), var(--dark-text-color))';
	entry.appendChild(msgSpan);
	
	// Timestamp
	if (this.editorUi.showTimestamps !== false) // Default to showing timestamps
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
	
	// Details expansion (if details exist)
	if (Object.keys(violation.details).length > 0)
	{
		var detailsBtn = document.createElement('div');
		detailsBtn.style.cssText = `
			font-size: 9px;
			color: light-dark(var(--accent-text-color), var(--dark-accent-text-color));
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
			background-color: light-dark(var(--ge-panel-color), var(--ge-dark-panel-color));
			border: 1px solid light-dark(var(--border-color), var(--dark-border-color));
			color: light-dark(var(--text-color), var(--dark-text-color));
			border-radius: 2px;
			font-size: 10px;
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
 * Clear all violations from the console
 */
DPDConsole.prototype.clear = function()
{
	this.violations = [];
	this.logArea.innerHTML = '';
	
	// Show empty message again
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
};
