/**
 * Copyright (c) 2006-2020, JGraph Holdings Ltd
 * Copyright (c) 2006-2020, draw.io AG
 */

/* 

+--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
|                                                        |
+--------------------------------------------------------+

*/

(function()
{
	// Adds scrollbars for menus that exceed the page height
	var mxPopupMenuShowMenu = mxPopupMenu.prototype.showMenu;
	mxPopupMenu.prototype.showMenu = function()
	{
		this.div.style.overflowY = 'auto';
		this.div.style.overflowX = 'hidden';
		var h0 = Math.max(document.body.clientHeight, document.documentElement.clientHeight);
		this.div.style.maxHeight = (h0 - (EditorUi.isElectronApp? 50 : 10)) + 'px'; //In Electron and without titlebar, the top item is not selectable

		mxPopupMenuShowMenu.apply(this, arguments);
	};
	
	Menus.prototype.createHelpLink = function(href)
	{
		return this.editorUi.createHelpIcon(href);
	};

	Menus.prototype.addLinkToItem = function(item, href)
	{
		if (item != null)
		{
			item.firstChild.nextSibling.appendChild(this.createHelpLink(href));
		}
	};

	/**
	 * Removes the given font from the list of custom fonts.
	 */
	Menus.prototype.removeCustomFont = function(name, url)
	{
		for (var i = 0; i < this.customFonts.length; i++)
		{
			if (this.customFonts[i].name == name &&
				this.customFonts[i].url == url)
			{
				this.customFonts.splice(i, 1);
				this.editorUi.fireEvent(
					new mxEventObject('customFontsChanged',
					'customFonts', this.customFonts));
				
				break;
			}
		}
	};

	/**
	 * Returns true if the given font is in the list of custom fonts.
	 */
	Menus.prototype.containsFont = function(name, url)
	{
		for (var i = 0; i < this.customFonts.length; i++)
		{
			if (this.customFonts[i].name == name &&
				this.customFonts[i].url == url)
			{
				return true;
			}
		}

		for (var i = 0; i < this.defaultFonts.length; i++)
		{
			var value = this.defaultFonts[i];
			
			if ((typeof value !== 'string' &&
				value.fontFamily == name &&
				value.fontUrl == url) ||
				(typeof value === 'string' &&
				value == name && url == null))
			{
				return true;
			}
		}

		return false;
	};

	/**
	 * Adds the given font to the list of custom fonts.
	 */
	Menus.prototype.addCustomFont = function(name, url)
	{
		if (name != null && !this.containsFont(name, url))
		{
			this.customFonts.push({name: name, url: url});
			this.editorUi.fireEvent(
				new mxEventObject('customFontsChanged',
				'customFonts', this.customFonts));
		}
	};

	var menusInit = Menus.prototype.init;
	Menus.prototype.init = function()
	{
		menusInit.apply(this, arguments);
		var editorUi = this.editorUi;
		var graph = editorUi.editor.graph;
		var isGraphEnabled = mxUtils.bind(graph, graph.isEnabled);
		
		if (urlParams['noFileMenu'] == '1')
		{
			this.defaultMenuItems = this.defaultMenuItems.filter(function(m)
			{
				return m != 'file';
			});
		}

		editorUi.actions.addAction('new...', function()
		{
			var compact = editorUi.isOffline();
			
			var dlg = new NewDialog(editorUi, compact, !(editorUi.mode == App.MODE_DEVICE && 'chooseFileSystemEntries' in window));

			editorUi.showDialog(dlg.container, (compact) ? 350 : 620, (compact) ? 70 : 460, true, true, function(cancel)
			{
				if (editorUi.sidebar != null)
				{
					editorUi.sidebar.hideTooltip();
				}
				
				if (cancel && editorUi.getCurrentFile() == null)
				{
					editorUi.showSplash();
				}
			});
			
			dlg.init();
		});
		
		editorUi.actions.put('insertTemplate', new Action('template' + '...', function()
		{
			editorUi.openTemplateDialog();
		})).isEnabled = isGraphEnabled;
		
		var shareCursorAction = editorUi.actions.addAction('shareCursor', function()
		{
			editorUi.setShareCursorPosition(!editorUi.isShareCursorPosition());;
		});
		
		shareCursorAction.setToggleAction(true);
		shareCursorAction.setSelectedCallback(function() { return editorUi.isShareCursorPosition(); });
		
		var showRemoteCursorsAction = editorUi.actions.addAction('showRemoteCursors', function()
		{
			editorUi.setShowRemoteCursors(!editorUi.isShowRemoteCursors());;
		});
		
		showRemoteCursorsAction.setToggleAction(true);
		showRemoteCursorsAction.setSelectedCallback(function() { return editorUi.isShowRemoteCursors(); });
		
		var pointAction = editorUi.actions.addAction('points', function()
		{
			editorUi.editor.graph.view.setUnit(mxConstants.POINTS);
		});
		
		pointAction.setToggleAction(true);
		pointAction.setSelectedCallback(function() { return editorUi.editor.graph.view.unit == mxConstants.POINTS; });
		
		var inchAction = editorUi.actions.addAction('inches', function()
		{
			editorUi.editor.graph.view.setUnit(mxConstants.INCHES);
		});
		
		inchAction.setToggleAction(true);
		inchAction.setSelectedCallback(function() { return editorUi.editor.graph.view.unit == mxConstants.INCHES; });
		
		var mmAction = editorUi.actions.addAction('millimeters', function()
		{
			editorUi.editor.graph.view.setUnit(mxConstants.MILLIMETERS);
		});
		
		mmAction.setToggleAction(true);
		mmAction.setSelectedCallback(function() { return editorUi.editor.graph.view.unit == mxConstants.MILLIMETERS; });

		var meterAction = editorUi.actions.addAction('meters', function()
		{
			editorUi.editor.graph.view.setUnit(mxConstants.METERS);
		});
		
		meterAction.setToggleAction(true);
		meterAction.setSelectedCallback(function() { return editorUi.editor.graph.view.unit == mxConstants.METERS; });

		this.put('units', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			this.addMenuItems(menu, ['points', 'inches', 'millimeters', 'meters'], parent);
		
			if (Editor.currentTheme == 'min' ||
				Editor.currentTheme == 'simple' ||	
				Editor.currentTheme == 'sketch')
			{
				editorUi.menus.addMenuItems(menu, ['-', 'pageScale'], parent);
			}
		})));

		var pagesAction = editorUi.actions.addAction('pageTabs', function()
		{
			editorUi.setTabContainerVisible(!editorUi.isTabContainerVisible(), true);
		});
		
		pagesAction.setToggleAction(true);
		pagesAction.setSelectedCallback(function() { return editorUi.isTabContainerVisible(); });
		
		var rulerAction = editorUi.actions.addAction('ruler', function()
		{
			editorUi.setRulerVisible(!editorUi.isRulerVisible());
		});

		rulerAction.setEnabled(Editor.canvasSupported && document.documentMode != 9);
		rulerAction.setToggleAction(true);
		rulerAction.setSelectedCallback(function() { return editorUi.isRulerVisible(); });
		
        var fullscreenAction = editorUi.actions.addAction('fullscreen', function()
		{
			if (urlParams['embedInline'] == '1')
			{
				editorUi.setInlineFullscreen(!Editor.inlineFullscreen);
			}
			else
			{
				var node = (mxUtils.isAncestorNode(document.body, editorUi.container)) ?
					editorUi.container : editorUi.editor.graph.container;
			
				if (node != null)
				{
					if (document.fullscreenElement == null)
					{
						document.body.requestFullscreen();
						node.classList.add('geFullscreen');
					}
					else
					{
						document.exitFullscreen();
						node.classList.remove('geFullscreen');
					}
				}
			}
		});

		fullscreenAction.visible = urlParams['embedInline'] == '1' ||
			(window == window.top && document.fullscreenEnabled &&
			document.body.requestFullscreen != null);
		fullscreenAction.setToggleAction(true);
		
		fullscreenAction.setSelectedCallback(function()
		{
			return urlParams['embedInline'] == '1' ? 
				Editor.inlineFullscreen :
				document.fullscreenElement != null;
		});

        var lightModeAction = editorUi.actions.put('lightMode', new Action('light', function(e)
        {
			editorUi.setAndPersistDarkMode(false);
        }));

		lightModeAction.setToggleAction(true);
		lightModeAction.setSelectedCallback(function()
		{
			return !editorUi.isAutoDarkMode(true) && !Editor.isDarkMode();
		});
		
        var darkModeAction = editorUi.actions.put('darkMode', new Action('dark', function(e)
        {
			editorUi.setAndPersistDarkMode(true);
        }));

		darkModeAction.setToggleAction(true);
		darkModeAction.setSelectedCallback(function()
		{
			return !editorUi.isAutoDarkMode(true) && Editor.isDarkMode();
		});
		
        var autoModeAction = editorUi.actions.put('autoMode', new Action('automatic', function(e)
        {
			editorUi.setAndPersistDarkMode('auto');
        }));

		autoModeAction.setToggleAction(true);
		autoModeAction.setSelectedCallback(function()
		{
			return editorUi.isAutoDarkMode(true);
		});
		
		editorUi.actions.addAction('properties...', function()
		{
			editorUi.getPublicUrl(editorUi.getCurrentFile(), function(url)
			{
				var dlg = new FilePropertiesDialog(editorUi, url);
				editorUi.showDialog(dlg.container, 340, 200, true, true);
				dlg.init();
			});
		}).isEnabled = isGraphEnabled;
	
		if (window.mxFreehand)
		{
			var freehandAction = editorUi.actions.put('insertFreehand', new Action('freehand', function()
			{
				if (graph.isEnabled())
				{
					if (editorUi.freehandWindow == null)
					{
						editorUi.freehandWindow = new FreehandWindow(
							editorUi, document.body.offsetWidth - 420,
							102, 180, 126, true);
					}
					
					if (graph.freehand.isDrawing())
					{
						graph.freehand.stopDrawing();
					}
					else
					{
						graph.freehand.startDrawing();
					}
					
					editorUi.freehandWindow.window.setVisible(graph.freehand.isDrawing());
				}
			}, null, null, 'X'));
			
			freehandAction.isEnabled = function()
			{
				return isGraphEnabled();
			};

			freehandAction.setToggleAction(true);

			freehandAction.setSelectedCallback(function()
			{
				return editorUi.freehandWindow != null && editorUi.freehandWindow.window.isVisible();
			});
		}
		
		editorUi.actions.put('exportXml', new Action('formatXml' + '...', function()
		{
			var div = document.createElement('div');
			div.style.whiteSpace = 'nowrap';
			var noPages = editorUi.pages == null || editorUi.pages.length <= 1;
			
			var hd = document.createElement('h3');
			mxUtils.write(hd, mxResources.get('formatXml'));
			hd.style.cssText = 'width:100%;text-align:center;margin-top:0px;margin-bottom:4px';
			div.appendChild(hd);
			
			var selection = editorUi.addCheckbox(div, mxResources.get('selectionOnly'),
				false, graph.isSelectionEmpty());
			var compressed = editorUi.addCheckbox(div, mxResources.get('compressed'), Editor.defaultCompressed);
			var pages = editorUi.addCheckbox(div, mxResources.get('allPages'), !noPages, noPages);
			pages.style.marginBottom = '16px';
			
			mxEvent.addListener(selection, 'change', function()
			{
				if (selection.checked)
				{
					pages.setAttribute('disabled', 'disabled');
				}
				else
				{
					pages.removeAttribute('disabled');
				}
			});
			
			var dlg = new CustomDialog(editorUi, div, mxUtils.bind(this, function()
			{
				editorUi.downloadFile('xml', !compressed.checked, null,
					!selection.checked, noPages || !pages.checked);
			}), null, mxResources.get('export'));
			
			editorUi.showDialog(dlg.container, 300, 200, true, true);
		}));
		
		if (Editor.enableExportUrl)
		{
			editorUi.actions.put('exportUrl', new Action('url' + '...', function()
			{
				editorUi.showPublishLinkDialog(mxResources.get('url'), null, null, null, null, null, null, null,
					function(linkTarget, linkColor, currentPage, lightbox, editLink, layers, width, height,
						tags, link, transparent, darkMode, allPages)
					{
						var params = [];

						if (lightbox && tags)
						{
							params.push('tags=%7B%7D');
						}

						var dlg = new EmbedDialog(editorUi, editorUi.createLink(linkTarget, linkColor,
							allPages, lightbox, editLink, layers, null, true, params, null,
							currentPage, null, darkMode));
						editorUi.showDialog(dlg.container, 450, 270, true, true);
						dlg.init();
					}, null, true, true);
			}));
		}
		
		editorUi.actions.put('exportHtml', new Action('formatHtmlEmbedded' + '...', function()
		{
			editorUi.getPublicUrl(editorUi.getCurrentFile(), function(url)
			{
				editorUi.showHtmlDialog(mxResources.get('export'), null, url, function(publicUrl, zoomEnabled,
					initialZoom, linkTarget, linkColor, fit, allPages, layers, tags, lightbox, editLink, theme)
				{
					editorUi.createHtml(publicUrl, zoomEnabled, initialZoom, linkTarget, linkColor, fit, allPages,
						layers, tags, lightbox, editLink, mxUtils.bind(this, function(html, scriptTag)
						{
							var basename = editorUi.getBaseFilename(allPages);
							var result = '<!--[if IE]><meta http-equiv="X-UA-Compatible" content="IE=5,IE=9" ><![endif]-->\n' +
								'<!DOCTYPE html>\n<html>\n<head>\n<title>' + mxUtils.htmlEntities(basename) + '</title>\n' +
								'<meta charset="utf-8"/>\n</head>\n<body>' + html + '\n' + scriptTag + '\n</body>\n</html>';
							editorUi.saveData(basename + ((basename.substring(basename.lenth - 7) ==
								'.drawio') ? '' : '.drawio') + '.html', 'html', result, 'text/html');
						}), theme);
				});
			});
		}));
		
		editorUi.actions.put('exportPdf', new Action('formatPdf' + '...', function()
		{
			editorUi.showPrintDialog(mxResources.get('formatPdf'),
				(!EditorUi.isElectronApp && (editorUi.isOffline() || editorUi.printPdfExport)) ?
					null : mxUtils.bind(this, function(preview, args)
					{
						var pageCount = (editorUi.pages != null) ? editorUi.pages.length : 1;
						var noPages = editorUi.pages == null || editorUi.pages.length <= 1;
						var idx = editorUi.getPageIndex(editorUi.currentPage);
						var currentPage = (idx != null) ? idx + 1 : 1;
						var pageRange = (!args.allPages && (args.pagesFrom != currentPage || args.pagesTo != currentPage)) ?
							{from: Math.max(0, Math.min(pageCount - 1, args.pagesFrom - 1)),
								to: Math.max(0, Math.min(pageCount - 1, args.pagesTo - 1))} : null;
						
						editorUi.downloadFile('pdf', null, null, !args.selection, noPages ||
							(!args.allPages && args.pagesFrom == currentPage && args.pagesTo == currentPage), !args.crop,
							args.transparent, args.scale, null, args.grid, args.includeCopy, pageRange, args.border,
							args.fit, args.sheetsAcross, args.sheetsDown, args.shadows);					
					}), mxResources.get('export'));
		}));

		editorUi.actions.addAction('open...', function()
		{
			editorUi.pickFile();
		});
		
		editorUi.actions.addAction('close', function()
		{
			var currentFile = editorUi.getCurrentFile();
			
			function fn()
			{
				if (currentFile != null)
				{
					currentFile.removeDraft();
				}
				
				editorUi.fileLoaded(new LocalFile(editorUi,
					editorUi.emptyDiagramXml, null, true));
			};
			
			if (currentFile != null && currentFile.isModified())
			{
				editorUi.confirm(mxResources.get('allChangesLost'), null, fn,
					mxResources.get('cancel'), mxResources.get('discardChanges'));
			}
			else
			{
				fn();
			}
		});
		
		editorUi.actions.addAction('editShape...', mxUtils.bind(this, function()
		{
			if (graph.getSelectionCount() == 1)
			{
				var cell = graph.getSelectionCell();
				var state = graph.view.getState(cell);

				if (state != null && state.shape != null && state.shape.stencil != null)
				{
					var dlg = new EditShapeDialog(editorUi, cell, mxResources.get('editShape'));
					editorUi.showDialog(dlg.container, 640, 480, true, false,
						null, null, null, new mxRectangle(0, 0, 300, 200));
					dlg.init();
				}
			}
		}));

		editorUi.actions.addAction('revisionHistory...', function()
		{
			if (!editorUi.isRevisionHistorySupported())
			{
				editorUi.showError(mxResources.get('error'), mxResources.get('notAvailable'), mxResources.get('ok'));
			}
			else if (editorUi.spinner.spin(document.body, mxResources.get('loading')))
			{
				editorUi.getRevisions(mxUtils.bind(this, function(revs, restoreFn)
				{
					editorUi.spinner.stop();
					var dlg = new RevisionDialog(editorUi, revs, restoreFn);
					editorUi.showDialog(dlg.container, 640, 480, true, true);
					dlg.init();
				}), mxUtils.bind(this, function(err)
				{
					editorUi.handleError((err != null) ? err : mxResources.get('notAvailable'));
				}));
			}
		});
		
		editorUi.actions.addAction('createRevision', function()
		{
			editorUi.actions.get('save').funct();
		}, null, null, Editor.ctrlKey + '+S');
		
		var action = editorUi.actions.addAction('synchronize', function()
		{
			editorUi.synchronizeCurrentFile(DrawioFile.SYNC == 'none');
		}, null, null, Editor.altKey + '+' + Editor.shiftKey + '+S');
		
		// Changes the label if synchronization is disabled
		if (DrawioFile.SYNC == 'none')
		{
			action.label = mxResources.get('refresh');
		}
		
		editorUi.actions.addAction('upload...', function()
		{
			var file = editorUi.getCurrentFile();
			
			if (file != null)
			{
				// Data is pulled from global variable after tab loads
				// LATER: Change to use message passing to deal with potential cross-domain
				window.drawdata = editorUi.getFileData();
				var filename = (file.getTitle() != null) ? file.getTitle() : editorUi.defaultFilename;
				editorUi.openLink(window.location.protocol + '//' + window.location.host + '/?create=drawdata&' +
						((editorUi.mode == App.MODE_DROPBOX) ? 'mode=dropbox&' : '') +
						'title=' + encodeURIComponent(filename), null, true);
			}
		}, null, null, null, navigator.onLine && urlParams['stealth'] != '1' && urlParams['lockdown'] != '1');

		if (typeof(MathJax) !== 'undefined')
		{
			var action = editorUi.actions.addAction('mathematicalTypesetting', function()
			{
				var change = new ChangePageSetup(editorUi);
				change.ignoreColor = true;
				change.ignoreImage = true;
				change.mathEnabled = !editorUi.isMathEnabled();
				
				graph.model.execute(change);
			});
			
			action.setToggleAction(true);
			action.setSelectedCallback(function() { return editorUi.isMathEnabled(); });
			action.isEnabled = isGraphEnabled;
		}

		// Dynamic title is implemented below
		var defaultAdaptiveColors = editorUi.actions.put('defaultAdaptiveColors', new Action('defaultAdaptiveColors',
			function()
		{
			var change = new ChangePageSetup(editorUi);
			change.ignoreColor = true;
			change.ignoreImage = true;
			change.adaptiveColors = 'default';
			
			graph.model.execute(change);
		}));

		defaultAdaptiveColors.getTitle = function()
		{
			return mxResources.get('default') + ' (' + mxResources.get(Graph.getDefaultAdaptiveColorsKey()) + ')';
		};

		defaultAdaptiveColors.setToggleAction(true);
		defaultAdaptiveColors.setSelectedCallback(function() { return graph.adaptiveColors == null; });

		var automaticAdaptiveColors = editorUi.actions.put('automaticAdaptiveColors', new Action('automatic', function()
		{
			var change = new ChangePageSetup(editorUi);
			change.ignoreColor = true;
			change.ignoreImage = true;
			change.adaptiveColors = 'auto';
			
			graph.model.execute(change);
		}));

		automaticAdaptiveColors.setToggleAction(true);
		automaticAdaptiveColors.setSelectedCallback(function() { return graph.adaptiveColors == 'auto'; });

		var simpleAdaptiveColors = editorUi.actions.put('simpleAdaptiveColors', new Action('simple', function()
		{
			var change = new ChangePageSetup(editorUi);
			change.ignoreColor = true;
			change.ignoreImage = true;
			change.adaptiveColors = 'simple';
			
			graph.model.execute(change);
		}));

		simpleAdaptiveColors.setToggleAction(true);
		simpleAdaptiveColors.setSelectedCallback(function() { return graph.adaptiveColors == 'simple'; });

		var noAdaptiveColors = editorUi.actions.put('noAdaptiveColors', new Action('none', function()
		{
			var change = new ChangePageSetup(editorUi);
			change.ignoreColor = true;
			change.ignoreImage = true;
			change.adaptiveColors = 'none';
			
			graph.model.execute(change);
		}));

		noAdaptiveColors.setToggleAction(true);
		noAdaptiveColors.setSelectedCallback(function() { return graph.adaptiveColors == 'none'; });

		this.put('adaptiveColors', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			this.addMenuItems(menu, ['defaultAdaptiveColors', '-',
				'automaticAdaptiveColors', 'simpleAdaptiveColors',
				'noAdaptiveColors'], parent);
		})));

		if (isLocalStorage)
		{
			var action = editorUi.actions.addAction('showStartScreen', function()
			{
				mxSettings.setShowStartScreen(!mxSettings.getShowStartScreen());
				urlParams['splash'] = (mxSettings.getShowStartScreen()) ? '1' : '0';
				mxSettings.save();
			});
			
			action.setToggleAction(true);
			action.setSelectedCallback(function() { return mxSettings.getShowStartScreen(); });
		}

		var autosaveAction = editorUi.actions.addAction('autosave', function()
		{
			editorUi.editor.setAutosave(!editorUi.editor.autosave);
		});
		
		autosaveAction.setToggleAction(true);
		autosaveAction.setSelectedCallback(function()
		{
			return autosaveAction.isEnabled() && editorUi.editor.autosave;
		});
		
		editorUi.actions.addAction('editGeometry...', function()
		{
			var cells = graph.getSelectionCells();
			var vertices = [];
			
			for (var i = 0; i < cells.length; i++)
			{
				if (graph.getModel().isVertex(cells[i]))
				{
					vertices.push(cells[i]);
				}
			}
			
			if (vertices.length > 0)
			{
				var dlg = new EditGeometryDialog(editorUi, vertices);
				editorUi.showDialog(dlg.container, 200, 270, true, true);
				dlg.init();
			}
		}, null, null, Editor.ctrlKey + '+' + Editor.shiftKey + '+M');
		
		editorUi.actions.addAction('copyStyle', function()
		{
			if (graph.isEnabled() && graph.getSelectionCount() == 1)
			{
				var cell = graph.getSelectionCell();
				var style = graph.getCellStyle(cell, false);
				editorUi.copiedStyle = {};
				var values = [];
				var keys = [];

				for (var key in style)
				{
					values.push(style[key]);
					keys.push(key);
				}
				
				graph.copyCellStyles([cell], keys, values,
					editorUi.copiedStyle, editorUi.copiedStyle,
					null, null, null, true);
			}
		}, null, null,  Editor.altKey + '+C');

		editorUi.actions.addAction('pasteStyle', function()
		{
			if (graph.isEnabled() && !graph.isSelectionEmpty() && editorUi.copiedStyle != null)
			{
				graph.pasteCellStyles(graph.includeDescendants(graph.getSelectionCells()),
					editorUi.copiedStyle, editorUi.copiedStyle, true);
			}
		}, null, null,  Editor.altKey + '+V');
		
		editorUi.actions.put('exportSvg', new Action('formatSvg' + '...', function()
		{
			editorUi.showExportDialog(mxResources.get('formatSvg'), true, mxResources.get('export'),
				'https://www.drawio.com/doc/faq/export-diagram',
				mxUtils.bind(this, function(scale, transparentBackground, ignoreSelection,
					addShadow, editable, embedImages, border, cropImage, currentPage,
					linkTarget, grid, theme, exportType, embedFonts)
				{
					var val = parseInt(scale);
					editorUi.lastExportSvgEditable = editable;
					
					if (!isNaN(val) && val > 0)
					{
						editorUi.exportSvg(val / 100, transparentBackground, ignoreSelection,
							addShadow, editable, embedImages, border, !cropImage, currentPage,
							linkTarget, theme, exportType, embedFonts);
					}
				}), true, editorUi.lastExportSvgEditable, 'svg', true);
		}));

		function exportImage(format, defaultEditable, done)
		{
			if (editorUi.editor.isExportToCanvas())
			{
				editorUi.showExportDialog(mxResources.get('image'), false, mxResources.get('export'),
					'https://www.drawio.com/doc/faq/export-diagram',
					mxUtils.bind(this, function(scale, transparentBackground, ignoreSelection, addShadow, editable,
						embedImages, border, cropImage, currentPage, dummy, grid, theme, exportType)
					{
						var val = parseInt(scale);

						if (!isNaN(val) && val > 0)
						{
							editorUi.exportImage(val / 100, transparentBackground && format == 'png',
								ignoreSelection, addShadow, editable && format == 'png', border,
								!cropImage, currentPage, format, grid, null, theme, exportType);

							if (done != null)
							{
								done(scale, transparentBackground, ignoreSelection, addShadow,
									editable, embedImages, border, cropImage, currentPage,
									dummy, grid, theme, exportType);
							}
						}
					}), true, defaultEditable, format, true);
			}
			else if (!editorUi.isOffline() && (!mxClient.IS_IOS || !navigator.standalone))
			{
				editorUi.showRemoteExportDialog(mxResources.get('export'), null, mxUtils.bind(this,
					function(ignoreSelection, editable, transparent, scale, border)
				{
					editorUi.downloadFile((editable && format == 'png') ? 'xmlpng' : format,
						null, null, ignoreSelection, null, null, transparent, scale, border);
				}), false, true);
			}
		};
		
		editorUi.actions.put('exportPng', new Action('formatPng' + '...', function()
		{
			exportImage('png', editorUi.lastExportPngEditable, function(scale,
				transparentBackground, ignoreSelection, addShadow, editable)
			{
				editorUi.lastExportPngEditable = editable;
			});
		}));
		
		editorUi.actions.put('exportJpg', new Action('formatJpg' + '...', function()
		{
			exportImage('jpeg');
		}));
		
		editorUi.actions.put('exportWebp', new Action('formatWebp' + '...', function()
		{
			exportImage('webp');
		}));

		action = editorUi.actions.addAction('copyAsImage', mxUtils.bind(this, function()
		{
			var cells = mxUtils.sortCells(graph.model.getTopmostCells(graph.getSelectionCells()));
			var xml = mxUtils.getXml((cells.length == 0) ? editorUi.editor.getGraphXml() : graph.encodeCells(cells));
			editorUi.copyImage(cells, xml);
		}), null, null, Editor.ctrlKey + '+' + Editor.altKey + '+X');

		action.visible = Editor.enableNativeClipboard && editorUi.editor.isExportToCanvas();

		action = editorUi.actions.addAction('copyAsSvg', mxUtils.bind(this, function()
		{
			var cells = mxUtils.sortCells(graph.model.getTopmostCells(graph.getSelectionCells()));
			var xml = mxUtils.getXml((cells.length == 0) ? editorUi.editor.getGraphXml() : graph.encodeCells(cells));
			editorUi.copySvg(cells, xml);
		}), null, null, Editor.ctrlKey + '+' + Editor.altKey + '+' + Editor.shiftKey + '+X');

		action.visible = Editor.enableNativeClipboard && editorUi.editor.isExportToCanvas();

		action = editorUi.actions.put('shadowVisible', new Action('shadow', function()
		{
			graph.setShadowVisible(!graph.shadowVisible);
		}));
		action.setToggleAction(true);
		action.setSelectedCallback(function() { return graph.shadowVisible; });

		editorUi.actions.put('about', new Action('v' + EditorUi.VERSION, function(arg1, evt)
		{
			if (mxEvent.isShiftDown(evt) && (EditorUi.isElectronApp ||
				editorUi.isOwnGDriveDomain()))
			{
				if (urlParams['test'] == '1')
				{
					EditorUi.debug('Debug output disabled');
					urlParams['test'] = '0';
				}
				else
				{
					urlParams['test'] = '1';
					EditorUi.debug('Debug output enabled');
				}
			}
		}));
		
		editorUi.actions.addAction('support...', function()
		{
			if (EditorUi.isElectronApp)
			{
				editorUi.openLink('https://github.com/jgraph/drawio-desktop/wiki/Getting-Support');
			}
			else
			{
				editorUi.openLink('https://github.com/jgraph/drawio/wiki/Getting-Support');
			}
		});

		editorUi.actions.addAction('downloadDesktop...', function()
		{
			editorUi.openLink('https://get.diagrams.net/');
		});

		editorUi.actions.addAction('exportOptionsDisabled...', function()
		{
			editorUi.handleError({message: mxResources.get('exportOptionsDisabledDetails')},
				mxResources.get('exportOptionsDisabled'));
		});

		/*
			*
			* Added by Software Engineering team
			*
		*/
		// ======	NOLAI - {- Backend -} /Sprint 1/ Task 16	=====
		// ======   NOLAI - {- Frontend -} /Sprint 2/ Task 98   =====
		// ======   NOLAI - {- Backend / Frontend -} /Sprint 4/ Task 148 — Smart Save / Save As / ⌘+S =====
		//
		// SAVE / SAVE AS — professional-app behaviour.
		//
		// Two actions are registered:
		//   'Save'     — quick path: PUTs the current XML straight back to the
		//                Nextcloud file the editor is currently bound to (recorded
		//                in _nolaiCurrentNextcloudFile). Falls through to the Save
		//                As dialog when there's no bound file yet (first save) or
		//                when no Nextcloud session is available.
		//   'Save As'  — always opens the dialog so the user can pick / change
		//                the filename. Useful for first-time saves or "save a copy".
		//
		// Both actions converge on finalizeSaveSuccess() once the WebDAV PUT
		// returns 2xx — that helper handles every UI side-effect a "real" save
		// triggers in a desktop app:
		//   1. Update the in-memory LocalFile.title so any later rename or save
		//      uses the new filename as the source.
		//   2. Update the title bar via updateNolaiFileTitle.
		//   3. Record the binding in _nolaiCurrentNextcloudFile so future
		//      ⌘+S calls hit the quick path.
		//   4. Clear editorUi.editor.modified so drawio's "unsaved changes"
		//      affordance (titlebar asterisk, beforeunload warning) clears.
		//   5. Show a status line.
		//
		// WHY one helper rather than duplicating the success block:
		//   The two save flows have to do exactly the same work on success;
		//   keeping the code in one place removes the risk of drift (e.g. one
		//   path forgets to clear modified and ⌘+S keeps re-prompting).
		// ====== end of changes by SE ======

		// nolaiNextcloudBaseUrl — the Nextcloud root that all save/load WebDAV
		// calls in this file build URLs against. Centralised so the constant
		// only appears once and the multiple actions below stay aligned.
		var nolaiNextcloudBaseUrl = 'https://localhost';

		// finalizeSaveSuccess — single source of truth for what "save was
		// successful" means in UI terms. Called by both the quick save path
		// and the Save As dialog when the WebDAV PUT returns 2xx.
		function finalizeSaveSuccess(fname, remotePath)
		{
			// Update the in-memory LocalFile so subsequent rename / save uses
			// the saved filename as the source. Setting `title` directly
			// rather than calling rename() to avoid recursing into our rename
			// override, which would attempt another WebDAV operation.
			var current = editorUi.getCurrentFile();
			if (current != null) { current.title = fname; }

			// Record the binding so the next ⌘+S goes straight to a silent PUT.
			if (typeof nolaiSetCurrentNextcloudFile === 'function')
			{
				nolaiSetCurrentNextcloudFile(fname, remotePath || '/');
			}

			// Update the toolbar filename and document title.
			if (typeof updateNolaiFileTitle === 'function') { updateNolaiFileTitle(fname); }

			// Clear the modified flag so drawio stops flagging the file as
			// dirty (titlebar asterisk, beforeunload, etc.).
			editorUi.editor.modified = false;
			if (current != null && typeof current.setModified === 'function')
			{
				try { current.setModified(false); } catch (e) { /* not all file types support this */ }
			}

			editorUi.editor.setStatus('Saved to Nextcloud — ' + fname);
		}

		// quickSaveCurrentFile — synchronous attempt at a no-dialog save. Returns
		// true if the save was started (caller should not open a dialog), false
		// if the preconditions weren't met (caller should open Save As).
		//
		// Preconditions: a tracked Nextcloud file AND a cached signed-in session.
		// If either is missing, we cannot do a silent save without surprising
		// the user, so we return false and let the dialog flow take over.
		function quickSaveCurrentFile()
		{
			if (typeof saveDrawIOToNextcloudXML !== 'function') { return false; }
			if (typeof nolaiGetCurrentNextcloudFile !== 'function') { return false; }

			var bound = nolaiGetCurrentNextcloudFile();
			var session = (typeof _nextcloudSessionCache !== 'undefined') ? _nextcloudSessionCache : null;

			if (!bound || !session || !session.username || !session.password)
			{
				return false;
			}

			// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 — staleness guard ======
			// If the editor's current LocalFile no longer matches what the tracker
			// thinks we're bound to (e.g. the user clicked File → New and is now
			// editing a fresh untitled document), the binding is stale and a
			// silent PUT would overwrite the wrong Nextcloud file. In that case
			// drop the binding and force the caller into the Save As dialog.
			//
			// Title equality is sufficient because every place that updates the
			// tracker also updates currentFile.title to the same value.
			// ====== end of changes by SE ======
			var current = editorUi.getCurrentFile();
			var currentTitle = (current != null && typeof current.getTitle === 'function')
				? current.getTitle() : null;
			if (currentTitle !== bound.filename)
			{
				if (typeof nolaiClearCurrentNextcloudFile === 'function') { nolaiClearCurrentNextcloudFile(); }
				return false;
			}

			var fname = bound.filename;
			var remotePath = bound.remotePath || '/';
			var xmlContent = editorUi.getFileData(true);
			var url = nolaiNextcloudBaseUrl + '/remote.php/dav/files/' + encodeURIComponent(session.username) + '/';

			editorUi.spinner.spin(document.body, 'Saving…');

			saveDrawIOToNextcloudXML(fname, xmlContent, url, session.username, session.password, remotePath)
				.then(function(ok)
				{
					editorUi.spinner.stop();
					if (ok)
					{
						finalizeSaveSuccess(fname, remotePath);
					}
					else
					{
						// Quick save failed — the file may have been deleted or
						// renamed on the server. Drop the binding and let the
						// next action open the Save As dialog so the user can
						// pick a new name.
						if (typeof nolaiClearCurrentNextcloudFile === 'function') { nolaiClearCurrentNextcloudFile(); }
						editorUi.handleError({message: 'Save failed. The file may have been moved or deleted on Nextcloud — please use Save As.'});
					}
				})
				.catch(function(err)
				{
					editorUi.spinner.stop();
					editorUi.handleError({message: 'Save error: ' + err.message});
				});

			return true;
		}

		// openSaveAsDialog — the existing professional Save dialog, extracted
		// so both 'Save' (when there's no bound file) and 'Save As' can reuse it.
		// On success it converges on finalizeSaveSuccess just like the quick path.
		function openSaveAsDialog()
		{
			var currentFile = editorUi.getCurrentFile();
			var filename = (currentFile != null && currentFile.getTitle() != null) ?
				currentFile.getTitle() : editorUi.defaultFilename;

			if (!filename.endsWith('.drawio') && !filename.endsWith('.xml'))
			{
				filename = filename.replace(/\.[^/.]+$/, '') + '.drawio';
			}

			var nolaiColor = '#008f89';

			var div = document.createElement('div');
			div.style.cssText = 'padding: 20px; font-family: Helvetica, Arial, sans-serif; color: #333;';

			var title = document.createElement('h2');
			title.innerHTML = 'Save diagram to Nextcloud';
			title.style.cssText = 'margin: 0 0 15px 0; color: ' + nolaiColor + '; font-size: 18px; border-bottom: 2px solid ' + nolaiColor + '; padding-bottom: 10px;';
			div.appendChild(title);

			// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
			// Nextcloud base URL — WebDAV paths are built from this + the uid returned by the banner.
			var nextcloudBaseUrl = nolaiNextcloudBaseUrl;
			var nextcloudUsername = null; // uid, populated by the session banner on connect
			var nextcloudPassword = null; // app password for WebDAV Basic Auth, also from banner

			// Attach the session banner. It restores a cached session immediately if one
			// exists, or shows a "Connect to Nextcloud" button for first-time login.
			if (typeof attachNextcloudSessionBanner === 'function') {
				attachNextcloudSessionBanner(div, nextcloudBaseUrl, function(username, appPassword) {
					nextcloudUsername = username;
					nextcloudPassword = appPassword;
				});
			}
			// ====== end of changes by SE ======

			// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
			// Filename input: the base name is editable; '.drawio' is a read-only greyed suffix.
			// WHY split display rather than a single editable field:
			//   Appending '.drawio' inside the input value looks editable and users tend to
			//   delete or change it. Rendering the extension as a separate locked suffix makes
			//   it visually clear that the extension is fixed, matching common IDE conventions.
			var baseFilename = filename.endsWith('.drawio') ? filename.slice(0, -7) : filename;

			var filenameGroup = document.createElement('div');
			filenameGroup.style.marginBottom = '12px';

			var filenameLbl = document.createElement('label');
			filenameLbl.innerHTML = 'Filename';
			filenameLbl.style.cssText = 'display:block; font-size:12px; font-weight:bold; margin-bottom:4px; color:#666;';

			// Wrapper that visually looks like one input field.
			var filenameWrapper = document.createElement('div');
			filenameWrapper.style.cssText = [
				'display:flex',
				'align-items:stretch',
				'border:1px solid #ccc',
				'border-radius:4px',
				'overflow:hidden',
				'font-size:14px',
				'box-sizing:border-box',
			].join(';');

			var filenameInput = document.createElement('input');
			filenameInput.type = 'text';
			filenameInput.value = baseFilename;
			filenameInput.placeholder = 'my-diagram';
			filenameInput.style.cssText = [
				'flex:1',
				'padding:8px',
				'border:none',
				'outline:none',
				'font-size:14px',
				'background:transparent',
				'min-width:0',
			].join(';');

			// Highlight the wrapper border on focus, matching the createField behaviour.
			filenameInput.addEventListener('focus', function() {
				filenameWrapper.style.borderColor = nolaiColor;
				filenameWrapper.style.boxShadow = '0 0 3px ' + nolaiColor;
			});
			filenameInput.addEventListener('blur', function() {
				filenameWrapper.style.borderColor = '#ccc';
				filenameWrapper.style.boxShadow = 'none';
			});

			var filenameSuffix = document.createElement('span');
			filenameSuffix.innerHTML = '.drawio';
			filenameSuffix.style.cssText = [
				'padding:8px 10px',
				'background:#f0f0f0',
				'color:#999',
				'font-size:14px',
				'border-left:1px solid #ccc',
				'user-select:none',
				'flex-shrink:0',
				'display:flex',
				'align-items:center',
			].join(';');

			filenameWrapper.appendChild(filenameInput);
			filenameWrapper.appendChild(filenameSuffix);
			filenameGroup.appendChild(filenameLbl);
			filenameGroup.appendChild(filenameWrapper);
			div.appendChild(filenameGroup);
			// ====== end of changes by SE ======

			// Dialog logic
			var dlg = new CustomDialog(editorUi, div, function()
			{
				// Build the WebDAV URL from the base URL and the username detected by the banner.
				if (!nextcloudUsername) {
					editorUi.handleError({message: 'Please log in to Nextcloud before saving.'});
					return;
				}
				var url = nextcloudBaseUrl + '/remote.php/dav/files/' + encodeURIComponent(nextcloudUsername) + '/';

				// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
				// Build the full filename from the base-name input + forced extension.
				var baseVal = filenameInput.value.trim().replace(/\.drawio$/i, '');
				if (!baseVal) {
					editorUi.handleError({message: 'Please enter a filename.'});
					return;
				}
				var fname = baseVal + '.drawio';
				// ====== end of changes by SE ======

				if (typeof saveDrawIOToNextcloudXML !== 'function')
				{
					editorUi.handleError({message: 'NextcloudFile.js is not loaded'});
					return;
				}

				editorUi.spinner.spin(document.body, 'Saving to Nextcloud...');

				// Take the editor XML at SAVE TIME (not dialog-open time) so any
				// edits the user made while the dialog was open are persisted.
				var xmlContent = editorUi.getFileData(true);

				// App password used for Basic Auth; session cookie deliberately omitted (see buildNextcloudWebdavBaseContext).
				saveDrawIOToNextcloudXML(fname, xmlContent, url, nextcloudUsername, nextcloudPassword, '/').then(function(ok)
				{
					editorUi.spinner.stop();
					if (ok)
					{
						// Converge on the same success-side-effects as quickSaveCurrentFile.
						finalizeSaveSuccess(fname, '/');
					}
					else
					{
						editorUi.handleError({message: 'Failed to save to Nextcloud. Check console for details.'});
					}
				}).catch(function(error)
				{
					editorUi.spinner.stop();
					editorUi.handleError({message: 'Error: ' + error.message});
				});
			});

			dlg.okButton.innerHTML = 'Save Diagram';
			dlg.okButton.style.backgroundColor = nolaiColor;
			dlg.okButton.style.backgroundImage = 'none';
			dlg.okButton.style.color = '#fff';

			editorUi.showDialog(dlg.container, 450, 280, true, true);
			filenameInput.focus();
		}

		// 'Save' — quick save when possible, dialog when not. Hooked to ⌘+S
		// further below by overriding the createRevision action's funct.
		editorUi.actions.addAction('Save', function()
		{
			if (!quickSaveCurrentFile())
			{
				openSaveAsDialog();
			}
		});

		// 'Save As' — always opens the dialog. Useful for first-time saves and
		// for saving a copy under a new name without breaking the binding for
		// the original (we deliberately update the binding to the new name on
		// success — matching desktop apps where Save As re-binds the editor
		// to the just-created file).
		editorUi.actions.addAction('Save As', function()
		{
			openSaveAsDialog();
		});

		// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 148 — keyboard shortcut & built-in save routing ======
		//
		// drawio's keyboard handler in js/grapheditor/EditorUi.js (line ~6464)
		// binds Ctrl/⌘+S directly to the lowercase 'save' action, and ⌘+Shift+S
		// to 'saveAs'. Those built-in actions, when triggered against a LocalFile
		// or in the standalone editor, open drawio's native "Save as" dialog —
		// the one with Google Drive / OneDrive / Dropbox in the "Where:" dropdown.
		// In our deployment that's wrong: the only sanctioned remote storage is
		// Nextcloud, and we already have a dedicated Save dialog for it.
		//
		// We replace the funct on those built-in Action objects so EVERY path
		// that ends up calling them — keyboard shortcuts, theme menus, internal
		// drawio code that invokes editorUi.actions.get('save').funct() — routes
		// into our Nextcloud Save / Save As flow instead. This is safe because
		// bindAction's closure reads action.funct at invocation time (see
		// keyHandler.bindAction in grapheditor/EditorUi.js), so the binding
		// established at startup picks up our override automatically.
		//
		// We also override 'createRevision' for completeness — it has the same
		// keyboard hint metadata and some themes display it as a separate menu
		// item that delegates to 'save'.
		//
		// Local-disk download remains accessible through File → Export → XML
		// (drawio's separate 'export' action, which we deliberately leave
		// untouched). Cloud storage providers other than Nextcloud are no
		// longer reachable via Save / Save As.
		// ====== end of changes by SE ======
		(function() {
			// Helper: replace an action's funct if the action exists. Logging on
			// success makes it obvious in the console which built-in actions were
			// successfully captured at startup.
			function redirectAction(actionName, target)
			{
				var a = editorUi.actions.get(actionName);
				if (a)
				{
					a.funct = function() { editorUi.actions.get(target).funct(); };
				}
			}

			redirectAction('save',           'Save');     // Ctrl+S        → smart Save
			redirectAction('saveAs',         'Save As');  // Ctrl+Shift+S  → Save As dialog
			redirectAction('createRevision', 'Save');     // legacy menu item → smart Save
		})();
	
		// ======	NOLAI - {- Backend -} /Sprint 1/ Task 92	=====
		// ======   NOLAI - {- Frontend -} /Sprint 2/ Task 100  =====
		// ======   NOLAI - {- Frontend -} /Sprint 4/ Task 191  =====
		// ======   NOLAI - {- Backend -} /Sprint 4/ Task 192   =====
		//
		// 'My Files' action — full two-panel Nextcloud-style Files UI.
		//
		// Layout (960 x 580px dialog):
		//   Left panel  (300px) — scrollable .drawio file list with collaborator chips.
		//   Right panel (auto)  — file header + two tabs shown on file selection:
		//     Sharing tab  — public share link (create/copy/remove), share-with-people
		//                    search field, existing user shares with permissions
		//                    dropdown and x remove button, "Others with access"
		//                    collapsible, internal link copy button.
		//     Versions tab — version list + live read-only Graph preview + Restore.
		//   Bottom row — Delete (left/red), Load Diagram + Close (right/teal+white).
		//
		// WHY one unified dialog:
		//   Nextcloud's Files sidebar surfaces management, sharing and versioning in
		//   one place. Mirroring that here removes context switching — the user never
		//   needs to close one dialog and open another to share then check versions.
		//
		// The standalone 'Version History' menu action is kept as a shortcut for
		// the currently open file. This tab shows versions for the *selected* file.
		// ====== end of changes by SE ======
		editorUi.actions.addAction('My Files', function()
		{
			var nolaiColor = '#008f89';
			var nextcloudBaseUrl = 'https://localhost';
			var nextcloudUsername = null;
			var nextcloudPassword = null;

			if (typeof listDrawIOFilesInNextcloud !== 'function' ||
				typeof getDrawIOFromNextcloudXML !== 'function' ||
				typeof deleteFileInNextcloud !== 'function')
			{
				editorUi.handleError({message: 'NextcloudFile.js helpers are not loaded.'});
				return;
			}

			var fetchNextcloudFiles = function()
			{
				var davUrl = nextcloudBaseUrl + '/remote.php/dav/files/' + encodeURIComponent(nextcloudUsername) + '/';

				listDrawIOFilesInNextcloud(davUrl, null, nextcloudPassword, '/').then(function(files)
				{
					editorUi.spinner.stop();

					if (!files || files.length === 0)
					{
						editorUi.handleError({message: 'No .drawio files found in Nextcloud.'});
						return;
					}

					// ---- State ----
					var selectedFile    = null;
					var selectedRowEl   = null;
					var rowEls          = [];
					var currentTab      = 'sharing';
					var versionsLoadedFor = null;

					// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
					// makeChip — circular avatar showing the first initial of a display name.
					// WHY initials not real avatar images: fetching one image per share across
					// every file would add M*N HTTP requests. Initials render instantly with no
					// network cost and match Nextcloud's own photo fallback behaviour.
					// ====== end of changes by SE ======
					function makeChip(displayName, size, marginLeft)
					{
						var sz = size || 22;
						var chip = document.createElement('div');
						chip.title = displayName || '';
						chip.textContent = (displayName || '?').charAt(0).toUpperCase();
						chip.style.cssText = [
							'width:'  + sz + 'px', 'height:' + sz + 'px',
							'border-radius:50%', 'background:' + nolaiColor, 'color:#fff',
							'font-size:' + Math.floor(sz * 0.5) + 'px', 'font-weight:bold',
							'display:flex', 'align-items:center', 'justify-content:center',
							'border:2px solid #fff', 'margin-left:' + (marginLeft || 0) + 'px',
							'cursor:default', 'flex-shrink:0', 'font-family:Helvetica,Arial,sans-serif',
						].join(';');
						return chip;
					}

					// ---- Dialog root ----
					var root = document.createElement('div');
					root.style.cssText = 'display:flex;flex-direction:column;height:520px;font-family:Helvetica,Arial,sans-serif;color:#333;';

					var bodyRow = document.createElement('div');
					bodyRow.style.cssText = 'display:flex;flex:1;overflow:hidden;min-height:0;';
					root.appendChild(bodyRow);

					// ---- Left panel: file list ----
					var leftPanel = document.createElement('div');
					leftPanel.style.cssText = 'width:300px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid #e0e0e0;';
					bodyRow.appendChild(leftPanel);

					var leftHdr = document.createElement('div');
					leftHdr.style.cssText = 'padding:14px 16px 10px;font-size:14px;font-weight:600;color:' + nolaiColor + ';border-bottom:1px solid #e0e0e0;flex-shrink:0;';
					leftHdr.innerHTML = 'Files <span style="color:#999;font-weight:400;font-size:12px;">.drawio only</span>';
					leftPanel.appendChild(leftHdr);

					var fileListEl = document.createElement('div');
					fileListEl.style.cssText = 'flex:1;overflow-y:auto;padding:4px 0;outline:none;';
					fileListEl.setAttribute('tabindex', '0');
					leftPanel.appendChild(fileListEl);

					// ---- Right panel: detail pane ----
					var rightPanel = document.createElement('div');
					rightPanel.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;';
					bodyRow.appendChild(rightPanel);

					var noSelEl = document.createElement('div');
					noSelEl.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#bbb;';
					noSelEl.innerHTML = '<div style="font-size:40px;opacity:0.25;">\uD83D\uDCC4</div><div style="font-size:13px;">Select a file to see details</div>';
					rightPanel.appendChild(noSelEl);

					var detailEl = document.createElement('div');
					detailEl.style.cssText = 'flex:1;display:none;flex-direction:column;overflow:hidden;';
					rightPanel.appendChild(detailEl);

					var dHdr = document.createElement('div');
					dHdr.style.cssText = 'padding:14px 16px 10px;border-bottom:1px solid #e0e0e0;flex-shrink:0;';
					detailEl.appendChild(dHdr);

					var dFilename = document.createElement('div');
					dFilename.style.cssText = 'font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
					dHdr.appendChild(dFilename);

					// ---- Tab bar ----
					var tabBar = document.createElement('div');
					tabBar.style.cssText = 'display:flex;border-bottom:1px solid #e0e0e0;flex-shrink:0;background:#fafafa;';
					detailEl.appendChild(tabBar);

					function makeTabBtn(label, tabId)
					{
						var btn = document.createElement('button');
						btn.textContent = label;
						btn.dataset.tabId = tabId;
						btn.style.cssText = 'padding:9px 16px;border:none;background:transparent;cursor:pointer;font-size:13px;color:#555;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:Helvetica,Arial,sans-serif;';
						btn.onclick = function() { switchTab(tabId); };
						tabBar.appendChild(btn);
						return btn;
					}
					var tabSharing  = makeTabBtn('Sharing',  'sharing');
					var tabVersions = makeTabBtn('Versions', 'versions');

					var tabContent = document.createElement('div');
					tabContent.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;';
					detailEl.appendChild(tabContent);

					var sharingPane = document.createElement('div');
					sharingPane.style.cssText = 'display:none;flex-direction:column;gap:14px;overflow-y:auto;padding:14px 16px;flex:1;';
					tabContent.appendChild(sharingPane);

					var versionsPane = document.createElement('div');
					versionsPane.style.cssText = 'display:none;flex-direction:column;flex:1;overflow:hidden;';
					tabContent.appendChild(versionsPane);

					function switchTab(tabId)
					{
						currentTab = tabId;
						[tabSharing, tabVersions].forEach(function(btn)
						{
							var on = btn.dataset.tabId === tabId;
							btn.style.color = on ? nolaiColor : '#555';
							btn.style.borderBottomColor = on ? nolaiColor : 'transparent';
							btn.style.fontWeight = on ? '600' : '400';
						});
						sharingPane.style.display  = tabId === 'sharing'  ? 'flex' : 'none';
						versionsPane.style.display = tabId === 'versions' ? 'flex' : 'none';
						if (tabId === 'versions' && selectedFile) { renderVersionsPane(selectedFile); }
					}

					// ---- Bottom button row ----
					var btnRow = document.createElement('div');
					btnRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid #e0e0e0;flex-shrink:0;background:#fafafa;';
					root.appendChild(btnRow);

					var deleteBtn = document.createElement('button');
					deleteBtn.textContent = 'Delete';
					deleteBtn.disabled = true;
					deleteBtn.style.cssText = 'padding:8px 14px;border:none;border-radius:4px;background:#e74c3c;color:#fff;cursor:pointer;font-size:13px;opacity:0.35;font-family:Helvetica,Arial,sans-serif;';
					btnRow.appendChild(deleteBtn);

					var rightBtns = document.createElement('div');
					rightBtns.style.cssText = 'display:flex;gap:8px;';
					btnRow.appendChild(rightBtns);

					var closeBtn = document.createElement('button');
					closeBtn.textContent = 'Close';
					closeBtn.style.cssText = 'padding:8px 14px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;font-size:13px;font-family:Helvetica,Arial,sans-serif;';
					closeBtn.onclick = function() { editorUi.hideDialog(); };
					rightBtns.appendChild(closeBtn);

					var loadBtn = document.createElement('button');
					loadBtn.textContent = 'Load Diagram';
					loadBtn.disabled = true;
					loadBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:4px;background:' + nolaiColor + ';color:#fff;cursor:pointer;font-size:13px;font-weight:600;opacity:0.35;font-family:Helvetica,Arial,sans-serif;';
					rightBtns.appendChild(loadBtn);

					// ---- Select a file ----
					function selectFile(file, rowEl)
					{
						if (selectedRowEl) { selectedRowEl.style.background = ''; }
						selectedFile  = file;
						selectedRowEl = rowEl;
						rowEl.style.background = 'rgba(0,143,137,0.12)';
						loadBtn.disabled   = false; loadBtn.style.opacity   = '1';
						deleteBtn.disabled = false; deleteBtn.style.opacity = '1';
						noSelEl.style.display   = 'none';
						detailEl.style.display  = 'flex';
						dFilename.textContent   = file.displayPath;
						sharingPane.innerHTML   = '';
						var ph = document.createElement('div');
						ph.style.cssText = 'color:#aaa;font-size:12px;';
						ph.textContent = 'Loading sharing info\u2026';
						sharingPane.appendChild(ph);
						versionsLoadedFor = null;
						switchTab('sharing');
						loadSharingData(file);
					}

					// ---- Load diagram ----
					loadBtn.onclick = function()
					{
						if (!selectedFile) { return; }
						var file = selectedFile;
						var performLoad = function()
						{
							editorUi.spinner.spin(document.body, 'Loading from Nextcloud\u2026');
							getDrawIOFromNextcloudXML(file.name, davUrl, null, nextcloudPassword, file.remotePath)
								.then(function(xml)
								{
									editorUi.spinner.stop();
									if (!xml) { editorUi.handleError({message: 'Failed to load file.'}); return; }
									try
									{
										editorUi.fileLoaded(new LocalFile(editorUi, xml, file.name, true), true);
										editorUi.editor.modified = false;
										editorUi.editor.setStatus('Loaded from Nextcloud successfully');
										if (typeof updateNolaiFileTitle === 'function') { updateNolaiFileTitle(file.name); }
										// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 ======
										// Bind editor so next Cmd+S saves to this Nextcloud path automatically.
										// ====== end of changes by SE ======
										if (typeof nolaiSetCurrentNextcloudFile === 'function')
										{
											nolaiSetCurrentNextcloudFile(file.name, file.remotePath || '/');
										}
									}
									catch (e) { editorUi.handleError({message: 'Invalid diagram: ' + e.message}); }
									editorUi.hideDialog();
								})
								.catch(function(err) { editorUi.spinner.stop(); editorUi.handleError({message: 'Load error: ' + err.message}); });
						};
						if (editorUi.editor.modified)
						{
							editorUi.confirm(mxResources.get('allChangesLost'), null, performLoad,
								mxResources.get('cancel'), mxResources.get('discardChanges'));
						}
						else { performLoad(); }
					};

					// ====== NOLAI - {- Backend -} /Sprint 2/ Task 117 ======
					// ====== NOLAI - {- Frontend -} /Sprint 2/ Task 108 ======
					// ---- Delete file ----
					deleteBtn.onclick = function()
					{
						if (!selectedFile) { return; }
						var file = selectedFile;
						editorUi.confirm('Delete "' + file.displayPath + '" from Nextcloud?', null, function()
						{
							editorUi.spinner.spin(document.body, 'Deleting\u2026');
							deleteFileInNextcloud(davUrl, null, nextcloudPassword, file.remotePath, file.name)
								.then(function(ok)
								{
									editorUi.spinner.stop();
									if (!ok) { editorUi.handleError({message: 'Delete failed.'}); return; }
									var idx = files.indexOf(file);
									if (idx >= 0)
									{
										files.splice(idx, 1);
										if (rowEls[idx] && rowEls[idx].parentNode) { rowEls[idx].parentNode.removeChild(rowEls[idx]); }
										rowEls.splice(idx, 1);
									}
									if (files.length === 0) { editorUi.hideDialog(); return; }
									selectedFile = null; selectedRowEl = null;
									noSelEl.style.display  = '';
									detailEl.style.display = 'none';
									loadBtn.disabled   = true; loadBtn.style.opacity   = '0.35';
									deleteBtn.disabled = true; deleteBtn.style.opacity = '0.35';
									editorUi.editor.setStatus('Deleted from Nextcloud');
								})
								.catch(function(err) { editorUi.spinner.stop(); editorUi.handleError({message: 'Delete error: ' + err.message}); });
						}, mxResources.get('cancel'), 'Delete');
					};

					// ---- Build file rows ----
					files.forEach(function(file, i)
					{
						var row = document.createElement('div');
						row.style.cssText = 'display:flex;align-items:center;padding:7px 12px;cursor:pointer;user-select:none;font-size:13px;gap:8px;';

						var icon = document.createElement('span');
						icon.textContent = '\uD83D\uDCC4';
						icon.style.cssText = 'flex-shrink:0;font-size:14px;opacity:0.55;';
						row.appendChild(icon);

						var nameSpan = document.createElement('span');
						nameSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
						nameSpan.textContent = file.displayPath;
						row.appendChild(nameSpan);

						// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
						// avatarContainer — chips loaded asynchronously via getSharesForFile after
						// dialog opens. Uses lastElementChild (not lastChild) to avoid text nodes.
						// ====== end of changes by SE ======
						var avatarContainer = document.createElement('div');
						avatarContainer.style.cssText = 'display:flex;align-items:center;flex-shrink:0;';
						row.appendChild(avatarContainer);

						row.onmouseover = function() { if (row !== selectedRowEl) { row.style.background = 'rgba(0,0,0,0.04)'; } };
						row.onmouseout  = function() { if (row !== selectedRowEl) { row.style.background = ''; } };
						row.onclick     = function() { selectFile(file, row); };
						row.ondblclick  = function() { if (loadBtn && !loadBtn.disabled) { loadBtn.onclick(); } };

						fileListEl.appendChild(row);
						rowEls.push(row);
					});

					// Keyboard navigation
					fileListEl.onkeydown = function(evt)
					{
						var idx = files.indexOf(selectedFile);
						if      (evt.keyCode === 40 && idx < files.length - 1) { selectFile(files[idx + 1], rowEls[idx + 1]); mxEvent.consume(evt); }
						else if (evt.keyCode === 38 && idx > 0)                { selectFile(files[idx - 1], rowEls[idx - 1]); mxEvent.consume(evt); }
						else if (evt.keyCode === 13 && !loadBtn.disabled)      { loadBtn.onclick(); mxEvent.consume(evt); }
					};

					// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
					// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
					// SHARING TAB
					// loadSharingData fires two parallel OCS calls:
					//   1. getSharesForFile — outbound shares created by this user (type 0=user, 3=public link)
					//   2. getSharesReceivedForFile — shares received by this user for this file ("Others with access")
					// ====== end of changes by SE ======
					function loadSharingData(file)
					{
						Promise.all([
							getSharesForFile(file.name, file.remotePath || '/', nextcloudBaseUrl, nextcloudUsername, nextcloudPassword),
							(typeof getSharesReceivedForFile === 'function')
								? getSharesReceivedForFile(nextcloudBaseUrl, nextcloudUsername, nextcloudPassword, file.name, file.remotePath || '/')
								: Promise.resolve([]),
						]).then(function(results)
						{
							if (selectedFile !== file) { return; }
							renderSharingPane(file, results[0], results[1]);
						}).catch(function()
						{
							if (selectedFile !== file) { return; }
							sharingPane.innerHTML = '';
							var errEl = document.createElement('div');
							errEl.style.cssText = 'color:#c0392b;font-size:12px;';
							errEl.textContent = 'Could not load sharing information.';
							sharingPane.appendChild(errEl);
						});
					}

					function renderSharingPane(file, ownedShares, receivedShares)
					{
						sharingPane.innerHTML = '';

						// WHY parseInt: OCS API sometimes returns share_type as string "0" not integer 0.
						var userShares = ownedShares.filter(function(s) { return parseInt(s.share_type, 10) === 0; });

						// -- Share with people --
						var peopleSec = document.createElement('div');
						var peopleLabel = document.createElement('div');
						peopleLabel.style.cssText = 'font-size:13px;font-weight:600;color:#333;margin-bottom:8px;';
						peopleLabel.textContent = 'Share with people';
						peopleSec.appendChild(peopleLabel);

						var searchInput = document.createElement('input');
						searchInput.type = 'text'; searchInput.placeholder = 'Search by name or email\u2026';
						searchInput.style.cssText = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;font-family:Helvetica,Arial,sans-serif;outline:none;margin-bottom:6px;';
						searchInput.onfocus = function() { searchInput.style.borderColor = nolaiColor; };
						searchInput.onblur  = function() { searchInput.style.borderColor = '#ddd'; setTimeout(function() { searchDrop.style.display = 'none'; }, 200); };
						peopleSec.appendChild(searchInput);

						var searchDrop = document.createElement('div');
						searchDrop.style.cssText = 'border:1px solid #ddd;border-radius:4px;max-height:130px;overflow-y:auto;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:none;margin-bottom:8px;';
						peopleSec.appendChild(searchDrop);

						var searchTimer = null;
						searchInput.oninput = function()
						{
							clearTimeout(searchTimer);
							var q = searchInput.value.trim();
							if (!q) { searchDrop.style.display = 'none'; return; }
							searchTimer = setTimeout(function()
							{
								searchNextcloudUsers(q, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
									.then(function(users)
									{
										searchDrop.innerHTML = '';
										var filtered = users.filter(function(u) { return u.id !== nextcloudUsername && u.id !== 'admin'; });
										if (!filtered.length)
										{
											var none = document.createElement('div');
											none.style.cssText = 'padding:8px 12px;color:#999;font-size:12px;';
											none.textContent = 'No users found';
											searchDrop.appendChild(none);
										}
										filtered.forEach(function(u)
										{
											var label = u.label || u.id;
											var info  = u.shareWithDisplayNameUnique || u.subline || '';
											var dr = document.createElement('div');
											dr.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;font-size:13px;';
											dr.onmouseover = function() { dr.style.background = '#f0f9f8'; };
											dr.onmouseout  = function() { dr.style.background = ''; };
											dr.appendChild(makeChip(label, 28, 0));
											var dt = document.createElement('div');
											dt.innerHTML = '<div style="font-weight:500;">' + label + '</div>' +
												(info && info !== label ? '<div style="font-size:11px;color:#888;">' + info + '</div>' : '');
											dr.appendChild(dt);
											dr.onclick = function()
											{
												searchInput.value = ''; searchDrop.style.display = 'none';
												shareFileWithUser(file.name, u.id, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword, file.remotePath || '/', 3)
													.then(function() { loadSharingData(file); })
													.catch(function(err) { alert('Share failed: ' + err.message); });
											};
											searchDrop.appendChild(dr);
										});
										searchDrop.style.display = '';
									});
							}, 300);
						};

						// Existing user shares list
						var sharesList = document.createElement('div');
						sharesList.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
						if (!userShares.length)
						{
							var noShareEl = document.createElement('div');
							noShareEl.style.cssText = 'color:#aaa;font-size:12px;padding:2px 0;';
							noShareEl.textContent = 'No users have access yet.';
							sharesList.appendChild(noShareEl);
						}
						userShares.forEach(function(share)
						{
							var sRow = document.createElement('div');
							sRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #eee;border-radius:6px;background:#fff;';
							sRow.appendChild(makeChip(share.share_with_displayname || share.share_with, 30, 0));
							var sInfo = document.createElement('div');
							sInfo.style.cssText = 'flex:1;min-width:0;';
							sInfo.innerHTML = '<div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (share.share_with_displayname || share.share_with) + '</div>' +
								'<div style="font-size:11px;color:#888;">' + (share.share_with_additional_info || share.share_with) + '</div>';
							sRow.appendChild(sInfo);
							var permSel = document.createElement('select');
							permSel.style.cssText = 'font-size:12px;padding:3px 6px;border:1px solid #ddd;border-radius:4px;color:#555;cursor:pointer;font-family:Helvetica,Arial,sans-serif;';
							[['Can edit', '3'], ['Read only', '1']].forEach(function(opt)
							{
								var o = document.createElement('option');
								o.textContent = opt[0]; o.value = opt[1];
								if (String(share.permissions) === opt[1]) { o.selected = true; }
								permSel.appendChild(o);
							});
							permSel.onchange = function()
							{
								updateSharePermissions(share.id, parseInt(permSel.value, 10), nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
									.catch(function(err) { alert('Permission update failed: ' + err.message); });
							};
							sRow.appendChild(permSel);
							var rmBtn = document.createElement('button');
							rmBtn.textContent = '\u00D7'; rmBtn.title = 'Remove access';
							rmBtn.style.cssText = 'padding:2px 8px;border:none;background:transparent;color:#bbb;cursor:pointer;font-size:18px;line-height:1;border-radius:4px;';
							rmBtn.onmouseover = function() { rmBtn.style.color = '#e74c3c'; };
							rmBtn.onmouseout  = function() { rmBtn.style.color = '#bbb'; };
							rmBtn.onclick = function()
							{
								rmBtn.disabled = true;
								removeShare(share.id, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
									.then(function() { loadSharingData(file); })
									.catch(function(err) { rmBtn.disabled = false; alert('Could not remove: ' + err.message); });
							};
							sRow.appendChild(rmBtn);
							sharesList.appendChild(sRow);
						});
						peopleSec.appendChild(sharesList);
						sharingPane.appendChild(peopleSec);

						// -- Others with access (files shared WITH the current user) --
						if (receivedShares && receivedShares.length)
						{
							var othersSec = document.createElement('div');
							var othersExpanded = false;
							var othersToggle = document.createElement('button');
							othersToggle.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;color:#555;padding:0;display:flex;align-items:center;gap:4px;font-family:Helvetica,Arial,sans-serif;';
							othersToggle.innerHTML = '\u25B6 Others with access (' + receivedShares.length + ')';
							var othersList = document.createElement('div');
							othersList.style.cssText = 'display:none;flex-direction:column;gap:4px;margin-top:8px;';
							receivedShares.forEach(function(share)
							{
								var oRow = document.createElement('div');
								oRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #eee;border-radius:6px;background:#f9f9f9;';
								oRow.appendChild(makeChip(share.displayname_owner || share.uid_owner, 28, 0));
								var oInfo = document.createElement('div');
								oInfo.innerHTML = '<div style="font-size:13px;">' + (share.displayname_owner || share.uid_owner) + '</div><div style="font-size:11px;color:#888;">Shared with you</div>';
								oRow.appendChild(oInfo);
								othersList.appendChild(oRow);
							});
							othersToggle.onclick = function()
							{
								othersExpanded = !othersExpanded;
								othersToggle.innerHTML = (othersExpanded ? '\u25BC' : '\u25B6') + ' Others with access (' + receivedShares.length + ')';
								othersList.style.display = othersExpanded ? 'flex' : 'none';
							};
							othersSec.appendChild(othersToggle);
							othersSec.appendChild(othersList);
							sharingPane.appendChild(othersSec);
						}

						// Refresh avatar chips in file list for this file
						var fileIdx = files.indexOf(file);
						if (fileIdx >= 0 && rowEls[fileIdx])
						{
							var ac = rowEls[fileIdx].lastElementChild;
							if (ac) { ac.innerHTML = ''; }
							userShares.forEach(function(share, ci) { if (ac) { ac.appendChild(makeChip(share.share_with_displayname || share.share_with, 20, ci > 0 ? -6 : 0)); } });
						}
					}

					// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 ======
					// VERSIONS TAB — mirrors standalone Version History action but for the
					// selected file (which may differ from the currently loaded diagram).
					// ====== end of changes by SE ======
					function formatRelative(ms)
					{
						if (!ms) { return ''; }
						var diff = Math.max(0, Date.now() - ms), s = Math.floor(diff / 1000);
						if (s < 60)  { return 'just now'; }
						var m = Math.floor(s / 60);
						if (m < 60)  { return m + (m === 1 ? ' minute ago' : ' minutes ago'); }
						var h = Math.floor(m / 60);
						if (h < 24)  { return h + (h === 1 ? ' hour ago' : ' hours ago'); }
						var d = Math.floor(h / 24);
						return d + (d === 1 ? ' day ago' : ' days ago');
					}
					function formatBytes(b)
					{
						if (b == null) { return ''; }
						if (b < 1024)      { return b + ' B'; }
						if (b < 1048576)   { return (b / 1024).toFixed(1) + ' KB'; }
						return (b / 1048576).toFixed(1) + ' MB';
					}

					function renderVersionsPane(file)
					{
						if (versionsLoadedFor === file.name) { return; }
						versionsLoadedFor = file.name;
						versionsPane.innerHTML = '';
						versionsPane.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';
						var vLoad = document.createElement('div');
						vLoad.style.cssText = 'padding:16px;color:#888;font-size:13px;';
						vLoad.textContent = 'Loading version history\u2026';
						versionsPane.appendChild(vLoad);

						if (typeof getFileIdFromNextcloud !== 'function' || typeof listFileVersionsInNextcloud !== 'function')
						{
							vLoad.textContent = 'Version helpers not available.'; return;
						}

						getFileIdFromNextcloud(file.name, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword, file.remotePath || '/')
							.then(function(fileId)
							{
								if (!fileId)
								{
									versionsPane.innerHTML = '';
									var noId = document.createElement('div');
									noId.style.cssText = 'padding:14px;background:#fff8e1;border:1px solid #ffb300;border-radius:6px;color:#5d4037;font-size:13px;margin:12px;';
									noId.textContent = 'File not found on Nextcloud \u2014 save it first to enable version history.';
									versionsPane.appendChild(noId); return null;
								}
								return listFileVersionsInNextcloud(fileId, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
									.then(function(v) { return {fileId: fileId, versions: v}; });
							})
							.then(function(result)
							{
								if (!result) { return; }
								versionsPane.innerHTML = '';
								versionsPane.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';
								if (!result.versions || !result.versions.length)
								{
									var emEl = document.createElement('div');
									emEl.style.cssText = 'padding:16px;color:#888;font-size:13px;';
									emEl.innerHTML = 'No prior versions yet.<br><span style="color:#aaa;font-size:11px;">Save the file again to create the first version.</span>';
									versionsPane.appendChild(emEl); return;
								}
								var vBody = document.createElement('div');
								vBody.style.cssText = 'display:flex;flex:1;overflow:hidden;min-height:0;';
								versionsPane.appendChild(vBody);
								var vList = document.createElement('div');
								vList.style.cssText = 'width:190px;flex-shrink:0;border-right:1px solid #e0e0e0;overflow-y:auto;background:#fafafa;';
								vBody.appendChild(vList);
								var vPreview = document.createElement('div');
								vPreview.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#fff;';
								vBody.appendChild(vPreview);
								var vMsg = document.createElement('div');
								vMsg.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#888;font-size:12px;pointer-events:none;text-align:center;';
								vMsg.textContent = 'Select a version to preview';
								vPreview.appendChild(vMsg);
								var vGraph = new Graph(vPreview);
								vGraph.setTooltips(false); vGraph.setEnabled(false); vGraph.setPanning(true);
								vGraph.panningHandler.ignoreCell = true; vGraph.panningHandler.useLeftButtonForPanning = true;
								var vFooter = document.createElement('div');
								vFooter.style.cssText = 'display:flex;align-items:center;padding:8px 12px;border-top:1px solid #e0e0e0;flex-shrink:0;gap:8px;';
								versionsPane.appendChild(vFooter);
								var vStatusLine = document.createElement('span');
								vStatusLine.style.cssText = 'flex:1;font-size:12px;color:#666;';
								vFooter.appendChild(vStatusLine);
								var restoreBtn = document.createElement('button');
								restoreBtn.textContent = 'Restore this version';
								restoreBtn.disabled = true;
								restoreBtn.style.cssText = 'padding:6px 12px;border:none;border-radius:4px;background:' + nolaiColor + ';color:#fff;cursor:pointer;font-size:12px;font-weight:600;opacity:0.35;font-family:Helvetica,Arial,sans-serif;';
								vFooter.appendChild(restoreBtn);
								var selVer = null, selVRow = null;
								function applyPreview(xml)
								{
									try
									{
										var doc = mxUtils.parseXml(xml), node = doc.documentElement;
										if (node.nodeName === 'mxfile') { var d = node.getElementsByTagName('diagram')[0]; if (d) { node = Editor.parseDiagramNode(d); } }
										var codec = new mxCodec(node.ownerDocument);
										vGraph.getModel().clear(); codec.decode(node, vGraph.getModel());
										vGraph.maxFitScale = 1; vGraph.fit(8); vGraph.center();
										vMsg.style.display = 'none';
									}
									catch(e) { vMsg.style.display = ''; vMsg.textContent = 'Preview failed: ' + e.message; }
								}
								function selectVersion(v, rowEl)
								{
									if (selVRow) { selVRow.style.background = ''; selVRow.style.color = ''; }
									selVRow = rowEl; selVer = v;
									rowEl.style.background = nolaiColor; rowEl.style.color = '#fff';
									restoreBtn.disabled = false; restoreBtn.style.opacity = '1';
									vMsg.style.display = ''; vMsg.textContent = 'Loading\u2026';
									getVersionContentFromNextcloud(v.absUrl, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
										.then(function(xml) { if (!xml) { throw new Error('empty'); } applyPreview(xml); })
										.catch(function(err) { vMsg.style.display = ''; vMsg.textContent = 'Preview failed: ' + err.message; });
								}
								result.versions.forEach(function(v, idx)
								{
									var vRow = document.createElement('div');
									vRow.style.cssText = 'padding:8px 10px;border-bottom:1px solid #eee;cursor:pointer;font-size:11px;line-height:1.35;';
									vRow.innerHTML = '<div style="font-weight:600;">' + (v.mtime ? new Date(v.mtime).toLocaleString() : '(unknown)') + '</div>' +
										'<div style="opacity:0.8;">' + formatRelative(v.mtime) + (v.size ? ' \u00B7 ' + formatBytes(v.size) : '') + '</div>';
									vRow.onmouseover = function() { if (vRow !== selVRow) { vRow.style.background = '#eef7f7'; } };
									vRow.onmouseout  = function() { if (vRow !== selVRow) { vRow.style.background = ''; } };
									vRow.onclick = function() { selectVersion(v, vRow); };
									vList.appendChild(vRow);
									if (idx === 0) { setTimeout(function() { selectVersion(v, vRow); }, 0); }
								});
								restoreBtn.onclick = function()
								{
									if (!selVer) { return; }
									var when = selVer.mtime ? new Date(selVer.mtime).toLocaleString() : 'this version';
									editorUi.confirm('Restore the version from ' + when + '?\n\nThe current file is replaced. A new entry is saved so this is reversible.',
										null,
										function()
										{
											restoreBtn.disabled = true; restoreBtn.style.opacity = '0.5';
											vStatusLine.textContent = 'Restoring\u2026';
											restoreVersionInNextcloud(selVer.absUrl, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
												.then(function() { return getDrawIOFromNextcloudXML(file.name, davUrl, null, nextcloudPassword, file.remotePath || '/'); })
												.then(function(xml)
												{
													if (!xml) { throw new Error('Could not reload restored file.'); }
													editorUi.fileLoaded(new LocalFile(editorUi, xml, file.name, true), true);
													editorUi.editor.modified = false;
													if (typeof updateNolaiFileTitle === 'function') { updateNolaiFileTitle(file.name); }
													if (typeof nolaiSetCurrentNextcloudFile === 'function') { nolaiSetCurrentNextcloudFile(file.name, file.remotePath || '/'); }
													editorUi.editor.setStatus('Version restored');
													editorUi.hideDialog();
												})
												.catch(function(err) { vStatusLine.textContent = 'Restore failed: ' + err.message; restoreBtn.disabled = false; restoreBtn.style.opacity = '1'; });
										},
										mxResources.get('cancel'), 'Restore');
								};
							})
							.catch(function(err)
							{
								versionsPane.innerHTML = '';
								var errEl = document.createElement('div');
								errEl.style.cssText = 'padding:12px;background:#fdecea;border-radius:6px;color:#b71c1c;font-size:12px;margin:12px;';
								errEl.textContent = 'Could not load versions: ' + err.message;
								versionsPane.appendChild(errEl);
							});
					}

					// ---- Show dialog ----
					var dlg = new CustomDialog(editorUi, root, function() { loadBtn.onclick(); });
					dlg.okButton.style.display = 'none';
					if (dlg.cancelBtn) { dlg.cancelBtn.style.display = 'none'; }
					editorUi.showDialog(dlg.container, 960, 580, true, false);
					fileListEl.focus();

					// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
					// Progressive chip loading — fires one getSharesForFile per file after the
					// dialog is in the DOM. Uses lastElementChild (not lastChild) to avoid
					// accidental text nodes. Checks parseInt(share_type) for OCS string/int variance.
					// ====== end of changes by SE ======
					if (typeof getSharesForFile === 'function')
					{
						files.forEach(function(file, i)
						{
							getSharesForFile(file.name, file.remotePath || '/', nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
								.then(function(shares)
								{
									if (!rowEls[i]) { return; }
									var ac = rowEls[i].lastElementChild;
									if (!ac) { return; }
									shares.forEach(function(share, ci)
									{
										if (parseInt(share.share_type, 10) !== 0) { return; }
										ac.appendChild(makeChip(share.share_with_displayname || share.share_with, 20, ci > 0 ? -6 : 0));
									});
								});
						});
					}

				}).catch(function(err)
				{
					editorUi.spinner.stop();
					editorUi.handleError({message: 'Error loading file list: ' + err.message});
				});
			};

			// Session banner / auth — same pattern as all other NOLAI actions
			var bannerDiv = document.createElement('div');
			bannerDiv.style.cssText = 'padding: 20px; font-family: Helvetica, Arial, sans-serif; color: #333;';
			var bannerTitle = document.createElement('h2');
			bannerTitle.innerHTML = 'Nextcloud Files';
			bannerTitle.style.cssText = 'margin: 0 0 15px 0; color: ' + nolaiColor + '; font-size: 18px; border-bottom: 2px solid ' + nolaiColor + '; padding-bottom: 10px;';
			bannerDiv.appendChild(bannerTitle);

			if (typeof attachNextcloudSessionBanner !== 'function')
			{
				editorUi.handleError({message: 'Nextcloud session banner is not available.'});
				return;
			}

			var sessionReady = false;
			attachNextcloudSessionBanner(bannerDiv, nextcloudBaseUrl, function(username, appPassword)
			{
				nextcloudUsername = username;
				nextcloudPassword = appPassword;
				sessionReady = true;
				editorUi.hideDialog();
				editorUi.spinner.spin(document.body, 'Loading files from Nextcloud\u2026');
				fetchNextcloudFiles();
			});

			if (!sessionReady)
			{
				var loginDlg = new CustomDialog(editorUi, bannerDiv, null);
				loginDlg.okButton.style.display = 'none';

				editorUi.showDialog(loginDlg.container, 450, 240, true, true);
			}
		});

		// ====== end of changes by SE	======

		// ======	NOLAI - {- Backend -} /Sprint 4/ Task 148 (Version Control)	=====
		// ======   NOLAI - {- Frontend -} /Sprint 4/ Task 148 (Version Control)   =====
		//
		// 'Version History' action — opens an in-app version-control UI that lists
		// every server-side version of the currently open .drawio file, lets the
		// user preview any version on a read-only Graph, and atomically rolls the
		// live file back to a chosen version via WebDAV MOVE to the Nextcloud
		// /restore/target marker.
		//
		// WHY a custom dialog (and not draw.io's built-in RevisionDialog):
		//   The native dialog is wired to ui.getRevisions(), which plugins/nextcloud.js
		//   implements via remoteInvoke('getFileRevisions') — a postMessage RPC that
		//   only works when drawio is embedded inside Nextcloud's parent window. In
		//   our standalone NOLAI deployment drawio is a separate origin, so the
		//   postMessage path has no listener and the native dialog never resolves.
		//   This action calls the Nextcloud Versions WebDAV endpoint directly using
		//   the same auth path as Save / My Files / rename, so it works without any
		//   embedding. The native action is intentionally left untouched so that
		//   future embedded usage (if drawio is ever loaded inside Nextcloud's iframe
		//   integration) keeps working without a code change.
		//
		// Assumptions:
		//   - The file lives at the user's DAV root ('/'). This matches the rename
		//     override and the Save dialog defaults; subfolder support would require
		//     tracking remotePath on LocalFile during load and is a known follow-up.
		//   - The user is signed in to Nextcloud via the existing session banner /
		//     top-bar chip (cached in _nextcloudSessionCache). If not, the dialog
		//     embeds the same session banner used elsewhere so the user can sign in
		//     without leaving Version History.
		//   - The current file has been saved at least once (otherwise no fileid /
		//     no versions exist) — this is detected by a PROPFIND for fileid and
		//     the user is shown a "Save first" message with a shortcut button.
		// ====== end of changes by SE ======
		editorUi.actions.addAction('Version History', function()
		{
			var nolaiColor = '#008f89';
			var nextcloudBaseUrl = 'https://localhost';
			var nextcloudUsername = null;
			var nextcloudPassword = null;

			// Guard: every helper used here is defined in NextcloudFile.js. If the
			// script failed to load we surface an immediate error rather than a
			// confusing "x is not a function" trace later in the flow.
			if (typeof getFileIdFromNextcloud !== 'function' ||
				typeof listFileVersionsInNextcloud !== 'function' ||
				typeof getVersionContentFromNextcloud !== 'function' ||
				typeof restoreVersionInNextcloud !== 'function')
			{
				editorUi.handleError({message: 'Version control helpers are not loaded (NextcloudFile.js).'});
				return;
			}

			// formatRelative — renders ms-since-epoch as "5 minutes ago" / "2 days ago".
			// WHY a tiny inline implementation rather than a date library: draw.io
			// already ships with no date library and adding one for one widget is
			// disproportionate; this covers the four buckets users actually scan for.
			function formatRelative(ms)
			{
				if (!ms) { return ''; }
				var diff = Math.max(0, Date.now() - ms);
				var s = Math.floor(diff / 1000);
				if (s < 60)    { return 'just now'; }
				var m = Math.floor(s / 60);
				if (m < 60)    { return m + (m === 1 ? ' minute ago' : ' minutes ago'); }
				var h = Math.floor(m / 60);
				if (h < 24)    { return h + (h === 1 ? ' hour ago'   : ' hours ago'); }
				var d = Math.floor(h / 24);
				if (d < 30)    { return d + (d === 1 ? ' day ago'    : ' days ago'); }
				var mo = Math.floor(d / 30);
				if (mo < 12)   { return mo + (mo === 1 ? ' month ago' : ' months ago'); }
				var y = Math.floor(d / 365);
				return y + (y === 1 ? ' year ago' : ' years ago');
			}

			// formatBytes — converts a byte count to a short "12.3 KB" string.
			function formatBytes(b)
			{
				if (b == null) { return ''; }
				if (b < 1024)               { return b + ' B'; }
				if (b < 1024 * 1024)        { return (b / 1024).toFixed(1) + ' KB'; }
				return (b / (1024 * 1024)).toFixed(1) + ' MB';
			}

			// showSaveFirst — replaces the dialog body with a friendly "save first"
			// message + a button that triggers the existing Save action. This is
			// shown when the file is untitled or has no fileid on the server.
			function showSaveFirst(container, reasonText)
			{
				container.innerHTML = '';

				var title = document.createElement('h2');
				title.innerHTML = 'Version History';
				title.style.cssText = 'margin: 0 0 15px 0; color: ' + nolaiColor + '; font-size: 18px; border-bottom: 2px solid ' + nolaiColor + '; padding-bottom: 10px;';
				container.appendChild(title);

				var msg = document.createElement('div');
				msg.style.cssText = 'padding: 16px; background: #fff8e1; border: 1px solid #ffb300; border-radius: 6px; color: #5d4037; font-size: 13px; line-height: 1.5;';
				msg.innerHTML = (reasonText ||
					'This diagram has not yet been saved to Nextcloud, so no versions exist.') +
					'<br><br>Save the diagram to Nextcloud first — Nextcloud automatically captures a new version every time you save.';
				container.appendChild(msg);

				var btnRow = document.createElement('div');
				btnRow.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 16px;';

				var saveBtn = document.createElement('button');
				saveBtn.innerHTML = 'Save to Nextcloud…';
				saveBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: ' + nolaiColor + '; color: #fff; cursor: pointer; font-weight: 600;';
				saveBtn.onclick = function()
				{
					editorUi.hideDialog();
					editorUi.actions.get('Save').funct();
				};
				btnRow.appendChild(saveBtn);
				container.appendChild(btnRow);
			}

			// renderVersionList — once we have credentials AND a confirmed fileid,
			// this builds the actual two-pane Version History UI.
			//
			// Layout (700×460):
			//   Header row     — title + session banner (gives the user a way to
			//                    re-authenticate without closing the dialog if their
			//                    app password is rejected mid-session).
			//   Filename strip — small caption above the list, so the user always
			//                    knows which file they are viewing versions of.
			//   Body grid      — left: 220px scrollable version list
			//                    right: ~430px live preview pane with a read-only
			//                           Graph (matches the native RevisionDialog style).
			//   Footer row     — error/status line + Restore + Close buttons.
			function renderVersionList(container, filename, fileId, versions)
			{
				container.innerHTML = '';
				container.style.fontFamily = 'Helvetica, Arial, sans-serif';

				var title = document.createElement('h2');
				title.innerHTML = 'Version History';
				title.style.cssText = 'margin: 0 0 8px 0; color: ' + nolaiColor + '; font-size: 18px; border-bottom: 2px solid ' + nolaiColor + '; padding-bottom: 8px;';
				container.appendChild(title);

				// Filename caption: ellipsis on overflow so very long names do not
				// break the layout.
				var fileLine = document.createElement('div');
				fileLine.style.cssText = 'color:#555; font-size:12px; margin: 0 0 12px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
				fileLine.innerHTML = '<strong>File:</strong> ' + filename;
				container.appendChild(fileLine);

				if (!versions || versions.length === 0)
				{
					var empty = document.createElement('div');
					empty.style.cssText = 'padding: 16px; background: #f5f5f5; border-radius: 6px; color: #555; font-size: 13px;';
					empty.innerHTML =
						'No prior versions yet.<br><br>' +
						'Nextcloud only starts keeping versions <em>after</em> the first re-save. ' +
						'Save the file again to create the first historical version.';
					container.appendChild(empty);
					return;
				}

				// Two-pane body grid.
				var body = document.createElement('div');
				body.style.cssText = 'display: grid; grid-template-columns: 220px 1fr; gap: 12px; height: 320px;';
				container.appendChild(body);

				// ---- Left: version list ----
				// Plain styled buttons rather than a <select> so we can show
				// multi-line entries (timestamp + relative time + size) cleanly.
				var listWrap = document.createElement('div');
				listWrap.style.cssText = 'border: 1px solid #ddd; border-radius: 6px; overflow-y: auto; background: #fafafa;';
				body.appendChild(listWrap);

				// ---- Right: preview pane ----
				var previewWrap = document.createElement('div');
				previewWrap.style.cssText = 'border: 1px solid #ddd; border-radius: 6px; position: relative; overflow: hidden; background: #fff;';
				body.appendChild(previewWrap);

				var previewStatus = document.createElement('div');
				previewStatus.style.cssText = 'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: #888; font-size: 12px; pointer-events: none;';
				previewStatus.innerText = 'Select a version to preview';
				previewWrap.appendChild(previewStatus);

				// Read-only preview Graph. We use the same approach as the native
				// RevisionDialog (Dialogs.js): instantiate a Graph, disable input,
				// then decode the version XML into its model. Pan + scroll is kept
				// on so users can move around large diagrams.
				var previewGraph = new Graph(previewWrap);
				previewGraph.setTooltips(false);
				previewGraph.setEnabled(false);
				previewGraph.setPanning(true);
				previewGraph.panningHandler.ignoreCell = true;
				previewGraph.panningHandler.useLeftButtonForPanning = true;

				// ---- Footer: status line + buttons ----
				var footer = document.createElement('div');
				footer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 14px;';
				container.appendChild(footer);

				var status = document.createElement('span');
				status.style.cssText = 'flex: 1; color: #666; font-size: 12px; min-height: 16px;';
				footer.appendChild(status);

				var closeBtn = document.createElement('button');
				closeBtn.innerHTML = 'Close';
				closeBtn.style.cssText = 'padding: 7px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #333; cursor: pointer;';
				closeBtn.onclick = function() { editorUi.hideDialog(); };
				footer.appendChild(closeBtn);

				var restoreBtn = document.createElement('button');
				restoreBtn.innerHTML = 'Restore this version';
				restoreBtn.disabled = true;
				restoreBtn.style.cssText = 'padding: 7px 14px; border: none; border-radius: 4px; background: ' + nolaiColor + '; color: #fff; cursor: pointer; font-weight: 600; opacity: 0.5;';
				footer.appendChild(restoreBtn);

				// selectedVersion — the entry currently shown in the preview pane,
				// also the version that the Restore button will act on.
				var selectedVersion = null;
				var selectedRow = null;

				// applyXmlToPreview — decodes XML into the preview Graph. We pull
				// the first <diagram> element out of an <mxfile>; that's how
				// drawio's RevisionDialog renders previews. If the XML is just an
				// <mxGraphModel> (older format) we pass it through directly.
				function applyXmlToPreview(xml)
				{
					try
					{
						var doc = mxUtils.parseXml(xml);
						var node = doc.documentElement;
						if (node.nodeName === 'mxfile')
						{
							var diagram = node.getElementsByTagName('diagram')[0];
							if (diagram)
							{
								node = Editor.parseDiagramNode(diagram);
							}
						}
						var codec = new mxCodec(node.ownerDocument);
						previewGraph.getModel().clear();
						codec.decode(node, previewGraph.getModel());
						previewGraph.maxFitScale = 1;
						previewGraph.fit(8);
						previewGraph.center();
						previewStatus.style.display = 'none';
					}
					catch (e)
					{
						previewStatus.style.display = '';
						previewStatus.innerText = 'Could not render preview: ' + e.message;
					}
				}

				// selectVersion — visually marks the row, fetches the XML, renders.
				function selectVersion(version, rowEl)
				{
					if (selectedRow) { selectedRow.style.background = ''; selectedRow.style.color = ''; }
					selectedRow = rowEl;
					selectedVersion = version;
					rowEl.style.background = nolaiColor;
					rowEl.style.color = '#fff';

					restoreBtn.disabled = false;
					restoreBtn.style.opacity = '1';

					previewStatus.style.display = '';
					previewStatus.innerText = 'Loading preview…';
					status.innerText = '';

					getVersionContentFromNextcloud(version.absUrl, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
						.then(function(xml)
						{
							if (!xml) { throw new Error('empty response'); }
							applyXmlToPreview(xml);
						})
						.catch(function(err)
						{
							previewStatus.style.display = '';
							previewStatus.innerText = 'Preview failed: ' + err.message;
						});
				}

				// Build version rows. The most recent version is selected by default
				// so users see something useful immediately on dialog open.
				versions.forEach(function(v, idx)
				{
					var row = document.createElement('div');
					row.style.cssText = 'padding: 8px 10px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 12px; line-height: 1.35; transition: background 0.1s;';

					var dateStr = v.mtime ? new Date(v.mtime).toLocaleString() : '(unknown date)';
					var rel = formatRelative(v.mtime);
					var sizeStr = formatBytes(v.size);

					row.innerHTML =
						'<div style="font-weight:600;">' + dateStr + '</div>' +
						'<div style="opacity:0.85;">' + rel + (sizeStr ? ' &middot; ' + sizeStr : '') + '</div>';

					row.onmouseover = function()
					{
						if (row !== selectedRow) { row.style.background = '#eef7f7'; }
					};
					row.onmouseout = function()
					{
						if (row !== selectedRow) { row.style.background = ''; }
					};
					row.onclick = function() { selectVersion(v, row); };

					listWrap.appendChild(row);

					// Auto-select the newest entry (top of the list).
					if (idx === 0) { setTimeout(function() { selectVersion(v, row); }, 0); }
				});

				// ---- Restore handler ----
				// Two-step: confirm dialog, then MOVE, then reload the live file
				// from Nextcloud so the editor reflects the restored content.
				restoreBtn.onclick = function()
				{
					if (!selectedVersion) { return; }

					var when = selectedVersion.mtime ? new Date(selectedVersion.mtime).toLocaleString() : 'this version';
					editorUi.confirm(
						'Restore the version from ' + when + '?\n\n' +
						'The current diagram will be replaced. The version you are replacing will itself be saved as a new historical entry, so this action is reversible.',
						null,
						function()
						{
							restoreBtn.disabled = true;
							restoreBtn.style.opacity = '0.5';
							status.innerText = 'Restoring…';

							restoreVersionInNextcloud(selectedVersion.absUrl, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
								.then(function()
								{
									// After the server has restored, pull the live file
									// fresh so the editor canvas reflects the rolled-back
									// state. Same load path as My Files.
									return getDrawIOFromNextcloudXML(filename, nextcloudBaseUrl + '/remote.php/dav/files/' + encodeURIComponent(nextcloudUsername) + '/', null, nextcloudPassword, '/');
								})
								.then(function(xml)
								{
									if (!xml) { throw new Error('Could not reload restored file from Nextcloud.'); }
									editorUi.fileLoaded(new LocalFile(editorUi, xml, filename, true), true);
									editorUi.editor.modified = false;
									if (typeof updateNolaiFileTitle === 'function') { updateNolaiFileTitle(filename); }
									// Re-bind the editor to the restored file so a follow-up ⌘+S
									// goes to the same Nextcloud path. The filename hasn't changed,
									// but fileLoaded constructs a fresh LocalFile so the binding
									// would otherwise look "missing" until the user manually saved.
									if (typeof nolaiSetCurrentNextcloudFile === 'function')
									{
										nolaiSetCurrentNextcloudFile(filename, '/');
									}
									editorUi.editor.setStatus('Version restored');
									editorUi.hideDialog();
								})
								.catch(function(err)
								{
									status.innerText = 'Restore failed: ' + err.message;
									restoreBtn.disabled = false;
									restoreBtn.style.opacity = '1';
								});
						},
						mxResources.get('cancel'),
						'Restore'
					);
				};
			}

			// loadVersionsForCurrentFile — runs once both credentials and a current
			// file are known. Resolves the fileid (404 → "save first"), lists
			// versions, then hands off to renderVersionList.
			function loadVersionsForCurrentFile(container)
			{
				var file = editorUi.getCurrentFile();
				var filename = (file != null && typeof file.getTitle === 'function') ? file.getTitle() : null;

				if (!filename)
				{
					showSaveFirst(container, 'No diagram is open in the editor.');
					return;
				}
				if (!/\.drawio$/i.test(filename))
				{
					// Match Save dialog convention — only .drawio files round-trip
					// cleanly through the Nextcloud workflow.
					showSaveFirst(container, 'The current diagram is not yet saved as a .drawio file in Nextcloud.');
					return;
				}

				container.innerHTML =
					'<h2 style="margin:0 0 12px 0;color:' + nolaiColor + ';font-size:18px;border-bottom:2px solid ' + nolaiColor + ';padding-bottom:8px;">Version History</h2>' +
					'<div style="padding:16px;color:#666;font-size:13px;">Loading versions for <strong>' + filename + '</strong>…</div>';

				// WHY pass nextcloudUsername explicitly:
				//   nextcloudBaseUrl is the bare 'https://localhost' root with no DAV path,
				//   so buildNextcloudWebdavBaseContext cannot derive the uid from the URL
				//   (its regex looks for /remote.php/dav/files/{uid}/). Other callers like
				//   My Files pre-build a DAV-style URL with the uid embedded and so pass
				//   null safely; we don't, so we must supply the uid as the username arg.
				getFileIdFromNextcloud(filename, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword, '/')
					.then(function(fileId)
					{
						if (!fileId)
						{
							showSaveFirst(container,
								'The file <strong>' + filename + '</strong> was not found at the root of your Nextcloud folder.');
							return null;
						}
						return listFileVersionsInNextcloud(fileId, nextcloudBaseUrl, nextcloudUsername, nextcloudPassword)
							.then(function(versions) { return { fileId: fileId, versions: versions }; });
					})
					.then(function(result)
					{
						if (!result) { return; } // showSaveFirst already rendered
						renderVersionList(container, filename, result.fileId, result.versions);
					})
					.catch(function(err)
					{
						container.innerHTML = '';
						var title = document.createElement('h2');
						title.innerHTML = 'Version History';
						title.style.cssText = 'margin:0 0 12px 0;color:' + nolaiColor + ';font-size:18px;border-bottom:2px solid ' + nolaiColor + ';padding-bottom:8px;';
						container.appendChild(title);
						var errBox = document.createElement('div');
						errBox.style.cssText = 'padding:16px;background:#fdecea;border:1px solid #f44336;border-radius:6px;color:#b71c1c;font-size:13px;';
						errBox.innerText = 'Could not load versions: ' + err.message;
						container.appendChild(errBox);
					});
			}

			// ---- Build the dialog shell ----
			//
			// We always start with the session banner attached (just like My Files)
			// so the user can authenticate from inside the dialog if they aren't
			// already signed in. The banner's onLoggedIn callback fires both for
			// brand-new logins and for cached sessions, so loadVersionsForCurrentFile
			// runs in both cases.
			var rootDiv = document.createElement('div');
			rootDiv.style.cssText = 'padding: 20px; font-family: Helvetica, Arial, sans-serif; color: #333;';

			var preTitle = document.createElement('h2');
			preTitle.innerHTML = 'Version History';
			preTitle.style.cssText = 'margin:0 0 12px 0;color:' + nolaiColor + ';font-size:18px;border-bottom:2px solid ' + nolaiColor + ';padding-bottom:8px;';
			rootDiv.appendChild(preTitle);

			if (typeof attachNextcloudSessionBanner !== 'function')
			{
				editorUi.handleError({message: 'Nextcloud session banner is not available.'});
				return;
			}

			var sessionReady = false;
			attachNextcloudSessionBanner(rootDiv, nextcloudBaseUrl, function(username, appPassword)
			{
				nextcloudUsername = username;
				nextcloudPassword = appPassword;
				sessionReady = true;
				// Replace the placeholder dialog with the real Version History UI
				// once we have credentials. We swap content rather than reopening
				// a new dialog so the user's "this is one continuous flow" mental
				// model is preserved.
				loadVersionsForCurrentFile(rootDiv);
				// Re-show the dialog with a larger size now that we're showing
				// the two-pane layout.
				editorUi.hideDialog();
				var dlg = new CustomDialog(editorUi, rootDiv, null);
				// Hide CustomDialog's stock OK and Cancel buttons. The Version
				// History footer has its own integrated Close + Restore row, so
				// keeping the stock buttons would just produce a redundant
				// "Cancel" sitting below the dialog content.
				dlg.okButton.style.display = 'none';
				if (dlg.cancelBtn) { dlg.cancelBtn.style.display = 'none'; }
				editorUi.showDialog(dlg.container, 720, 500, true, false);
			});

			if (!sessionReady)
			{
				// User has no cached session — show the slim sign-in dialog. Once
				// they complete login the callback above replaces it with the full
				// Version History UI.
				var loginDlg = new CustomDialog(editorUi, rootDiv, null);
				loginDlg.okButton.style.display = 'none';
				editorUi.showDialog(loginDlg.container, 450, 240, true, true);
			}
		});

		// ====== end of changes by SE	======

		editorUi.actions.addAction('keyboardShortcuts...', function()
		{
			if (!mxClient.IS_CHROMEAPP &&
				!EditorUi.isElectronApp &&
				!navigator.standalone)
			{
				editorUi.openLink('shortcuts.svg');
			}
			else
			{
				editorUi.openLink('https://app.diagrams.net/shortcuts.svg');
			}
		});
		
		editorUi.actions.addAction('quickStart...', function()
		{
			if ('ac.draw.io' === window.location.hostname)
			{
				editorUi.openLink('https://www.youtube.com/watch?v=s5BG0705MHU');
			}
			else
			{
				editorUi.openLink('https://www.youtube.com/watch?v=Z0D96ZikMkc');
			}
		});
		
		action = editorUi.actions.addAction('tags', mxUtils.bind(this, function()
		{
			if (this.tagsWindow == null)
			{
				this.tagsWindow = new TagsWindow(editorUi, document.body.offsetWidth - 400, 60, 212, 200);
				this.tagsWindow.window.addListener('show', mxUtils.bind(this, function()
				{
					editorUi.fireEvent(new mxEventObject('tags'));
				}));
				this.tagsWindow.window.addListener('hide', function()
				{
					editorUi.fireEvent(new mxEventObject('tags'));
				});
				this.tagsWindow.window.setVisible(true);
				editorUi.fireEvent(new mxEventObject('tags'));
			}
			else
			{
				this.tagsWindow.window.setVisible(!this.tagsWindow.window.isVisible());
			}
		}), null, null, Editor.ctrlKey + '+K');
		action.setToggleAction(true);
		action.setSelectedCallback(mxUtils.bind(this, function() { return this.tagsWindow != null && this.tagsWindow.window.isVisible(); }));
		
		if (Editor.enableAi &&
			!editorUi.isOffline() &&
			!EditorUi.isElectronApp && 
			Editor.aiActions.length > 0 &&
			editorUi.isExternalDataComms() &&
			editorUi.getServiceName() == 'draw.io' &&
			typeof mxMermaidToDrawio !== 'undefined' &&
			window.isMermaidEnabled)
		{
			var generateAction = editorUi.actions.put('generate', new Action('generate', function()
			{
				if (editorUi.chatWindow != null)
				{
					editorUi.chatWindow.window.setVisible(!editorUi.chatWindow.window.isVisible());
				}
				else
				{
					editorUi.openGenerateDialog('');
				}
			}));

			generateAction.isEnabled = function()
			{
				return isGraphEnabled();
			};

			generateAction.setToggleAction(true);

			generateAction.setSelectedCallback(function()
			{
				return editorUi.chatWindow != null && editorUi.chatWindow.window.isVisible();
			});
		}

		action = editorUi.actions.addAction('findReplace', mxUtils.bind(this, function(arg1, evt)
		{
			editorUi.showSearchWindow(graph.isEnabled() && (evt == null || !mxEvent.isShiftDown(evt)));
		}), null, null, Editor.ctrlKey + '+F');
		
		var exportVsdxAction = new Action('exportVsdx', function()
		{
			var noPages = editorUi.pages == null || editorUi.pages.length <= 1;
			
			if (noPages)
			{
				editorUi.exportVisio();
			}
			else
			{
				var div = document.createElement('div');
				div.style.whiteSpace = 'nowrap';

				var hd = document.createElement('h3');
				mxUtils.write(hd, mxResources.get('formatVsdx'));
				hd.style.cssText = 'width:100%;text-align:center;margin-top:0px;margin-bottom:4px';
				div.appendChild(hd);
				
				var pages = editorUi.addCheckbox(div, mxResources.get('allPages'), !noPages, noPages);
				pages.style.marginBottom = '16px';
				
				var dlg = new CustomDialog(editorUi, div, mxUtils.bind(this, function()
				{
					editorUi.exportVisio(!pages.checked);
				}), null, mxResources.get('export'));
				
				editorUi.showDialog(dlg.container, 300, 130, true, true);
			}
		});

		exportVsdxAction.getTitle = function()
		{
			return mxResources.get('formatVsdx') + ' (beta)...';
		};

		editorUi.actions.put('exportVsdx', exportVsdxAction);

		if (isLocalStorage && localStorage != null && urlParams['embed'] != '1')
		{
			editorUi.actions.addAction('configuration...', function()
			{
				// Moves show start screen option to configuration dialog in sketch
				var splashCb = document.createElement('input');
				splashCb.setAttribute('type', 'checkbox');
				splashCb.style.marginRight = '8px';
				splashCb.checked = mxSettings.getShowStartScreen();
				splashCb.defaultChecked = splashCb.checked;

				if (Editor.isSettingsEnabled() && (Editor.currentTheme == 'sketch' ||
					Editor.currentTheme == 'simple' || Editor.currentTheme == 'min'))
				{
					var showSplash = document.createElement('span');
					showSplash.style.display = 'flex';
					showSplash.style.alignItems = 'center';
					showSplash.style.cssFloat = 'right';
					showSplash.style.cursor = 'pointer';
					showSplash.style.userSelect = 'none';
					showSplash.style.marginTop = '-3px';
					showSplash.appendChild(splashCb);
					mxUtils.write(showSplash, mxResources.get('showStartScreen'));

					mxEvent.addListener(showSplash, 'click', function(evt)
					{
						if (mxEvent.getSource(evt) != splashCb)
						{	
							splashCb.checked = !splashCb.checked;
						}
					});

					header = showSplash;
				}
				
				var buttons = [[mxResources.get('reset'), function()
				{
					editorUi.confirm(mxResources.get('areYouSure'), function()
					{
						try
						{
							localStorage.removeItem(Editor.configurationKey);
							editorUi.hideDialog();
							editorUi.alert(mxResources.get('restartForChangeRequired'));
						}
						catch (e)
						{
							editorUi.handleError(e);
						}
					});
				}]];
				
				if (!editorUi.isOfflineApp() && isLocalStorage && editorUi.mode != App.MODE_ATLAS)
				{
					var pluginsAction = editorUi.actions.get('plugins');

					if (pluginsAction != null && (Editor.currentTheme == 'sketch' ||
						Editor.currentTheme == 'simple' || Editor.currentTheme == 'min'))
					{
						// TODO: Show change message only when plugins have changed
						buttons.push([mxResources.get('plugins'), pluginsAction.funct]);
					}
				}
				
				if (!EditorUi.isElectronApp)
				{
					buttons.push([mxResources.get('link'), function(evt, input)
					{
						if (input.value.length > 0)
						{
							try
							{
								var obj = JSON.parse(input.value);
								var url = window.location.protocol + '//' + window.location.host +
									'/' + editorUi.getSearch() + '#_CONFIG_' +
									Graph.compress(JSON.stringify(obj));
								var dlg = new EmbedDialog(editorUi, url);
								editorUi.showDialog(dlg.container, 450, 240, true);
								dlg.init();
							}
							catch (e)
							{
								editorUi.handleError(e);	
							}
						}
						else
						{
							editorUi.handleError({message: mxResources.get('invalidInput')});
						}
					}])
				}

				if (editorUi.getServiceName() != 'atlassian' && urlParams['embed'] != '1')
				{
					buttons.push([mxResources.get('preferences'), function()
					{
						editorUi.showLocalStorageDialog(mxResources.get('preferences') + ':', Editor.settingsKey,
							[[mxResources.get('reset'), function()
							{
								editorUi.confirm(mxResources.get('areYouSure'), function()
								{
									try
									{
										localStorage.removeItem(Editor.settingsKey);
										localStorage.removeItem('.drawio-config');
										editorUi.hideDialog();
										editorUi.alert(mxResources.get('restartForChangeRequired'));
									}
									catch (e)
									{
										editorUi.handleError(e);
									}
								});
							}]]);
					}]);
				}
				
				editorUi.showLocalStorageDialog(mxResources.get('configuration') + ':', Editor.configurationKey,
					buttons, splashCb.parentNode, 'https://www.drawio.com/doc/faq/configure-diagram-editor',
					function()
					{
						if (splashCb.parentNode != null)
						{
							mxSettings.setShowStartScreen(splashCb.checked);
							mxSettings.save();
						}
					});
			});
		}
		
		// Adds language menu to options only if localStorage is available for
		// storing the choice. We do not want to use cookies for older browsers.
		// Note that the URL param lang=XX is available for setting the language
		// in older browsers. URL param has precedence over the saved setting.
		if (mxClient.IS_CHROMEAPP || isLocalStorage)
		{
			this.put('language', new Menu(mxUtils.bind(this, function(menu, parent)
			{
				var currentLanguage = mxLanguage;

				if (urlParams['lang'] == null && isLocalStorage)
				{
					currentLanguage = mxSettings.settings.language;
				}
				
				var addLangItem = mxUtils.bind(this, function (id)
				{
					var lang = (id == '') ? mxResources.get('automatic') : mxLanguageMap[id];
					var item = null;
					
					if (lang != '')
					{
						item = menu.addItem(lang, null, mxUtils.bind(this, function()
						{
							editorUi.setAndPersistLanguage(id);
						}), parent);
						
						if (id == currentLanguage || (id == '' && currentLanguage == null))
						{
							menu.addCheckmark(item, Editor.checkmarkImage);
						}
					}
					
					return item;
				});
				
				addLangItem('');
				menu.addSeparator(parent);

				// LATER: Sort menu by language name
				for(var langId in mxLanguageMap) 
				{
					addLangItem(langId);
				}
			})));
		}
		
		editorUi.customLayoutConfig = [{'layout': 'mxHierarchicalLayout',
			'config':
			{'orientation': 'west',
			'intraCellSpacing': 30,
			'interRankCellSpacing': 100,
			'interHierarchySpacing': 60,
			'parallelEdgeSpacing': 10}}];
		
		// Adds action for running layouts
		editorUi.actions.addAction('runLayout', function()
		{
	    	editorUi.showCustomLayoutDialog(JSON.stringify(
				editorUi.customLayoutConfig, null, 2));
		});

		// Adds action for removing user-defined colors
		editorUi.actions.put('adaptiveColors', new Action('adaptiveColors', function(evt)
		{
			if (editorUi.adaptiveColorsWindow == null)
			{
				editorUi.adaptiveColorsWindow = new AdaptiveColorsWindow(
					editorUi, document.body.offsetWidth - 520, 80, 200, 160);
			}

			editorUi.adaptiveColorsWindow.window.setVisible(true);
		}));

		// Adds fullscreen toggle to zoom menu in sketch and min
        var viewZoomMenu = this.get('viewZoom');
		var viewZoomMenuFunct = viewZoomMenu.funct;
		
		viewZoomMenu.funct = mxUtils.bind(this, function(menu, parent)
		{
			viewZoomMenuFunct.apply(this, arguments);
			
			if (Editor.currentTheme == 'sketch' || Editor.currentTheme == 'min')
			{
				this.addMenuItems(menu, ['-', 'outline', 'fullscreen'], parent);
			}
		});
		
		var layoutMenu = this.get('layout');
		var layoutMenuFunct = layoutMenu.funct;
		
		layoutMenu.funct = function(menu, parent)
		{
			layoutMenuFunct.apply(this, arguments);

			menu.addItem(mxResources.get('orgChart'), null, function()
			{
				var branchOptimizer = null, parentChildSpacingVal = 20, siblingSpacingVal = 20;
				
				// Invoked when orgchart code was loaded
				var delayed = function()
				{
					if (typeof mxOrgChartLayout !== 'undefined' && branchOptimizer != null)
					{
						editorUi.tryAndHandle(mxUtils.bind(this, function()
						{
							var graph = editorUi.editor.graph;
							var orgChartLayout = new mxOrgChartLayout(graph,
								branchOptimizer, parentChildSpacingVal, siblingSpacingVal);
							var cell = graph.getDefaultParent();
							
							if (graph.model.getChildCount(graph.getSelectionCell()) > 1)
							{
								cell = graph.getSelectionCell();
							}
							
							orgChartLayout.execute(cell);
						}));
					}
				};

				var div = document.createElement('div');
				
				var title = document.createElement('div');
				title.style.marginTop = '6px';
				title.style.display = 'inline-block';
				title.style.width = '180px';
				mxUtils.write(title, mxResources.get('orgChartType') + ': ');
				
				div.appendChild(title);
				
				var typeSelect = document.createElement('select');
				typeSelect.style.width = '160px';
				typeSelect.style.boxSizing = 'border-box';
				
				//Types are hardcoded here since the code is not loaded yet
				var typesArr = [mxResources.get('linear'),
					mxResources.get('hanger2'),
					mxResources.get('hanger4'),
					mxResources.get('fishbone1'),
					mxResources.get('fishbone2'),
					mxResources.get('1ColumnLeft'),
					mxResources.get('1ColumnRight'),
					mxResources.get('smart')
				];
				
				for (var i = 0; i < typesArr.length; i++)
				{
					var option = document.createElement('option');
					mxUtils.write(option, typesArr[i]);
					option.value = i;
					
					if (i == 2)
					{
						option.setAttribute('selected', 'selected');
					}
					
					typeSelect.appendChild(option);
				}
					
				mxEvent.addListener(typeSelect, 'change', function()
				{
					branchOptimizer = typeSelect.value;
				});
				
				div.appendChild(typeSelect);
				
				title = document.createElement('div');
				title.style.marginTop = '6px';
				title.style.display = 'inline-block';
				title.style.width = '180px';
				mxUtils.write(title, mxResources.get('parentChildSpacing') + ': ');
				div.appendChild(title);
				
				var parentChildSpacing = document.createElement('input');
				parentChildSpacing.type = 'number';
				parentChildSpacing.value = parentChildSpacingVal;
				parentChildSpacing.style.width = '160px';
				parentChildSpacing.style.boxSizing = 'border-box';
				div.appendChild(parentChildSpacing);
				
				mxEvent.addListener(parentChildSpacing, 'change', function()
				{
					parentChildSpacingVal = parentChildSpacing.value;
				});
				
				title = document.createElement('div');
				title.style.marginTop = '6px';
				title.style.display = 'inline-block';
				title.style.width = '180px';
				mxUtils.write(title, mxResources.get('siblingSpacing') + ': ');
				div.appendChild(title);
				
				var siblingSpacing = document.createElement('input');
				siblingSpacing.type = 'number';
				siblingSpacing.value = siblingSpacingVal;
				siblingSpacing.style.width = '160px';
				siblingSpacing.style.boxSizing = 'border-box';
				div.appendChild(siblingSpacing);
				
				mxEvent.addListener(siblingSpacing, 'change', function()
				{
					siblingSpacingVal = siblingSpacing.value;
				});

				var customBtn = mxUtils.button(mxResources.get('custom') + '...', function()
				{
					var value = [{layout: 'mxOrgChartLayout',
						config: {
							branchOptimizer: parseInt(typeSelect.value),
							parentChildSpacing: parseInt(parentChildSpacing.value),
							siblingSpacing: parseInt(siblingSpacing.value)
						}
					}];

					editorUi.hideDialog();
					editorUi.showCustomLayoutDialog(
						JSON.stringify(value, null, 2));
				});
				
				customBtn.className = 'geBtn';

				var dlg = new CustomDialog(editorUi, div, function()
				{
					if (branchOptimizer == null)
					{
						branchOptimizer = 2;
					}
					
					editorUi.loadOrgChartLayouts(delayed);
				}, null, null, null, customBtn);

				editorUi.showDialog(dlg.container, 355, 140, true, true);
			}, parent, null, isGraphEnabled());
			
			menu.addSeparator(parent);
			
			menu.addItem(mxResources.get('parallels'), null, mxUtils.bind(this, function()
			{
				editorUi.tryAndHandle(mxUtils.bind(this, function()
				{
					var layout = new mxParallelEdgeLayout(graph);
					layout.checkOverlap = true;

					editorUi.prompt(mxResources.get('spacing'), layout.spacing, mxUtils.bind(this, function(newValue)
					{
						editorUi.tryAndHandle(mxUtils.bind(this, function()
						{
							layout.spacing = newValue;

							editorUi.executeLayout(function()
							{
								layout.execute(graph.getDefaultParent(), (!graph.isSelectionEmpty()) ?
									graph.getSelectionCells() : null);
							}, false);
						}));
					}));
				}));
			}), parent);
			
			menu.addSeparator(parent);
			editorUi.menus.addMenuItem(menu, 'runLayout', parent, null, null, mxResources.get('custom') + '...');
		};
		
		this.put('help', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			if (!mxClient.IS_CHROMEAPP && (editorUi.isOffline() || navigator.standalone))
			{
				this.addMenuItems(menu, ['keyboardShortcuts', '-', 'about'], parent);
			}
			else
			{
				// No translation for menu item since help is english only
				var item = menu.addItem(mxResources.get('search') + ':',
					null, null, parent, null, null, false);
				item.style.cursor = 'default';
				
				var input = document.createElement('input');
				input.setAttribute('type', 'text');
				input.setAttribute('size', '25');
				input.style.borderWidth = '1px';
				input.style.marginLeft = '8px';

				mxEvent.addListener(input, 'keydown', mxUtils.bind(this, function(e)
				{
					var term = mxUtils.trim(input.value);
					
					if (e.keyCode == 13 && term.length > 0)
					{
						this.editorUi.searchHelp(term);
						input.value = '';
						
						window.setTimeout(mxUtils.bind(this, function()
						{
							this.editorUi.hideCurrentMenu();
						}), 0);
					}
	                else if (e.keyCode == 27)
	                {
	                    input.value = '';
	                }
				}));
				
				item.firstChild.nextSibling.appendChild(input);
				
				mxEvent.addGestureListeners(input, function(evt)
				{
					if (document.activeElement != input)
					{
						input.focus();
					}
					
					mxEvent.consume(evt);
				}, function(evt)
				{
					mxEvent.consume(evt);
				}, function(evt)
				{
					mxEvent.consume(evt);
				});
				
				window.setTimeout(function()
				{
					input.focus();
				}, 0);

				if (EditorUi.isElectronApp)
				{
					editorUi.actions.addAction('website...', function()
					{
						editorUi.openLink('https://www.drawio.com');
					});
					
					editorUi.actions.addAction('check4Updates', function()
					{
						editorUi.checkForUpdates();
					});

					editorUi.actions.put('desktopZoomIn', new Action('zoomIn', function()
					{
						editorUi.desktopZoomIn();
					}));

					editorUi.actions.put('desktopZoomOut', new Action('zoomOut', function()
					{
						editorUi.desktopZoomOut();
					}));

					editorUi.actions.put('desktopResetZoom', new Action('actualSize', function()
					{
						editorUi.desktopResetZoom();
					}));

					this.addMenuItems(menu, ['-', 'keyboardShortcuts', 'quickStart',
						'website', 'support', '-'], parent);

					if (urlParams['disableUpdate'] != '1')
					{
						this.addMenuItems(menu, ['check4Updates', '-'], parent);
					}

					this.addMenuItems(menu, ['desktopResetZoom', 'desktopZoomIn',
						'desktopZoomOut', '-', 'openDevTools', '-', 'about'], parent);
				}
				else
				{
					this.addMenuItems(menu, ['-', 'keyboardShortcuts',
						'quickStart', 'downloadDesktop', 'support', '-',
						'about'], parent);
				}
			}
			
			if (urlParams['test'] == '1')
			{
				menu.addSeparator(parent);
				this.addSubmenu('testDevelop', menu, parent);
			}
		})));
		
		editorUi.actions.addAction('languageCode...', function()
		{
			var lang = Graph.diagramLanguage || '';
					
			var dlg = new FilenameDialog(editorUi, lang, mxResources.get('ok'),
				mxUtils.bind(this, function(newLang)
			{
				if (newLang != null)
				{
					Graph.diagramLanguage = (newLang.length > 0) ? newLang : null;
					Graph.translateDiagram = true;
					graph.refresh();
				}
			}), mxResources.get('languageCode'), null, null,
				'https://www.drawio.com/blog/translate-diagrams');
			editorUi.showDialog(dlg.container, 340, 80, true, true);
			dlg.init();
		});
		
		this.put('diagramLanguage', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			this.addMenuItems(menu, ['languageCode', '-'], parent);

			var item = menu.addItem(mxResources.get('disabled'), null, function()
			{
				Graph.translateDiagram = false;
				graph.refresh();
			}, parent);

			if (!Graph.translateDiagram)
			{
				menu.addCheckmark(item, Editor.checkmarkImage);
			}
		})));

		// Only visible in test mode
		if (urlParams['test'] == '1')
		{
			mxResources.parse('testDevelop=Develop');
			mxResources.parse('showBoundingBox=Show bounding box');
			mxResources.parse('createSidebarEntry=Create Sidebar Entry');
			mxResources.parse('testCheckFile=Check File');
			mxResources.parse('testDiff=Diff/Sync');
			mxResources.parse('testChecksum=Checksum');
			mxResources.parse('testCheckPages=Check Pages');
			mxResources.parse('testFixPages=Fix Pages');
			mxResources.parse('testInspect=Inspect');
			mxResources.parse('testShowConsole=Show Console');
			mxResources.parse('testXmlImageExport=XML Image Export');
			mxResources.parse('testOptimize=Remove Inline Images');
			mxResources.parse('testPerformance=Performance');

			editorUi.actions.addAction('createSidebarEntry', mxUtils.bind(this, function()
			{
				if (!graph.isSelectionEmpty())
				{
					var cells = graph.cloneCells(graph.getSelectionCells());
					var bbox = graph.getBoundingBoxFromGeometry(cells, true);
					cells = graph.moveCells(cells, -bbox.x, -bbox.y);
					
					editorUi.showTextDialog('Create Sidebar Entry', 'this.addDataEntry(\'tag1 tag2\', ' +
						bbox.width + ', ' + bbox.height + ', \'The Title\', \'' +
						Graph.compress(mxUtils.getXml(graph.encodeCells(cells))) + '\'),');
				}
			}));
	
			editorUi.actions.addAction('showBoundingBox', mxUtils.bind(this, function()
			{
				var b = (graph.isSelectionEmpty()) ? graph.getGraphBounds() :
					graph.getBoundingBox(graph.getSelectionCells());
				var tr = graph.view.translate;
				var s = graph.view.scale;
				graph.insertVertex(graph.getDefaultParent(), null, '',
					b.x / s - tr.x, b.y / s - tr.y, b.width / s, b.height / s,
					'fillColor=none;strokeColor=red;');

				// Checking bounding boxes
				function checkBounds(shape)
				{
					return shape == null || shape.boundingBox == null || (!isNaN(shape.boundingBox.x) &&
						!isNaN(shape.boundingBox.y) && !isNaN(shape.boundingBox.width) &&
						!isNaN(shape.boundingBox.height));
				};

				var invalid = 0;
				var count = 0;

				graph.view.states.visit(function(id, state)
				{
					var valid = true;

					if (!checkBounds(state.shape))
					{
						console.log('invalid shape', state.cell.id, state.shape);
						valid = false;
					}

					if (!checkBounds(state.text))
					{
						console.log('invalid text', state.cell.id, state.text);
						valid = false;
					}

					if (!valid)
					{
						invalid++;
					}

					count++;
				});

				console.log('states checked', count, 'invalid', invalid);
			}));
	
			editorUi.actions.addAction('testCheckFile', mxUtils.bind(this, function()
			{
				var xml = (editorUi.pages != null && editorUi.getCurrentFile() != null) ?
					editorUi.getCurrentFile().getAnonymizedXmlForPages(editorUi.pages) : '';

		    	var dlg = new TextareaDialog(editorUi, 'Paste Data:', xml,
		    		function(newValue)
				{
					if (newValue.length > 0)
					{
						try
						{
							if (newValue.charAt(0) != '<')
							{
								newValue = Graph.decompress(newValue);
								mxLog.debug('See console for uncompressed XML');
								console.log('xml', newValue);
							}
							
							var doc = mxUtils.parseXml(newValue);
							var pages = editorUi.getPagesForNode(doc.documentElement, 'mxGraphModel');
							
							if (pages != null && pages.length > 0)
							{
								try
								{
									var checksum = editorUi.getHashValueForPages(pages);
									mxLog.debug('Checksum: ', checksum);
								}
								catch (e)
								{
									mxLog.debug('Error: ', e.message);
								}
							}
							else
							{
								mxLog.debug('No pages found for checksum');
							}

							// Checks for duplicates
							function checkModel(node)
							{
								var pageId = node.parentNode.id;
								var all = node.childNodes;
								var allIds = {};
								var childs = {};
								var root = null;
								var dups = {};
								
								for (var i = 0; i < all.length; i++)
								{
									var el = all[i];
									
									if (el.id != null && el.id.length > 0)
									{
										if (allIds[el.id] == null)
										{
											allIds[el.id] = el.id;
											var pid = el.getAttribute('parent');
											
											if (pid == null)
											{
												if (root != null)
												{
													mxLog.debug(pageId + ': Multiple roots: ' + el.id);
												}
												else
												{
													root = el.id;
												}
											}
											else
											{
												if (childs[pid] == null)
												{
													childs[pid] = [];
												}
												
												childs[pid].push(el.id);
											}
										}
										else
										{
											dups[el.id] = el.id;
										}
									}
								}

								var keys = Object.keys(dups);
								
								if (keys.length > 0)
								{
									var log = pageId + ': ' + keys.length +
										' Duplicates: ' + keys.join(', ');
									mxLog.debug(log + ' (see console)');
								}
								else
								{
									mxLog.debug(pageId + ': Checked');
								}
								
								// Checks tree for cycles
								var visited = {};
								
								function visit(id)
								{
									if (visited[id] == null)
									{
										visited[id] = true;
										
										if (childs[id] != null)
										{
											while (childs[id].length > 0)
											{
												var temp = childs[id].pop();
												visit(temp);
											}
											
											delete childs[id];
										}
									}
									else
									{
										mxLog.debug(pageId + ': Visited: ' + id);
									}
								};
								
								if (root == null)
								{
									mxLog.debug(pageId + ': No root');
								}
								else
								{
									visit(root);
									
									if (Object.keys(visited).length != Object.keys(allIds).length)
									{
										mxLog.debug(pageId + ': Invalid tree: (see console)');
										console.log(pageId + ': Invalid tree', childs);
									}
								}
							};
							
							var roots = doc.getElementsByTagName('root');
							
							for (var i = 0; i < roots.length; i++)
							{
								checkModel(roots[i]);
							}
							
							mxLog.show();
						}
						catch (e)
						{
							editorUi.handleError(e);
							
							if (window.console != null)
							{
								console.error(e);
							}
						}
					}
				});
		    	
				editorUi.showDialog(dlg.container, 620, 460, true, true);
				dlg.init();
			}));
	
			var snapshot = null;
			
			editorUi.actions.addAction('testDiff', mxUtils.bind(this, function()
			{
				if (editorUi.pages != null)
				{
					var buttons = [['Snapshot', function(evt, input)
					{
						snapshot = editorUi.getPagesForXml(editorUi.getFileData(true));
						dlg.textarea.value = 'Snapshot updated ' + new Date().toLocaleString() +
							' Checksum ' + editorUi.getHashValueForPages(snapshot);
					}], ['Diff', function(evt, input)
					{
						try
						{
							dlg.textarea.value = JSON.stringify(editorUi.diffPages(
								snapshot, editorUi.pages), null, 2);
						}
						catch (e)
						{
							editorUi.handleError(e);
						}
					}]];
					
			    	var dlg = new TextareaDialog(editorUi, 'Diff/Sync:', '',
			    		function(newValue)
					{
						var file = editorUi.getCurrentFile();
						
						if (newValue.length > 0 && file != null)
						{
							try
							{
								var patch = JSON.parse(newValue);
								file.patch([patch], null, true, true);
								editorUi.hideDialog();
							}
							catch (e)
							{
								editorUi.handleError(e);
							}
						}
					}, null, 'Close', null, null, null, true, null, 'Patch', null, buttons);
			    	
					if (snapshot == null)
					{
						snapshot = editorUi.getPagesForXml(editorUi.getFileData(true));
						dlg.textarea.value = 'Snapshot created ' + new Date().toLocaleString() +
							' Checksum ' + editorUi.getHashValueForPages(snapshot);
					}
					else
					{
						dlg.textarea.value = JSON.stringify(editorUi.diffPages(
							snapshot, editorUi.pages), null, 2);
					}
					
					editorUi.showDialog(dlg.container, 620, 460, true, true);
					dlg.init();
				}
				else
				{
					editorUi.alert('No pages');
				}
			}));

			editorUi.actions.addAction('testChecksum', mxUtils.bind(this, function()
			{
				var file = editorUi.getCurrentFile();

				if (editorUi.pages != null && file != null)
				{
					if (editorUi.spinner.spin(document.body, mxResources.get('loading')))
					{
						file.getLatestVersion(function(latestFile)
						{
							editorUi.spinner.stop();

							var localChecksum = editorUi.getHashValueForPages(editorUi.pages);
							var localRev = file.getCurrentRevisionId();
							var remoteChecksum = editorUi.getHashValueForPages(
								latestFile.getShadowPages());
							var descChecksum = latestFile.getDescriptorChecksum(
								latestFile.getDescriptor());
							var remoteRev = latestFile.getCurrentRevisionId();
							
							console.log('Local File', [file],
								'modified', file.isModified(),
								'checksum', localChecksum);
							
							console.log('Remote File', [latestFile],
								'rev', remoteRev == localRev,
								'desc', descChecksum == remoteChecksum,
								'checksum', remoteChecksum);
							
							editorUi.alert('Checksums ' +
								(remoteChecksum == localChecksum ?
								'match' : 'no not match'));
						}, function(err)
						{
							console.log('Error getLatestVersion', err);
							editorUi.handleError(err);
						});
					}
				}
				else
				{
					console.log('Checksum: no file or pages');
				}
			}));

			editorUi.actions.addAction('testCheckPages', mxUtils.bind(this, function()
			{
				var file = editorUi.getCurrentFile();
				console.log('editorUi', editorUi, 'file', file);

				if (file != null && file.isRealtime())
				{
					console.log('Checksum ownPages',
						editorUi.getHashValueForPages(
							file.ownPages));
					console.log('Checksum theirPages',
						editorUi.getHashValueForPages(
							file.theirPages));
					console.log('diff ownPages/theirPages',
						editorUi.diffPages(file.ownPages,
							file.theirPages));

					var shadow = file.getShadowPages();
					
					if (shadow != null)
					{
						console.log('Checksum shadowPages',
							editorUi.getHashValueForPages(shadow));
						console.log('diff shadowPages/ownPages',
							editorUi.diffPages(shadow, file.ownPages));
						console.log('diff ownPages/shadowPages',
							editorUi.diffPages(file.ownPages, shadow));
						console.log('diff theirPages/shadowPages',
							editorUi.diffPages(file.theirPages, shadow));
					}

					if (file.sync != null && file.sync.snapshot != null)
					{
						console.log('Checksum snapshot',
							editorUi.getHashValueForPages(
								file.sync.snapshot));
						console.log('diff ownPages/snapshot',
							editorUi.diffPages(file.ownPages,
								file.sync.snapshot));
						console.log('diff theirPages/snapshot',
							editorUi.diffPages(file.theirPages,
								file.sync.snapshot));

						if (editorUi.pages != null)
						{
							console.log('diff snapshot/actualPages',
								editorUi.diffPages(file.sync.snapshot,
									editorUi.pages));
						}
					}

					if (editorUi.pages != null)
					{
						console.log('diff ownPages/actualPages',
							editorUi.diffPages(file.ownPages,
								editorUi.pages));
						console.log('diff theirPages/actualPages',
							editorUi.diffPages(file.theirPages,
								editorUi.pages));
					}
				}

				if (file != null)
				{
					console.log('Shadow pages',
						[editorUi.getXmlForPages(
							file.getShadowPages())]);
				}

				if (editorUi.pages != null)
				{
					console.log('Checksum actualPages',
						editorUi.getHashValueForPages(
							editorUi.pages));
				}
			}));
			
			editorUi.actions.addAction('testFixPages', mxUtils.bind(this, function()
			{
				console.log('editorUi', editorUi);
				var file = editorUi.getCurrentFile();

				if (file != null && file.isRealtime() &&
					file.shadowPages != null)
				{
					console.log('patching actualPages to shadowPages',
						file.patch([editorUi.diffPages(
							file.shadowPages, editorUi.pages)]));
					file.ownPages = editorUi.clonePages(editorUi.pages);
					file.theirPages = editorUi.clonePages(editorUi.pages);
					file.shadowPages = editorUi.clonePages(editorUi.pages);

					if (file.sync != null)
					{
						file.sync.snapshot = editorUi.clonePages(editorUi.pages);
					}
				}
			}));

			editorUi.actions.addAction('testOptimize', mxUtils.bind(this, function()
			{
				graph.model.beginUpdate();
				try
				{
					var all = graph.model.cells;
					var imageCount = 0;
					var images = [];
					var cells = [];

					for (var id in all)
					{
						var cell = all[id];
						var style = graph.getCurrentCellStyle(cell);
						var image = style[mxConstants.STYLE_IMAGE];

						if (image != null && image.substring(0, 5) == 'data:')
						{
							if (images[image] == null)
							{
								images[image] = (images[image] || 0) + 1;
								imageCount++;
							}

							cells.push(cell);
						}
					}

					graph.setCellStyles(mxConstants.STYLE_IMAGE, null, cells);
					console.log('Removed', imageCount, 'image(s) from', cells.length, 'cell(s): ', [cells, images]);
				}
				finally
				{
					graph.model.endUpdate();
				}
			}));
	
			editorUi.actions.addAction('testInspect', mxUtils.bind(this, function()
			{
				console.log(editorUi, graph.getModel());
			}));
			
			editorUi.actions.addAction('testXmlImageExport', mxUtils.bind(this, function()
			{
				var scale = 1;
				var b = 1;
				
				var imgExport = new mxImageExport();
				var bounds = graph.getGraphBounds();
				var vs = graph.view.scale;
				
	        	// New image export
				var xmlDoc = mxUtils.createXmlDocument();
				var root = xmlDoc.createElement('output');
				xmlDoc.appendChild(root);
				
			    // Renders graph. Offset will be multiplied with state's scale when painting state.
				var xmlCanvas = new mxXmlCanvas2D(root);
				xmlCanvas.translate(Math.floor((b / scale - bounds.x) / vs),
					Math.floor((b / scale - bounds.y) / vs));
				xmlCanvas.scale(scale / vs);
				
				var stateCounter = 0;
				
				var canvasSave = xmlCanvas.save;
				xmlCanvas.save = function()
				{
					stateCounter++;
					canvasSave.apply(this, arguments);
				};
				
				var canvasRestore = xmlCanvas.restore;
				xmlCanvas.restore = function()
				{
					stateCounter--;
					canvasRestore.apply(this, arguments);
				};
				
				var exportDrawShape = imgExport.drawShape;
				imgExport.drawShape = function(state)
				{
					mxLog.debug('entering shape', state, stateCounter);
					exportDrawShape.apply(this, arguments);
					mxLog.debug('leaving shape', state, stateCounter);
				};
				
			    imgExport.drawState(graph.getView().getState(graph.model.root), xmlCanvas);
			    
				// Puts request data together
				var w = Math.ceil(bounds.width * scale / vs + 2 * b);
				var h = Math.ceil(bounds.height * scale / vs + 2 * b);
				
				mxLog.show();
				mxLog.debug(mxUtils.getXml(root));
				mxLog.debug('stateCounter', stateCounter);
			}));

			editorUi.actions.addAction('testShowConsole', function()
			{
				if (!mxLog.isVisible())
				{
					mxLog.show();
				}
				else
				{
					mxLog.window.fit();
				}
				
				mxLog.window.div.style.zIndex = mxPopupMenu.prototype.zIndex - 2;
			});
			

			// Adds logging for performance
			var prevRevalidate = null;
			var prevSelectPage = null;
			var prevDiffPages = null;
			var prevPatchPages = null;
			var prevClonePages = null;
			var prevGetFileData = null;
			var prevGetHashValueForPages = null;
			var prevResolveCrossReferences = null;

			editorUi.actions.addAction('testPerformance', mxUtils.bind(this, function()
			{
				if (prevRevalidate != null)
				{
					graph.view.revalidate = prevRevalidate;
					prevRevalidate = null;
				}
				else
				{
					prevRevalidate = graph.view.revalidate;

					graph.view.revalidate = function()
					{
						var t0 = Date.now();
						var result = prevRevalidate.apply(this, arguments);
						EditorUi.debug('[Performance] mxGraphView.revalidate',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);
						
						return result;
					};
				}

				if (prevSelectPage != null)
				{
					editorUi.selectPage = prevSelectPage;
					prevSelectPage = null;
				}
				else
				{
					prevSelectPage = editorUi.selectPage;

					editorUi.selectPage = function()
					{
						var t0 = Date.now();
						var result = prevSelectPage.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.selectPage',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);
						
						return result;
					};
				}

				if (prevDiffPages != null)
				{
					editorUi.diffPages = prevDiffPages;
					prevDiffPages = null;
				}
				else
				{
					prevDiffPages = editorUi.diffPages;

					editorUi.diffPages = function()
					{
						var t0 = Date.now();
						var result = prevDiffPages.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.diffPages',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);
						
						return result;
					};
				}

				if (prevPatchPages != null)
				{
					editorUi.patchPages = prevPatchPages;
					prevPatchPages = null;
				}
				else
				{
					prevPatchPages = editorUi.patchPages;

					editorUi.patchPages = function()
					{
						var t0 = Date.now();
						var result = prevPatchPages.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.patchPages',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);
						
						return result;
					};
				};

				if (prevClonePages != null)
				{
					editorUi.clonePages = prevClonePages;
					prevClonePages = null;
				}
				else
				{
					prevClonePages = editorUi.clonePages;

					editorUi.clonePages = function()
					{
						var t0 = Date.now();
						var result = prevClonePages.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.clonePages',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);
						
						return result;
					};
				};

				if (prevGetHashValueForPages != null)
				{
					editorUi.getHashValueForPages = prevGetHashValueForPages;
					prevGetHashValueForPages = null;
				}
				else
				{
					prevGetHashValueForPages = editorUi.getHashValueForPages;

					editorUi.getHashValueForPages = function()
					{
						var t0 = Date.now();
						var result = prevGetHashValueForPages.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.getHashValueForPages',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);
						
						return result;
					};
				}

				if (prevResolveCrossReferences != null)
				{
					editorUi.resolveCrossReferences = prevResolveCrossReferences;
					prevResolveCrossReferences = null;
				}
				else
				{
					prevResolveCrossReferences = editorUi.resolveCrossReferences;

					editorUi.resolveCrossReferences = function()
					{
						var t0 = Date.now();
						var result = prevResolveCrossReferences.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.resolveCrossReferences',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);

						return result;
					};
				}

				if (prevGetFileData != null)
				{
					editorUi.getFileData = prevGetFileData;
					prevGetFileData = null;
				}
				else
				{
					prevGetFileData = editorUi.getFileData;

					editorUi.getFileData = function()
					{
						var t0 = Date.now();
						var result = prevGetFileData.apply(this, arguments);
						EditorUi.debug('[Performance] EditorUi.getFileData',
							[this], 'time', (Date.now() - t0) + ' ms',
							'args', arguments);

						return result;
					};
				}

				EditorUi.debug('[Performance]', (prevRevalidate != null) ? 'Enabled' : 'Disabled');
			}));

			this.put('testDevelop', new Menu(mxUtils.bind(this, function(menu, parent)
			{
				this.addMenuItems(menu, ['createSidebarEntry', 'showBoundingBox', '-',
					'testCheckPages', 'testChecksum', 'testFixPages', '-',
					'testCheckFile', 'testDiff', '-', 'testInspect', 'testOptimize', '-',
					'testXmlImageExport', '-'], parent);

				var item = menu.addItem(mxResources.get('testPerformance'), null, function()
				{
					editorUi.actions.get('testPerformance').funct();
				}, parent);
				
				if (prevRevalidate != null)
				{
					menu.addCheckmark(item, Editor.checkmarkImage);
				}

				this.addMenuItems(menu, ['-', 'testShowConsole'], parent);
			})));
		}
		
		editorUi.actions.put('shapes', new Action('moreShapes' + '...', function(evt)
		{
			if (mxClient.IS_CHROMEAPP || !editorUi.isOffline())
			{
				editorUi.showDialog(new MoreShapesDialog(editorUi, true).container, 640, (isLocalStorage) ?
						((mxClient.IS_IOS) ? 480 : 460) : 440, true, true);
			}
			else
			{
				editorUi.showDialog(new MoreShapesDialog(editorUi, false).container, 360, (isLocalStorage) ?
						((mxClient.IS_IOS) ? 300 : 280) : 260, true, true);
			}
		}));

		editorUi.actions.put('createShape', new Action('shape' + '...', function(evt)
		{
			if (graph.isEnabled())
			{
				var cell = new mxCell('', new mxGeometry(0, 0, 120, 120),
					editorUi.defaultCustomShapeStyle);
				cell.vertex = true;
				
				var dlg = new EditShapeDialog(editorUi, cell, mxResources.get('editShape'));
				editorUi.showDialog(dlg.container, 640, 480, true, false,
					null, null, null, new mxRectangle(0, 0, 300, 200));
				dlg.init();
			}
		})).isEnabled = isGraphEnabled;
		
		if (!editorUi.isOffline())
		{
			if (urlParams['embed'] != '1')
			{
				editorUi.actions.put('embedNotion', new Action('notion' + '...', function()
				{
					var footer = document.createElement('div');
					footer.style.position = 'absolute';
					footer.style.bottom = '30px';
					footer.style.textAlign = 'center';
					footer.style.width = '100%';
					footer.style.left = '0px';
					var link = document.createElement('a');
					link.setAttribute('href', 'javascript:void(0);');
					link.setAttribute('target', '_blank');
					link.style.cursor = 'pointer';
					mxUtils.write(link, mxResources.get('getNotionChromeExtension'));
					footer.appendChild(link);
					
					mxUtils.setPrefixedStyle(link.style, 'transition', 'all 1s ease');
					mxUtils.setOpacity(link, 0);

					window.setTimeout(function()
					{
						mxUtils.setOpacity(link, 100);
					}, 300);
					
					mxEvent.addListener(link, 'click', function(evt)
					{
						editorUi.openLink('https://chrome.google.com/webstore/detail/drawio-for-notion/plhaalebpkihaccllnkdaokdoeaokmle');
						mxEvent.consume(evt);
					});
					
					editorUi.getPublicUrl(editorUi.getCurrentFile(), function(publicUrl)
					{
						editorUi.showPublishLinkDialog(mxResources.get('notion'), null, null, true,
							'https://www.drawio.com/blog/drawio-notion', footer, publicUrl, editorUi.getCurrentFile(),
							function(linkTarget, linkColor, currentPage, lightbox, editLink, layers, width, height,
								tags, link, transparent, darkMode)
							{
								var params = ['border=0'];

								if (tags)
								{
									params.push('tags=%7B%7D');
								}

								var dlg = new EmbedDialog(editorUi, editorUi.createLink(linkTarget, linkColor,
									true, lightbox, editLink, layers, (link == 'public') ? publicUrl : null,
									null, params, null, currentPage, null, darkMode));
								editorUi.showDialog(dlg.container, 450, 240, true, true);
								dlg.init();
							}, null, true);
					});
				}));

				editorUi.actions.addAction('microsoftOffice...', function()
				{
					editorUi.openLink('https://office.draw.io');
				});
			}

			editorUi.actions.put('embedHtml', new Action('html' + '...', function()
			{
				editorUi.getPublicUrl(editorUi.getCurrentFile(), function(url)
				{
					editorUi.showHtmlDialog(mxResources.get('create'), 'https://www.drawio.com/doc/faq/embed-html-options',
						url, function(publicUrl, zoomEnabled, initialZoom, linkTarget, linkColor, fit, allPages, layers, tags,
							lightbox, editLink, theme)
					{
						editorUi.createHtml(publicUrl, zoomEnabled, initialZoom, linkTarget, linkColor, fit, allPages,
							layers, tags, lightbox, editLink, mxUtils.bind(this, function(html, scriptTag)
							{
								// Comment is workaround for file data check in checkFileContent for Electron
								var dlg = new EmbedDialog(editorUi, '<!-- ' + editorUi.editor.appName + ' diagram -->\n' +
									html + '\n' + scriptTag + '\n', null, null, function()
								{
									try
									{
										var wnd = window.open();
										
										if (wnd != null && wnd.document != null)
										{
											var doc = wnd.document;

											if (document.compatMode === 'CSS1Compat')
											{
												doc.writeln('<!DOCTYPE html>');
											}
											
											doc.writeln('<html>');
											doc.writeln('<head><title>' + encodeURIComponent(mxResources.get('preview')) +
												'</title><meta charset="utf-8"></head>');
											doc.writeln('<body>');
											doc.writeln(html);
											
											var direct = mxClient.IS_IE || mxClient.IS_EDGE || document.documentMode != null;
											
											if (direct)
											{
												doc.writeln(scriptTag);
											}
											
											doc.writeln('</body>');
											doc.writeln('</html>');
											doc.close();
											
											// Adds script tag after closing page and delay to fix timing issues
											if (!direct)
											{
												var info = wnd.document.createElement('div');
												info.marginLeft = '26px';
												info.marginTop = '26px';
												mxUtils.write(info, mxResources.get('updatingDocument'));

												var img = wnd.document.createElement('img');
												img.setAttribute('src', window.location.protocol + '//' + window.location.hostname +
													'/' + IMAGE_PATH + '/spin.gif');
												img.style.marginLeft = '6px';
												info.appendChild(img);
												
												wnd.document.body.insertBefore(info, wnd.document.body.firstChild);
												
												window.setTimeout(function()
												{
													var script = document.createElement('script');
													script.type = 'text/javascript';
													script.src = /<script.*?src="(.*?)"/.exec(scriptTag)[1];
													doc.body.appendChild(script);
													
													info.parentNode.removeChild(info);
												}, 20);
											}
										}
										else
										{
											editorUi.handleError({message: mxResources.get('errorUpdatingPreview')});
										}
									}
									catch (e)
									{
										editorUi.handleError(e);
									}
								});
								editorUi.showDialog(dlg.container, 450, 240, true, true);
								dlg.init();
							}), theme);
					});
				});
			}));
			
			editorUi.actions.put('liveImage', new Action('Live image...', function()
			{
				var current = editorUi.getCurrentFile();
				
				if (current != null)
				{
					editorUi.getPublicUrl(current, function(url)
					{
						if (url != null)
						{
							var dlg = new EmbedDialog(editorUi, '<img src="' + ((current.constructor != DriveFile) ?
								url : 'https://drive.google.com/uc?id=' + current.getId()) + '"/>');
							editorUi.showDialog(dlg.container, 450, 240, true, true);
							dlg.init();
						}
						else
						{
							editorUi.handleError({message: mxResources.get('invalidPublicUrl')});
						}
					});
				}
			}));
			
			editorUi.actions.put('embedImage', new Action('image' + '...', function()
			{
				editorUi.showEmbedImageDialog(function(fit, shadow, retina, lightbox, editLink, layers)
				{
					if (editorUi.spinner.spin(document.body, mxResources.get('loading')))
					{
						editorUi.createEmbedImage(fit, shadow, retina, lightbox, editLink, layers, function(result)
						{
							editorUi.spinner.stop();
							var dlg = new EmbedDialog(editorUi, result);
							editorUi.showDialog(dlg.container, 450, 240, true, true);
							dlg.init();
						}, function(err)
						{
							editorUi.spinner.stop();
							editorUi.handleError(err);
						});
					}
				}, mxResources.get('image'), mxResources.get('retina'), editorUi.editor.isExportToCanvas());
			}));

			editorUi.actions.put('embedSvg', new Action('formatSvg' + '...', function()
			{
				editorUi.showEmbedImageDialog(function(fit, shadow, image, lightbox, editLink, layers)
				{
					if (editorUi.spinner.spin(document.body, mxResources.get('loading')))
					{
						editorUi.createEmbedSvg(fit, shadow, image, lightbox, editLink, layers, function(result)
						{
							editorUi.spinner.stop();
							
							var dlg = new EmbedDialog(editorUi, result);
							editorUi.showDialog(dlg.container, 450, 240, true, true);
							dlg.init();
						}, function(err)
						{
							editorUi.spinner.stop();
							editorUi.handleError(err);
						});
					}
				}, mxResources.get('formatSvg'), mxResources.get('image'),
					true, 'https://www.drawio.com/doc/faq/embed-svg.html');
			}));
			
			editorUi.actions.put('embedIframe', new Action('iframe' + '...', function()
			{
				editorUi.getPublicUrl(editorUi.getCurrentFile(), function(publicUrl)
				{
					var bounds = graph.getGraphBounds();
					
					editorUi.showPublishLinkDialog(mxResources.get('iframe'), '100%',
						Math.ceil(Math.max(100, bounds.height / graph.view.scale)) + 2, null, null, null,
						publicUrl, editorUi.getCurrentFile(), function(linkTarget, linkColor,
							currentPage, lightbox, editLink, layers, width, height, tags, link,
							transparent, darkMode)
						{
							var params = [];

							if (tags)
							{
								params.push('tags=%7B%7D');
							}
							
							var dlg = new EmbedDialog(editorUi, '<iframe frameborder="0" style="width:' + width +
								';height:' + height + ';" src="' + editorUi.createLink(linkTarget, linkColor,
								true, lightbox, editLink, layers, (link == 'public') ? publicUrl : null,
								null, params, null, currentPage, transparent, darkMode) + '"' + ((transparent) ?
								' allowtransparency="true"' : '') + '></iframe>');
							editorUi.showDialog(dlg.container, 450, 240, true, true);
							dlg.init();
						}, true, true);
				});
			}));
		}

		editorUi.actions.put('publishLink', new Action('link' + '...', function()
		{
			editorUi.getPublicUrl(editorUi.getCurrentFile(), function(publicUrl)
			{
				editorUi.showPublishLinkDialog(null, null, null, null, null, null, publicUrl, editorUi.getCurrentFile(),
					function(linkTarget, linkColor, currentPage, lightbox, editLink, layers, width, height,
						tags, link, transparent, darkMode)
					{
						var params = [];

						if (lightbox && tags)
						{
							params.push('tags=%7B%7D');
						}

						var dlg = new EmbedDialog(editorUi, editorUi.createLink(linkTarget, linkColor,
							true, lightbox, editLink, layers, (link == 'public') ? publicUrl : null,
							null, params, null, currentPage, null, darkMode));
						editorUi.showDialog(dlg.container, 450, 240, true, true);
						dlg.init();
					}, null, true);
			});
		}, null, null, null, !editorUi.isOffline()));

		// Adds plugins menu item only if localStorage is available for storing the plugins
		if (isLocalStorage || mxClient.IS_CHROMEAPP)
		{
			var action = editorUi.actions.addAction('scratchpad', function()
			{
				editorUi.toggleScratchpad();
			});
			
			action.setToggleAction(true);
			action.setSelectedCallback(function()
			{
				return editorUi.scratchpad != null;
			});
			
			if (urlParams['plugins'] != '0')
			{
				editorUi.actions.addAction('plugins...', function()
				{
					editorUi.showDialog(new PluginsDialog(editorUi).container, 380, 240, true, false);
				});
			}
		}

		if (window.matchMedia && document.getElementById('high-contrast-stylesheet') != null)
		{
			var action = editorUi.actions.addAction('highContrast', function()
			{
				editorUi.setAndPersistHighContrast(!editorUi.isHighContrast());
			});
			
			action.setToggleAction(true);
			action.setSelectedCallback(function()
			{
				return editorUi.isHighContrast();
			});
		}

		var action = editorUi.actions.addAction('search', function()
		{
			if (editorUi.sidebar != null)
			{
				var visible = editorUi.sidebar.isEntryVisible('search');
				editorUi.sidebar.showPalette('search', !visible);
				
				if (Editor.isSettingsEnabled())
				{
					mxSettings.settings.search = !visible;
					mxSettings.save();
				}
			}
		});
		
		action.label = mxResources.get('searchShapes');
		action.setToggleAction(true);
		action.setSelectedCallback(function() { return editorUi.sidebar != null &&
			editorUi.sidebar.isEntryVisible('search'); });

		editorUi.actions.get('clearDefaultStyle').funct = function(exit)
		{
			if (graph.isEnabled())
			{
				editorUi.clearDefaultStyle();

				if (Editor.sketchMode)
				{
					editorUi.setSketchMode(false);
				}
			}
		};
		
		if (urlParams['embed'] == '1')
		{
			editorUi.actions.get('saveAs').setEnabled(false);
			
			editorUi.actions.get('save').funct = function(exit)
			{
				if (graph.isEditing())
				{
					graph.stopEditing();
				}
				
				var data = (urlParams['pages'] != '0' || (editorUi.pages != null && editorUi.pages.length > 1)) ?
					editorUi.getFileData(true) : mxUtils.getXml(editorUi.editor.getGraphXml());
				
				if (urlParams['proto'] == 'json')
				{
					var msg = editorUi.createLoadMessage('save');
					msg.xml = data;
					
					if (exit === true && (urlParams['saveAndExit'] == '1' ||
						urlParams['publishClose'] == '1'))
					{
						msg.exit = true;
					}
					
					data = JSON.stringify(msg);
				}
				
				var parent = window.opener || window.parent;
				parent.postMessage(data, '*');
				
				if (urlParams['modified'] != '0' && urlParams['keepmodified'] != '1')
				{
					editorUi.editor.modified = false;
					editorUi.clearStatus();
				}
				
				//Add support to saving files if embedded mode is running with files
				var file = editorUi.getCurrentFile();
				
				if (file != null && file.constructor != EmbedFile &&
					(file.constructor != LocalFile || file.mode != null))
				{
					editorUi.saveFile();
				}
			};
	
			var saveAndExitAction = editorUi.actions.addAction('saveAndExit', function()
			{
				if (urlParams['toSvg'] == '1')
				{
					editorUi.sendEmbeddedSvgExport();
				}
				else
				{
					editorUi.actions.get('save').funct(true);
				}
			}, null, null, Editor.ctrlKey + '+S');
			
			saveAndExitAction.label = urlParams['publishClose'] == '1' ?
				mxResources.get('publish') : mxResources.get('saveAndExit');
			
			editorUi.actions.addAction('exit', function()
			{
				if (urlParams['embedInline'] == '1')
				{
					editorUi.sendEmbeddedSvgExport();
				}
				else
				{
					var fn = function()
					{
						editorUi.editor.modified = false;
						var msg = (urlParams['proto'] == 'json') ? JSON.stringify({event: 'exit',
							modified: editorUi.editor.modified}) : '';
						var parent = window.opener || window.parent;
						parent.postMessage(msg, '*');
					}
					
					if (!editorUi.editor.modified)
					{
						fn();
					}
					else
					{
						editorUi.confirm(mxResources.get('allChangesLost'), null, fn,
							mxResources.get('cancel'), mxResources.get('discardChanges'));
					}
				}
			}, null, null, (urlParams['embedInline'] == '1') ? 'Escape' : null);
		}
		
		this.put('exportAs', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			if (editorUi.editor.isExportToCanvas())
			{
				this.addMenuItems(menu, ['exportPng'], parent);
				
				if (Editor.jpgSupported)
				{
					this.addMenuItems(menu, ['exportJpg'], parent);
				}

				if (Editor.webpSupported)
				{
					this.addMenuItems(menu, ['exportWebp'], parent);
				}
			}
			
			// Disabled for standalone mode in iOS because new tab cannot be closed
			else if (!editorUi.isOffline() && (!mxClient.IS_IOS || !navigator.standalone))
			{
				this.addMenuItems(menu, ['exportPng', 'exportJpg'], parent);
			}
			
			this.addMenuItems(menu, ['exportSvg', '-'], parent);
			
			// Redirects export to PDF to print in Chrome App
			if (editorUi.isOffline() || editorUi.printPdfExport)
			{
				this.addMenuItems(menu, ['exportPdf'], parent);
			}
			// Disabled for standalone mode in iOS because new tab cannot be closed
			else if (!editorUi.isOffline() && (!mxClient.IS_IOS || !navigator.standalone))
			{
				this.addMenuItems(menu, ['exportPdf'], parent);
			}

			if (editorUi.vsdxExportEnabled() && !mxClient.IS_IE &&
				(typeof(VsdxExport) !== 'undefined' || !editorUi.isOffline()))
			{
				this.addMenuItems(menu, ['exportVsdx'], parent);
			}

			this.addMenuItems(menu, ['-', 'exportHtml', 'exportXml', 'exportUrl'], parent);

			if (!editorUi.isOffline())
			{
				menu.addSeparator(parent);
				this.addMenuItem(menu, 'export', parent).firstChild.nextSibling.innerHTML = mxResources.get('advanced') + '...';
			}

			if (!mxClient.IS_CHROMEAPP && !EditorUi.isElectronApp &&
				Editor.currentTheme == 'min' && !editorUi.isOffline())
			{
				this.addMenuItems(menu, ['publishLink'], parent);
			}

			if (editorUi.mode != App.MODE_ATLAS && urlParams['extAuth'] != '1' &&
				(Editor.currentTheme == 'simple' || Editor.currentTheme == 'sketch' ||
				Editor.currentTheme == 'min') && !editorUi.isOffline())
			{
				menu.addSeparator(parent);
				editorUi.menus.addSubmenu('embed', menu, parent);
			}
		})));

		this.put('importFrom', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var doImportFile = mxUtils.bind(this, function(data, mime, filename)
			{
				// Gets insert location
				var view = graph.view;
				var bds = graph.getGraphBounds();
				var x = graph.snap(Math.ceil(Math.max(0, bds.x / view.scale - view.translate.x) + 4 * graph.gridSize));
				var y = graph.snap(Math.ceil(Math.max(0, (bds.y + bds.height) / view.scale - view.translate.y) + 4 * graph.gridSize));

				if (data.substring(0, 11) == 'data:image/')
				{
					editorUi.loadImage(data, mxUtils.bind(this, function(img)
	    			{
			    		var resizeImages = true;
			    		
			    		var doInsert = mxUtils.bind(this, function()
			    		{
		    				editorUi.resizeImage(img, data, mxUtils.bind(this, function(data2, w2, h2)
	    	    			{
	    		    			var s = (resizeImages) ? Math.min(1, Math.min(editorUi.maxImageSize / w2, editorUi.maxImageSize / h2)) : 1;
	
    							editorUi.importFile(data, mime, x, y, Math.round(w2 * s), Math.round(h2 * s), filename, function(cells)
    							{
    								editorUi.spinner.stop();
    								graph.setSelectionCells(cells);
    								graph.scrollCellToVisible(graph.getSelectionCell());
    							});
	    	    			}), resizeImages);
			    		});
			    		
			    		if (data.length > editorUi.resampleThreshold)
			    		{
			    			editorUi.confirmImageResize(function(doResize)
	    					{
	    						resizeImages = doResize;
	    						doInsert();
	    					});
			    		}
			    		else
		    			{
			    			doInsert();
		    			}
	    			}), mxUtils.bind(this, function()
	    			{
	    				editorUi.handleError({message: mxResources.get('cannotOpenFile')});
	    			}));
				}
				else
				{
					editorUi.importFile(data, mime, x, y, 0, 0, filename, function(cells)
					{
						editorUi.spinner.stop();
						graph.setSelectionCells(cells);
						graph.scrollCellToVisible(graph.getSelectionCell());
					});
				}
			});
			
			var getMimeType = mxUtils.bind(this, function(filename)
			{
				var mime = 'text/xml';
				
				if (/\.png$/i.test(filename))
				{
					mime = 'image/png';
				}
				else if (/\.jpe?g$/i.test(filename))
				{
					mime = 'image/jpg';
				}
				else if (/\.gif$/i.test(filename))
				{
					mime = 'image/gif';
				}
				else if (/\.pdf$/i.test(filename))
				{
					mime = 'application/pdf';
				}
				
				return mime;
			});
			
			function pickFileFromService(service)
			{
				// Drive requires special arguments for libraries and bypassing realtime
				service.pickFile(function(id)
				{
					if (editorUi.spinner.spin(document.body, mxResources.get('loading')))
					{
						// NOTE The third argument in getFile says denyConvert to match
						// the existing signature in the original DriveClient which has
						// as slightly different semantic, but works the same way.
						service.getFile(id, function(file)
						{
							var mime = (file.getData().substring(0, 11) == 'data:image/') ? getMimeType(file.getTitle()) : 'text/xml';
							
							// Imports SVG as images
							if (/\.svg$/i.test(file.getTitle()) && !editorUi.editor.isDataSvg(file.getData()))
							{
								file.setData(Editor.createSvgDataUri(file.getData()));
								mime = 'image/svg+xml';
							}
							
							doImportFile(file.getData(), mime, file.getTitle());
						},
						function(resp)
						{
							editorUi.handleError(resp, (resp != null) ? mxResources.get('errorLoadingFile') : null);
						}, service == editorUi.drive);
					}
				}, true);
			};
		
			if (typeof(google) != 'undefined' && typeof(google.picker) != 'undefined')
			{
				if (editorUi.drive != null)
				{
					// Requires special arguments for libraries and realtime
					menu.addItem(mxResources.get('googleDrive') + '...', null, function()
					{
						pickFileFromService(editorUi.drive);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_GOOGLE))
				{
					menu.addItem(mxResources.get('googleDrive') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}
			}

			if (editorUi.isModeReady(App.MODE_ONEDRIVE))
			{
				menu.addItem(mxResources.get('oneDrive') + '...', null, function()
				{
					pickFileFromService(editorUi.oneDrive);
				}, parent);
			}
			else if (editorUi.isModeEnabled(App.MODE_ONEDRIVE))
			{
				menu.addItem(mxResources.get('oneDrive') + ' (' + mxResources.get('loading') + '...)', null, function()
				{
					// do nothing
				}, parent, null, false);
			}

			if (editorUi.isModeReady(App.MODE_DROPBOX))
			{
				menu.addItem(mxResources.get('dropbox') + '...', null, function()
				{
					pickFileFromService(editorUi.dropbox);
				}, parent);
			}
			else if (editorUi.isModeEnabled(App.MODE_DROPBOX))
			{
				menu.addItem(mxResources.get('dropbox') + ' (' + mxResources.get('loading') + '...)', null, function()
				{
					// do nothing
				}, parent, null, false);
			}
			
			menu.addSeparator(parent);
			
			if (editorUi.isModeReady(App.MODE_GITHUB))
			{
				menu.addItem(mxResources.get('github') + '...', null, function()
				{
					pickFileFromService(editorUi.gitHub);
				}, parent);
			}
			
			if (editorUi.isModeReady(App.MODE_GITLAB))
			{
				menu.addItem(mxResources.get('gitlab') + '...', null, function()
				{
					pickFileFromService(editorUi.gitLab);
				}, parent);
			}

			if (editorUi.isModeReady(App.MODE_TRELLO))
			{
				menu.addItem(mxResources.get('trello') + '...', null, function()
				{
					pickFileFromService(editorUi.trello);
				}, parent);
			}
			else if (editorUi.isModeEnabled(App.MODE_TRELLO))
			{
				menu.addItem(mxResources.get('trello') + ' (' + mxResources.get('loading') + '...)', null, function()
				{
					// do nothing
				}, parent, null, false);
			}
			
			menu.addSeparator(parent);

			if (isLocalStorage && urlParams['browser'] != '0')
			{
				menu.addItem(mxResources.get('browser') + '...', null, function()
				{
					editorUi.importLocalFile(false);
				}, parent);
			}

			if (urlParams['noDevice'] != '1')
			{
				menu.addItem(mxResources.get('device') + '...', null, function()
				{
					editorUi.importLocalFile(true);
				}, parent);
			}
			
			if (!editorUi.isOffline())
			{
				menu.addSeparator(parent);
				
				menu.addItem(mxResources.get('url') + '...', null, function()
				{
					var dlg = new FilenameDialog(editorUi, '', mxResources.get('import'), function(fileUrl)
					{
						if (fileUrl != null && fileUrl.length > 0 && editorUi.spinner.spin(document.body, mxResources.get('loading')))
						{
							var mime = (/(\.png)($|\?)/i.test(fileUrl)) ? 'image/png' : 'text/xml';
							
							// Uses proxy to avoid CORS issues
							editorUi.editor.loadUrl(PROXY_URL + '?url=' + encodeURIComponent(fileUrl), function(data)
							{
								doImportFile(data, mime, fileUrl);
							},
							function ()
							{
								editorUi.spinner.stop();
								editorUi.handleError(null, mxResources.get('errorLoadingFile'));
							}, mime == 'image/png');
						}
					}, mxResources.get('url'));
					editorUi.showDialog(dlg.container, 300, 80, true, true);
					dlg.init();
				}, parent);
			}
		}))).isEnabled = isGraphEnabled;

		this.put('dynamicAppearance', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var iw = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

			if (Editor.currentTheme == 'simple')
			{
				// Elements are hidden with the following widths:
				// ViewZoom: <750
				// Insert edge: <680
				// Insert text: <660
				// Comments: <560
				// Insert Table: <500
				// Pages: <480
				// Insert Shapes: <440
				// Insert Freehand: <390
				// Share: <360
				// Insert: <320

				if (iw < 750)
				{
					this.addSubmenu('viewZoom', menu, parent, mxResources.get('zoom'));
				}

				if (iw < 460 && editorUi.isPageMenuVisible())
				{
					this.addSubmenu('pages', menu, parent);
				}

				if (iw < 320)
				{
					this.addSubmenu('insert', menu, parent);
				}

				if (iw < 360  && urlParams['embed'] != '1' &&
					editorUi.getServiceName() == 'draw.io')
				{
					this.addSubmenu('share', menu, parent);
				}
			}
		})));
		
		this.put('appearance', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			if (editorUi.isAutoDarkModeSupported())
			{
				var item = editorUi.menus.addMenuItem(menu, 'autoMode', parent);

				if (item != null)
				{
					item.setAttribute('title', mxResources.get('automatic') +
						' (' + mxResources.get(Editor.isDarkMode() ?
							'dark' : 'light') + ')');
				}
			}

			this.addMenuItems(menu, ['lightMode', 'darkMode', '-'], parent);
			var item = editorUi.menus.addMenuItem(menu, 'highContrast', parent);

			if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
			{
				editorUi.menus.addLinkToItem(item, 'https://github.com/jgraph/drawio/issues/4296');
			}
		})));

		editorUi.actions.addAction('addToScratchpad', function(evt)
		{
			if (!graph.isSelectionEmpty() && editorUi.addSelectionToScratchpad != null)
			{
				editorUi.addSelectionToScratchpad(evt);
			}
		});

		editorUi.actions.addAction('accounts...', function()
		{
			editorUi.toggleUserPanel();
			editorUi.userPanel.style.right = '10px';
			editorUi.userPanel.style.top = '10px';
		});

		this.put('theme', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var theme = (urlParams['sketch'] == '1') ? 'sketch' : mxSettings.getUi();
			
			var autoItem = menu.addItem(mxResources.get('automatic'), null, function()
			{
				editorUi.setCurrentTheme('');
			}, parent);
			
			var item = menu.addItem(mxResources.get('classic'), null, function()
			{
				editorUi.setCurrentTheme('kennedy');
			}, parent);

			var themeFound = false;

			if (theme == 'kennedy' || theme == 'dark')
			{
				menu.addCheckmark(item, Editor.checkmarkImage);
				themeFound = true;
			}

			for (var i = 0; i < Editor.themes.length; i++)
			{
				(mxUtils.bind(this, function(key)
				{
					item = menu.addItem(mxResources.get((key == 'min') ?
						'minimal' : key), null, function()
					{
						editorUi.setCurrentTheme(key);
					}, parent);

					if (theme == key)
					{
						menu.addCheckmark(item, Editor.checkmarkImage);
						themeFound = true;
					}
					
					if (key == 'simple')
					{
						menu.addSeparator(parent);
					}
				})(Editor.themes[i]));
			}
			
			if (!themeFound)
			{
				menu.addCheckmark(autoItem, Editor.checkmarkImage);
			}
		})));

		var renameAction = this.editorUi.actions.addAction('rename...', mxUtils.bind(this, function()
		{
			var file = this.editorUi.getCurrentFile();
			
			if (file != null)
			{
				if (file.constructor == LocalFile && file.fileHandle != null)
				{
					editorUi.showSaveFilePicker(mxUtils.bind(editorUi, function(fileHandle, desc)
					{
						file.invalidFileHandle = null;
						file.fileHandle = fileHandle;
						file.title = desc.name;
						file.desc = desc;
						editorUi.save(desc.name);
					}), null, editorUi.createFileSystemOptions(file.getTitle()));
				}
				else
				{
					// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
					// Custom rename dialog — replaces FilenameDialog with a split-input layout so
					// the .drawio extension is greyed out and non-editable, matching the save dialog.
					// ====== end of changes by SE ======
					var currentTitle = (file.getTitle() != null) ? file.getTitle() : this.editorUi.defaultFilename;
					var currentBase  = currentTitle.endsWith('.drawio') ? currentTitle.slice(0, -7) : currentTitle;
					var self = this;

					var renameDiv = document.createElement('div');
					renameDiv.style.cssText = 'padding:20px;font-family:Helvetica,Arial,sans-serif;';

					var label = document.createElement('div');
					label.innerHTML = '<strong>Rename diagram</strong>';
					label.style.cssText = 'margin-bottom:12px;font-size:14px;';
					renameDiv.appendChild(label);

					var inputWrapper = document.createElement('div');
					inputWrapper.style.cssText = 'display:flex;align-items:stretch;border:1px solid #ccc;border-radius:4px;overflow:hidden;font-size:14px;box-sizing:border-box;margin-bottom:16px;';

					var renameInput = document.createElement('input');
					renameInput.type  = 'text';
					renameInput.value = currentBase;
					renameInput.style.cssText = 'flex:1;border:none;outline:none;padding:8px 10px;font-size:14px;box-sizing:border-box;';

					var renameSuffix = document.createElement('span');
					renameSuffix.innerHTML = '.drawio';
					renameSuffix.style.cssText = 'padding:8px 10px;background:#f0f0f0;color:#999;border-left:1px solid #ccc;white-space:nowrap;cursor:default;user-select:none;font-size:14px;';

					inputWrapper.appendChild(renameInput);
					inputWrapper.appendChild(renameSuffix);
					renameDiv.appendChild(inputWrapper);

					var btnRow = document.createElement('div');
					btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

					var cancelBtn = document.createElement('button');
					cancelBtn.innerHTML = 'Cancel';
					cancelBtn.style.cssText = 'padding:8px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;';

					var okBtn = document.createElement('button');
					okBtn.innerHTML = 'Rename';
					okBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:4px;background:#008f89;color:#fff;cursor:pointer;font-size:13px;';

					btnRow.appendChild(cancelBtn);
					btnRow.appendChild(okBtn);
					renameDiv.appendChild(btnRow);

					// Show dialog using draw.io's built-in dialog wrapper.
					self.editorUi.showDialog(renameDiv, 360, 140, true, true);
					renameInput.focus();
					renameInput.select();

					var doRename = mxUtils.bind(self, function()
					{
						var baseVal  = renameInput.value.trim().replace(/\.drawio$/i, '');
						if (!baseVal) { editorUi.handleError({message: 'Please enter a filename.'}); return; }
						var newTitle = baseVal + '.drawio';
						if (newTitle === file.getTitle()) { self.editorUi.hideDialog(); return; }
						self.editorUi.hideDialog();
						if (self.editorUi.spinner.spin(document.body, mxResources.get('renaming')))
						{
							file.rename(newTitle,
								mxUtils.bind(self, function() { self.editorUi.spinner.stop(); }),
								mxUtils.bind(self, function(resp) {
									self.editorUi.spinner.stop();
									self.editorUi.handleError(resp, (resp != null) ? mxResources.get('errorRenamingFile') : null);
								})
							);
						}
					});

					okBtn.addEventListener('click', doRename);
					cancelBtn.addEventListener('click', function() { self.editorUi.hideDialog(); });
					renameInput.addEventListener('keydown', function(e) {
						if (e.key === 'Enter') { doRename(); }
						if (e.key === 'Escape') { self.editorUi.hideDialog(); }
					});
				}
			}
		}));
		
		renameAction.isEnabled = function()
		{
			return this.enabled && isGraphEnabled.apply(this, arguments);
		}
		
		renameAction.visible = urlParams['embed'] != '1';
		
		editorUi.actions.addAction('makeCopy...', mxUtils.bind(this, function()
		{
			var file = editorUi.getCurrentFile();
			
			if (file != null)
			{
				var title = editorUi.getCopyFilename(file);

				if (file.constructor == DriveFile)
				{
					var dlg = new SaveDialog(editorUi, title, mxUtils.bind(this, function(input, mode, folderId)
					{
						editorUi.hideDialog();

						file.copyFile(mxUtils.bind(this, function(resp)
						{
							file.move(folderId, mxUtils.bind(this, function(resp)
							{
								editorUi.spinner.stop();
							}), mxUtils.bind(this, function(resp)
							{
								editorUi.handleError(resp);
							}));
						}), mxUtils.bind(this, function(resp)
						{
							editorUi.handleError(resp);
						}), input.value);
					}), null, null, null, null, null, null, [App.MODE_GOOGLE], mxResources.get('ok'));
					
					editorUi.showDialog(dlg.container, 420, 150, true, false, mxUtils.bind(this, function()
					{
						editorUi.hideDialog();
					}));

					dlg.init();
				}
				else
				{
					// Creates a copy with no predefined storage
					editorUi.editor.editAsNew(this.editorUi.getFileData(true), title);
				}
			}
		}));

		// Dynamic title implemented below
		var openFolderAction = new Action('openFolder', function(evt, trigger)
		{
			var file = editorUi.getCurrentFile();

			if (file != null)
			{
				editorUi.openLink(file.getFolderUrl());
			}
		});

		openFolderAction.getTitle = function()
		{
			return mxResources.get('openIt', [mxResources.get('folder')]) + '...';
		};

		editorUi.actions.put('openFolder', openFolderAction);
		
		editorUi.actions.addAction('openFile...', mxUtils.bind(this, function()
		{
			var file = editorUi.getCurrentFile();

			if (file != null)
			{
				editorUi.openLink(file.getFileUrl());
			}
		}));
		
		editorUi.actions.addAction('moveToFolder...', mxUtils.bind(this, function()
		{
			var file = editorUi.getCurrentFile();
			
			if (file.getMode() == App.MODE_GOOGLE || file.getMode() == App.MODE_ONEDRIVE)
			{
				var dlg = new SaveDialog(editorUi, '', mxUtils.bind(this, function(input, mode, folderId)
				{
					editorUi.hideDialog();

					if (editorUi.spinner.spin(document.body, mxResources.get('moving')))
	            	{
	            	    file.move(folderId, mxUtils.bind(this, function(resp)
	            		{
	            	    	editorUi.spinner.stop();
	        			}), mxUtils.bind(this, function(resp)
	        			{
	        				editorUi.handleError(resp);
	        			}));
	            	}
				}), null, null, null, null, null, file.getMode());

				editorUi.showDialog(dlg.container, 420, 70, true, false, mxUtils.bind(this, function()
				{
					editorUi.hideDialog();
				}));
				
				dlg.init();
			}
		}));
		
		this.put('publish', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			this.addMenuItems(menu, ['publishLink', 'presentationMode'], parent);
		})));

		if (!EditorUi.isElectronApp && editorUi.isOwnGDriveDomain() &&
			editorUi.getServiceName() == 'draw.io' && !navigator.standalone)
		{
			editorUi.actions.put('presentationMode', new Action('presentationMode' + '...', function()
			{
				var title = (editorUi.getCurrentFile() != null) ?
					editorUi.getCurrentFile().getTitle() : null;
				editorUi.editor.editAsNew(editorUi.getFileData(true), title, true,
					(editorUi.currentPage != null) ? editorUi.currentPage.getId() : null);
			}));
		}
		
		this.editorUi.actions.addAction('share...', mxUtils.bind(this, function()
		{
			try
			{
				var file = editorUi.getCurrentFile();
				
				if (file != null)
				{
					// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
					// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
					//
					// Share dialog — implements file sharing with Nextcloud users via the
					// OCS Share API. Users are searched by Authentik display name via the
					// Nextcloud autocomplete endpoint; the resolved UID is passed to the
					// Share API so Nextcloud can create the share internally.
					//
					// Originally scaffolded as UI-only in Sprint 2 / Task 99.
					// Backend and full frontend wiring added in Sprint 4 / Tasks 191-192.
					//
					// GATE: Bail early with a clear message if the file has not yet been
					// saved to Nextcloud (no server-side path exists to share) or if the
					// user is not signed in (no credentials to call the Share API with).
					// This prevents a confusing 404 or 401 surfacing from deep inside the
					// Promise chain instead of a readable message.
					// ====== end of changes by SE ======
					if (!_nolaiCurrentNextcloudFile)
					{
						editorUi.handleError({message: 'Save the file to Nextcloud before sharing.'});
						return;
					}

					if (!_nextcloudSessionCache.username || !_nextcloudSessionCache.password)
					{
						editorUi.handleError({message: 'Sign in to Nextcloud before sharing.'});
						return;
					}

					// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
					var allPeople = [];
					var selectedPeople = {};

					var div = document.createElement('div');
					div.style.padding = '10px';

					var title = document.createElement('p');
					title.style.margin = '0 0 6px 0';
					title.style.fontWeight = 'bold';
					title.innerHTML = 'Share with colleagues';
					div.appendChild(title);

					var subtitle = document.createElement('div');
					subtitle.style.marginBottom = '10px';
					subtitle.style.color = '#666';
					subtitle.innerHTML = 'Select one or more people from the Nextcloud company list.';
					div.appendChild(subtitle);

					var controls = document.createElement('div');
					controls.style.display = 'flex';
					controls.style.gap = '8px';
					controls.style.marginBottom = '10px';

					var searchInput = document.createElement('input');
					searchInput.type = 'text';
					searchInput.placeholder = 'Search colleague by name or email';
					searchInput.style.flex = '1';
					controls.appendChild(searchInput);

					var refreshBtn = document.createElement('button');
					refreshBtn.className = 'geBtn';
					refreshBtn.innerHTML = 'Reload';
					controls.appendChild(refreshBtn);

					div.appendChild(controls);

					var listContainer = document.createElement('div');
					listContainer.style.border = '1px solid #d3d3d3';
					listContainer.style.borderRadius = '4px';
					listContainer.style.height = '230px';
					listContainer.style.overflow = 'auto';
					listContainer.style.padding = '6px';
					div.appendChild(listContainer);

					var summary = document.createElement('div');
					summary.style.marginTop = '8px';
					summary.style.fontSize = '12px';
					div.appendChild(summary);

					var status = document.createElement('div');
					status.style.marginTop = '6px';
					status.style.fontSize = '12px';
					status.style.color = '#666';
					div.appendChild(status);

					function normalizePeople(raw)
					{
						var result = [];
						var seen = {};

						if (raw == null)
						{
							return result;
						}

						for (var i = 0; i < raw.length; i++)
						{
							var item = raw[i];
							var email = null;
							var name = null;
							// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
							// shareInfo holds the email (or username fallback) from
							// shareWithDisplayNameUnique — the same secondary field
							// Nextcloud's own sharing UI shows below the display name.
							// ====== end of changes by SE ======
							var shareInfo = null;

							if (typeof item === 'string')
							{
								email = item;
								name = item;
								shareInfo = '';
							}
							else if (item != null)
							{
								email = item.email || item.mail || item.userId || item.id || '';
								name = item.displayName || item.name || item.label || email;
								shareInfo = item.shareWithDisplayNameUnique || item.subline || '';
							}

							email = mxUtils.trim(String(email || ''));
							name = mxUtils.trim(String(name || email));
							shareInfo = mxUtils.trim(String(shareInfo || ''));

							if (email.length == 0)
							{
								continue;
							}

							var key = email.toLowerCase();

							if (!seen[key])
							{
								seen[key] = true;
								result.push({name: name, email: email, shareInfo: shareInfo});
							}
						}

						result.sort(function(a, b)
						{
							return a.name.localeCompare(b.name);
						});

						return result;
					}

					function getSelectedRecipients()
					{
						var recipients = [];

						for (var email in selectedPeople)
						{
							if (selectedPeople[email])
							{
								recipients.push(email);
							}
						}

						recipients.sort();
						return recipients;
					}

					function updateSummary()
					{
						var selected = getSelectedRecipients();
						summary.innerHTML = selected.length + ' colleague(s) selected';
					}

					function renderList(filterText)
					{
						while (listContainer.firstChild != null)
						{
							listContainer.removeChild(listContainer.firstChild);
						}

						var filter = mxUtils.trim(String(filterText || '')).toLowerCase();
						var shown = 0;

						for (var i = 0; i < allPeople.length; i++)
						{
							var person = allPeople[i];
							// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
							// Include shareInfo (email) in the local haystack so typing an
							// email address filters the already-loaded list immediately,
							// while the debounced API call runs in parallel for fresh results.
							// ====== end of changes by SE ======
							var haystack = (person.name + ' ' + person.shareInfo).toLowerCase();

							if (filter.length > 0 && haystack.indexOf(filter) < 0)
							{
								continue;
							}

							shown++;

							var row = document.createElement('label');
							row.style.display = 'flex';
							row.style.alignItems = 'flex-start';
							row.style.gap = '8px';
							row.style.padding = '6px';
							row.style.borderRadius = '3px';

							var checkbox = document.createElement('input');
							checkbox.type = 'checkbox';
							checkbox.checked = !!selectedPeople[person.email];
							checkbox.style.marginTop = '3px';
							row.appendChild(checkbox);

							var textWrap = document.createElement('div');
							textWrap.style.display = 'flex';
							textWrap.style.flexDirection = 'column';

							var nameEl = document.createElement('span');
							mxUtils.write(nameEl, person.name);
							textWrap.appendChild(nameEl);

							// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
							// Show the email (shareWithDisplayNameUnique) below the display
							// name, matching the pattern of Nextcloud's own sharing UI.
							// Only rendered when shareInfo is non-empty and differs from the
							// display name — avoids showing a redundant duplicate line for
							// users whose display name happens to equal their email.
							// ====== end of changes by SE ======
							if (person.shareInfo && person.shareInfo !== person.name)
							{
								var shareInfoEl = document.createElement('span');
								shareInfoEl.style.color = '#666';
								shareInfoEl.style.fontSize = '12px';
								mxUtils.write(shareInfoEl, person.shareInfo);
								textWrap.appendChild(shareInfoEl);
							}

							row.appendChild(textWrap);
							listContainer.appendChild(row);

							(function(email, cb)
							{
								mxEvent.addListener(cb, 'change', function()
								{
									selectedPeople[email] = cb.checked;
									updateSummary();
								});
							})(person.email, checkbox);
						}

						if (shown == 0)
						{
							var empty = document.createElement('div');
							empty.style.padding = '6px';
							empty.style.color = '#666';
							empty.innerHTML = 'No colleagues found for this search.';
							listContainer.appendChild(empty);
						}

						updateSummary();
					}

					function setPeople(raw)
					{
						allPeople = normalizePeople(raw || []);
						renderList(searchInput.value);

						if (allPeople.length > 0)
						{
							status.innerHTML = 'Loaded ' + allPeople.length + ' colleague(s) from company list.';
						}
						else
						{
							status.innerHTML = 'No company users available. Connect backend provider to load users.';
						}
					}

					// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
					//
					// loadCompanyPeople — queries the Nextcloud autocomplete endpoint for users.
					//
					// WHY the autocomplete endpoint rather than /cloud/users:
					//   /cloud/users requires admin privileges. The autocomplete endpoint is
					//   available to all authenticated users and is the same source Nextcloud's
					//   own sharing UI uses. It returns both UID and display name in one call.
					//
					// WHY an empty-string initial query:
					//   Passing '' returns a first page of users so the list is populated
					//   immediately on dialog open — the user can refine with the search box.
					// ====== end of changes by SE ======
					function loadCompanyPeople()
					{
						var cache = _nextcloudSessionCache;

						if (!cache.username || !cache.password)
						{
							status.innerHTML = 'Not signed in to Nextcloud. Use the Sign in button first.';
							setPeople([]);
							return;
						}

						status.innerHTML = 'Loading colleagues…';

						searchNextcloudUsers('', cache.baseUrl, cache.username, cache.password)
							.then(function(users)
							{
								// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
								// Exclude the signed-in user and the Nextcloud built-in admin
								// account. The admin account (uid 'admin') is a Nextcloud
								// system user, not an Authentik SSO user, and is never a
								// valid share recipient in normal use.
								// ====== end of changes by SE ======
								var others = users.filter(function(u)
								{
									return u.id !== cache.username && u.id !== 'admin';
								});
								setPeople(others);
							})
							.catch(function()
							{
								status.innerHTML = 'Could not load users. Check your Nextcloud connection.';
								setPeople([]);
							});
					}

					// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
					//
					// WHY debounce at 300ms:
					//   Each keystroke would otherwise fire an HTTP request. 300ms gives the
					//   user time to finish typing a few characters before hitting the network.
					//   Local filtering (renderList) is still applied immediately so the list
					//   feels responsive while the API call is in flight.
					// ====== end of changes by SE ======
					var _shareSearchTimer = null;

					mxEvent.addListener(searchInput, 'input', function()
					{
						// Apply local filter immediately for responsiveness.
						renderList(searchInput.value);

						// Then fire a real API search after the debounce window.
						clearTimeout(_shareSearchTimer);
						_shareSearchTimer = setTimeout(function()
						{
							var query = mxUtils.trim(searchInput.value);
							var cache = _nextcloudSessionCache;

							if (!cache.username || !cache.password) { return; }

							searchNextcloudUsers(query, cache.baseUrl, cache.username, cache.password)
								.then(function(users)
								{
									var others = users.filter(function(u)
									{
										return u.id !== cache.username && u.id !== 'admin';
									});
									allPeople = normalizePeople(others);
									renderList(searchInput.value);
								});
						}, 300);
					});

					mxEvent.addListener(refreshBtn, 'click', function(evt)
					{
						mxEvent.consume(evt);
						loadCompanyPeople();
					});

					// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
					//
					// WHY recipients from getSelectedRecipients() are already UIDs:
					//   normalizePeople() maps item.id (the Nextcloud UID) to person.email, which
					//   is what selectedPeople and getSelectedRecipients() use as the key. The
					//   field is named "email" for legacy reasons but holds the UID in this flow.
					//
					// WHY we check _nolaiCurrentNextcloudFile at the gate (top of share action):
					//   The Share API needs the server-side file path. If the file has never been
					//   saved to Nextcloud, there is no path to share. We gate early with a clear
					//   message rather than failing silently with a 404 from inside the Promise chain.
					// ====== end of changes by SE ======
					var shareDlg = new CustomDialog(editorUi, div, function()
					{
						var recipients = getSelectedRecipients();

						if (recipients.length == 0)
						{
							editorUi.handleError({message: 'Please select at least one colleague.'});
							return;
						}

						if (!_nolaiCurrentNextcloudFile)
						{
							editorUi.handleError({message: 'Save the file to Nextcloud before sharing.'});
							return;
						}

						var cache = _nextcloudSessionCache;

						if (!cache.username || !cache.password)
						{
							editorUi.handleError({message: 'Not signed in to Nextcloud.'});
							return;
						}

						var filename   = _nolaiCurrentNextcloudFile.filename;
						var remotePath = _nolaiCurrentNextcloudFile.remotePath || '/';

						status.innerHTML = 'Sharing…';

						// Fire share requests in parallel for all selected recipients.
						var sharePromises = recipients.map(function(uid)
						{
							return shareFileWithUser(
								filename, uid, cache.baseUrl, cache.username, cache.password, remotePath
							);
						});

						Promise.all(sharePromises)
							.then(function()
							{
								editorUi.editor.setStatus(
									'Shared "' + filename + '" with ' + recipients.length + ' colleague(s).'
								);
								editorUi.hideDialog();
							})
							.catch(function(err)
							{
								editorUi.handleError({message: 'Share failed: ' + (err.message || err)});
							});

					}, null, mxResources.get('share'));

					editorUi.showDialog(shareDlg.container, 540, 460, true, false);
					searchInput.focus();
					loadCompanyPeople();
					// ====== end of changes by SE	======
				}
			}
			catch (e)
			{
				editorUi.handleError(e);
			}
		})).isEnabled = isGraphEnabled;

		this.put('embed', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var file = editorUi.getCurrentFile();
			
			if (file != null && (file.getMode() == App.MODE_GOOGLE ||
				file.getMode() == App.MODE_GITHUB) && /(\.png)$/i.test(file.getTitle()))
			{
				this.addMenuItems(menu, ['liveImage', '-'], parent);
			}
			
			this.addMenuItems(menu, ['embedImage', 'embedSvg', '-', 'embedHtml'], parent);
			
			if (!navigator.standalone && !editorUi.isOffline())
			{
				this.addMenuItems(menu, ['embedIframe'], parent);
			}
			
			this.addMenuItems(menu, ['-', 'microsoftOffice', '-', 'embedNotion'], parent);
		})));

		var addInsertAction = function(method)
		{
			var title = mxResources.get(method) + '...';
			
			editorUi.actions.put(method, new Action(title, function(evt)
			{
				if (method == 'fromText' || method == 'formatSql' ||
					method == 'plantUml' || method == 'mermaid')
				{
					var dlg = new ParseDialog(editorUi, title, method);
					editorUi.showDialog(dlg.container, 640, 420, true,
						false, null, null, null, new mxRectangle(0, 0, 440, 280));
					dlg.init();
				}
				else
				{
					var dlg = new CreateGraphDialog(editorUi, title, method);

					editorUi.showDialog(dlg.container, 620, 420, true, false, function(cancel, isEsc)
					{
						if (isEsc)
						{
							editorUi.confirm(mxResources.get('areYouSure'), function()
							{
								editorUi.hideDialog();
							});

							return false;
						}
						else if (dlg.graph != null)
						{
							if (dlg.graph.container.parentNode != null)
							{
								dlg.graph.container.parentNode.
									removeChild(dlg.graph.container);
							}

							dlg.graph.destroy();
							dlg.graph = null;
						}
					});

					// Executed after dialog is added to dom
					dlg.init();
				}
			})).isEnabled = isGraphEnabled;
		};

		addInsertAction('mermaid');
		addInsertAction('horizontalFlow');
		addInsertAction('verticalFlow');
		addInsertAction('horizontalTree');
		addInsertAction('verticalTree');
		addInsertAction('radialTree');
		addInsertAction('organic');
		addInsertAction('circle');
		addInsertAction('fromText');
		addInsertAction('formatSql');

		// Shows PlantUML if customized or enabled and online
		if (window.PLANT_URL != 'https://plant-aws.diagrams.net' ||
			(EditorUi.enablePlantUml && !editorUi.isOffline()))
		{
			addInsertAction('plantUml');
		}
		
		var insertCell = function(cell)
		{
    		graph.getModel().beginUpdate();
    		try
    	    {
    			cell = graph.addCell(cell);
    	    	graph.fireEvent(new mxEventObject('cellsInserted', 'cells', [cell]));

				if (graph.model.isVertex(cell) && graph.isAutoSizeCell(cell))
				{
					graph.updateCellSize(cell);
				}
    	    }
    		finally
    		{
    			graph.getModel().endUpdate();
    		}
		
    		graph.scrollCellToVisible(cell);
    		graph.setSelectionCell(cell);
    		graph.container.focus();

    		if (graph.editAfterInsert)
    		{
    	        graph.startEditing(cell);
    		}
    		
    		// Async call is workaroun for touch events resetting hover icons
    		window.setTimeout(function()
    		{
	    		if (editorUi.hoverIcons != null)
				{
					editorUi.hoverIcons.update(graph.view.getState(cell));
				}
    		}, 0);
    		
	    	return cell;
		};
		
		var insertVertex = function(value, w, h, style, pt)
		{
			var cell = new mxCell(value, new mxGeometry(0, 0, w, h), style);
			cell.vertex = true;

			if (pt == null)
			{
				pt = graph.getCenterInsertPoint(graph.getBoundingBoxFromGeometry([cell], true));
			}

			cell.geometry.x = pt.x;
    	    cell.geometry.y = pt.y;

			return insertCell(cell);
		};
		
		var insertEdge  = function(value, length, style, pt)
		{
			if (pt == null)
			{
				pt = graph.getCenterInsertPoint(graph.getBoundingBoxFromGeometry([cell], true));
			}

			var cell = new mxCell('', new mxGeometry(0, 0, length, 0), style);
			cell.geometry.setTerminalPoint(pt, true);
			cell.geometry.setTerminalPoint(new mxPoint(pt.x + cell.geometry.width, pt.y), false);
			cell.geometry.points = [];
			cell.geometry.relative = true;
			cell.edge = true;

			return insertCell(cell);
		};
		
		editorUi.actions.put('insertText', new Action('text', function(evt)
		{
			if (graph.isEnabled() && !graph.isCellLocked(graph.getDefaultParent()))
			{
    			graph.startEditingAtCell(insertVertex('Text', 60, 30, graph.appendFontSize(
					Editor.defaultTextStyle, graph.vertexFontSize), (evt != null &&
					!mxEvent.isControlDown(evt) && !mxEvent.isMetaDown(evt) &&
					graph.isMouseInsertPoint()) ? graph.getInsertPoint() : null));
			}
		}, null, null, 'A')).isEnabled = isGraphEnabled;
		
		editorUi.actions.put('insertRectangle', new Action('rectangle', function(evt)
		{
			if (graph.isEnabled() && !graph.isCellLocked(graph.getDefaultParent()))
			{
    	    	insertVertex('', 120, 60, 'whiteSpace=wrap;html=1;', (evt != null &&
					!mxEvent.isControlDown(evt) && !mxEvent.isMetaDown(evt) &&
					graph.isMouseInsertPoint()) ? graph.getInsertPoint() : null);
			}
		}, null, null, 'D')).isEnabled = isGraphEnabled;
		
		editorUi.actions.put('insertNote', new Action('note', function(evt)
		{
			if (graph.isEnabled() && !graph.isCellLocked(graph.getDefaultParent()))
			{
    	    	insertVertex('', 140, 160, 'shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;' +
					'fontColor=#000000;darkOpacity=0.05;fillColor=#FFF9B2;strokeColor=none;fillStyle=solid;' +
					'direction=west;gradientDirection=north;gradientColor=#FFF2A1;shadow=1;size=20;pointerEvents=1;',
					(evt != null && !mxEvent.isControlDown(evt) && !mxEvent.isMetaDown(evt) &&
					graph.isMouseInsertPoint()) ? graph.getInsertPoint() : null);
			}
		}, null, null, 'S')).isEnabled = isGraphEnabled;

		editorUi.actions.put('insertEllipse', new Action('ellipse', function(evt)
		{
			if (graph.isEnabled() && !graph.isCellLocked(graph.getDefaultParent()))
			{
    	    	insertVertex('', 80, 80, 'ellipse;whiteSpace=wrap;html=1;', (evt != null &&
					!mxEvent.isControlDown(evt) && !mxEvent.isMetaDown(evt) &&
					graph.isMouseInsertPoint()) ? graph.getInsertPoint() : null);
			}
		}, null, null, 'F')).isEnabled = isGraphEnabled;
		
		editorUi.actions.put('insertRhombus', new Action('rhombus', function(evt)
		{
			if (graph.isEnabled() && !graph.isCellLocked(graph.getDefaultParent()))
			{
    	    	insertVertex('', 80, 80, 'rhombus;whiteSpace=wrap;html=1;', (evt != null &&
					!mxEvent.isControlDown(evt) && !mxEvent.isMetaDown(evt) &&
					graph.isMouseInsertPoint()) ? graph.getInsertPoint() : null);
			}
		}, null, null, 'R')).isEnabled = isGraphEnabled;

		editorUi.actions.put('insertEdge', new Action('line', function(evt)
		{
			if (graph.isEnabled() && !graph.isCellLocked(graph.getDefaultParent()))
			{
    	    	insertEdge('', graph.defaultEdgeLength, 'edgeStyle=none;orthogonalLoop=1;jettySize=auto;html=1;',
					(evt != null && !mxEvent.isControlDown(evt) && !mxEvent.isMetaDown(evt) &&
					graph.isMouseInsertPoint()) ? graph.getInsertPoint() : null);
			}
		}, null, null, 'C')).isEnabled = isGraphEnabled;

		var toggleShapes = editorUi.actions.put('toggleShapes', new Action('shapes', function()
        {
			if (editorUi.sidebarWindow != null)
			{
				editorUi.sidebarWindow.window.setVisible(
					!editorUi.sidebarWindow.window.isVisible());
			}
			else
			{
				editorUi.toggleShapesPanel(!editorUi.isShapesPanelVisible());
			}
        }, null, null, Editor.ctrlKey + '+' + Editor.shiftKey + '+K'));

		toggleShapes.setToggleAction(true);
		toggleShapes.setSelectedCallback(mxUtils.bind(this, function()
		{
			return (editorUi.sidebarWindow != null && editorUi.sidebarWindow.window.isVisible()) ||
				(editorUi.sidebarWindow == null && editorUi.hsplitPosition > 0);
		}));
		
		this.put('insert', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			if (Editor.currentTheme == 'sketch')
			{
				editorUi.menus.addMenuItems(menu, ['toggleShapes'], parent);
				editorUi.menus.addSubmenu('table', menu, parent);
				menu.addSeparator(parent);
				editorUi.menus.addMenuItems(menu, ['insertText', 'insertLink', '-',
					'insertImage', 'createShape', '-'], parent);

				if (editorUi.insertTemplateEnabled && !editorUi.isOffline())
				{
					editorUi.menus.addMenuItems(menu, ['insertTemplate'], parent);
				}
				
				if (window.isMermaidEnabled)
				{
					editorUi.menus.addMenuItems(menu, ['mermaid'], parent);
				}

				editorUi.menus.addMenuItems(menu, ['-', 'insertFreehand', 'generate', '-'], parent);
				editorUi.menus.addSubmenu('layout', menu, parent);
				editorUi.menus.addSubmenu('insertAdvanced', menu, parent, mxResources.get('advanced'));
			}
			else
			{
				this.addMenuItems(menu, ['insertRectangle', 'insertEllipse', 'insertRhombus',
					'-', 'insertEdge', 'insertNote', '-', 'insertText', 'insertLink',
					'-', 'insertImage', 'createShape', '-'], parent);
				
				if (editorUi.insertTemplateEnabled && !editorUi.isOffline())
				{
					this.addMenuItems(menu, ['insertTemplate'], parent);
				}
				
				if (window.isMermaidEnabled)
				{
					this.addMenuItems(menu, ['mermaid'], parent);
				}

				editorUi.menus.addMenuItems(menu, ['-', 'insertFreehand', 'generate', '-'], parent);

				if (uiTheme == 'min' || Editor.currentTheme == 'simple')
				{
					this.addSubmenu('layout', menu, parent);
					this.addSubmenu('insertLayout', menu, parent, mxResources.get('insert'));
					menu.addSeparator(parent);
					this.addSubmenu('table', menu, parent);
				}
				else
				{
					this.addSubmenu('insertLayout', menu, parent, mxResources.get('layout'));
				}

				this.addSubmenu('insertAdvanced', menu, parent, mxResources.get('advanced'));
			}
		})));

        this.put('table', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			editorUi.menus.addInsertTableCellItem(menu, parent);
		})));

		this.put('insertLayout', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			this.addMenuItems(menu, ['horizontalFlow', 'verticalFlow', '-',
				'horizontalTree', 'verticalTree', 'radialTree', '-',
				'organic', 'circle'], parent);
		})));

		editorUi.actions.put('csv', new Action(mxResources.get('csv') + '...', function()
		{
			graph.popupMenuHandler.hideMenu();
			editorUi.showImportCsvDialog();
		})).isEnabled = isGraphEnabled;

        this.put('insertAdvanced', new Menu(mxUtils.bind(this, function(menu, parent)
        {
			var insertMenuItems = ['fromText', 'plantUml', 'formatSql', 'csv'];

			if (!EditorUi.enablePlantUml)
			{
				insertMenuItems.splice(1, 1);
			}

			this.addMenuItems(menu, insertMenuItems, parent);
			
			if (Editor.currentTheme == 'simple' || Editor.currentTheme == 'min')
			{
				this.addMenuItems(menu, ['-', 'createShape', 'editDiagram'], parent);
			}
        })));
	
		if (Editor.enableCustomLibraries)
		{
			this.put('newLibrary', new Menu(function(menu, parent)
			{
				if (typeof(google) != 'undefined' && typeof(google.picker) != 'undefined')
				{
					if (editorUi.drive != null)
					{
						menu.addItem(mxResources.get('googleDrive') + '...', null, function()
						{
							editorUi.showLibraryDialog(null, null, null, null, App.MODE_GOOGLE);
						}, parent);
					}
					else if (editorUi.isModeEnabled(App.MODE_GOOGLE))
					{
						menu.addItem(mxResources.get('googleDrive') + ' (' + mxResources.get('loading') + '...)', null, function()
						{
							// do nothing
						}, parent, null, false);
					}
				}

				if (editorUi.isModeReady(App.MODE_ONEDRIVE))
				{
					menu.addItem(mxResources.get('oneDrive') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_ONEDRIVE);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_ONEDRIVE))
				{
					menu.addItem(mxResources.get('oneDrive') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}

				if (editorUi.isModeReady(App.MODE_DROPBOX))
				{
					menu.addItem(mxResources.get('dropbox') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_DROPBOX);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_DROPBOX))
				{
					menu.addItem(mxResources.get('dropbox') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}
				
				menu.addSeparator(parent);
				
				if (editorUi.isModeReady(App.MODE_GITHUB))
				{
					menu.addItem(mxResources.get('github') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_GITHUB);
					}, parent);
				}
				
				if (editorUi.isModeReady(App.MODE_GITLAB))
				{
					menu.addItem(mxResources.get('gitlab') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_GITLAB);
					}, parent);
				}

				if (editorUi.isModeReady(App.MODE_TRELLO))
				{
					menu.addItem(mxResources.get('trello') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_TRELLO);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_TRELLO))
				{
					menu.addItem(mxResources.get('trello') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}
				
				menu.addSeparator(parent);
	
				if (isLocalStorage && urlParams['browser'] != '0')
				{
					menu.addItem(mxResources.get('browser') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_BROWSER);
					}, parent);
				}
				
				//if (!mxClient.IS_IOS)
				if (urlParams['noDevice'] != '1')
				{
					menu.addItem(mxResources.get('device') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, App.MODE_DEVICE);
					}, parent);
				}

				if (urlParams['confLib'] == '1')
				{
					menu.addItem(mxResources.get('confluenceCloud') + '...', null, function()
					{
						editorUi.showLibraryDialog(null, null, null, null, 'CONF_LIB');
					}, parent);
				}
			}));
	
			this.put('openLibraryFrom', new Menu(function(menu, parent)
			{
				if (typeof(google) != 'undefined' && typeof(google.picker) != 'undefined')
				{
					if (editorUi.drive != null)
					{
						menu.addItem(mxResources.get('googleDrive') + '...', null, function()
						{
							editorUi.pickLibrary(App.MODE_GOOGLE);
						}, parent);
					}
					else if (editorUi.isModeEnabled(App.MODE_GOOGLE))
					{
						menu.addItem(mxResources.get('googleDrive') + ' (' + mxResources.get('loading') + '...)', null, function()
						{
							// do nothing
						}, parent, null, false);
					}
				}

				if (editorUi.isModeReady(App.MODE_ONEDRIVE))
				{
					menu.addItem(mxResources.get('oneDrive') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_ONEDRIVE);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_ONEDRIVE))
				{
					menu.addItem(mxResources.get('oneDrive') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}

				if (editorUi.isModeReady(App.MODE_DROPBOX))
				{
					menu.addItem(mxResources.get('dropbox') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_DROPBOX);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_DROPBOX))
				{
					menu.addItem(mxResources.get('dropbox') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}
				
				menu.addSeparator(parent);
				
				if (editorUi.isModeReady(App.MODE_GITHUB))
				{
					menu.addItem(mxResources.get('github') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_GITHUB);
					}, parent);
				}
				
				if (editorUi.isModeReady(App.MODE_GITLAB))
				{
					menu.addItem(mxResources.get('gitlab') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_GITLAB);
					}, parent);
				}

				if (editorUi.isModeReady(App.MODE_TRELLO))
				{
					menu.addItem(mxResources.get('trello') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_TRELLO);
					}, parent);
				}
				else if (editorUi.isModeEnabled(App.MODE_TRELLO))
				{
					menu.addItem(mxResources.get('trello') + ' (' + mxResources.get('loading') + '...)', null, function()
					{
						// do nothing
					}, parent, null, false);
				}
				
				menu.addSeparator(parent);
	
				if (isLocalStorage && urlParams['browser'] != '0')
				{
					menu.addItem(mxResources.get('browser') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_BROWSER);
					}, parent);
				}
				
				//if (!mxClient.IS_IOS)
				if (urlParams['noDevice'] != '1')
				{
					menu.addItem(mxResources.get('device') + '...', null, function()
					{
						editorUi.pickLibrary(App.MODE_DEVICE);
					}, parent);
				}
	
				if (!editorUi.isOffline())
				{
					menu.addSeparator(parent);
					
					menu.addItem(mxResources.get('url') + '...', null, function()
					{
						var dlg = new FilenameDialog(editorUi, '', mxResources.get('open'), function(fileUrl)
						{
							if (fileUrl != null && fileUrl.length > 0 && editorUi.spinner.spin(document.body, mxResources.get('loading')))
							{
								var realUrl = fileUrl;
								
								if (!editorUi.editor.isCorsEnabledForUrl(fileUrl))
								{
									realUrl = PROXY_URL + '?url=' + encodeURIComponent(fileUrl);
								}
								
								// Uses proxy to avoid CORS issues
								mxUtils.get(realUrl, function(req)
								{
									if (req.getStatus() >= 200 && req.getStatus() <= 299)
									{
										editorUi.spinner.stop();
										
										try
										{
											editorUi.loadLibrary(new UrlLibrary(
												editorUi, req.getText(), fileUrl));
											editorUi.showSidebar();
										}
										catch (e)
										{
											editorUi.handleError(e, mxResources.get('errorLoadingFile'));
										}
									}
									else
									{
										editorUi.spinner.stop();
										editorUi.handleError(null, mxResources.get('errorLoadingFile'));
									}
								}, function()
								{
									editorUi.spinner.stop();
									editorUi.handleError(null, mxResources.get('errorLoadingFile'));
								});
							}
						}, mxResources.get('url'));
						editorUi.showDialog(dlg.container, 300, 80, true, true);
						dlg.init();
					}, parent);
				}
				
				if (urlParams['confLib'] == '1')
				{
					menu.addSeparator(parent);
					
					menu.addItem(mxResources.get('confluenceCloud') + '...', null, function()
					{
						editorUi.showRemotelyStoredLibrary(mxResources.get('libraries'));
					}, parent);
				}
			}));
		}

		// Overrides edit menu to add find, copyAsImage editGeometry
		this.put('edit', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			this.addMenuItems(menu, ['undo', 'redo', '-', 'cut', 'copy', 'copyAsImage', 'copyAsSvg', 'paste',
				'delete', '-', 'duplicate', '-', 'findReplace', '-', 'editData', 'editTooltip', '-',
				'editStyle',  'editGeometry', 'editConnectionPoints', '-', 'edit', '-',
				'editLink', 'openLink', '-', 'selectVertices', 'selectEdges', 'selectAll', 'selectNone', '-',
				'lockUnlock']);
		})));

		var action = editorUi.actions.addAction('comments', mxUtils.bind(this, function()
		{
			if (this.commentsWindow == null)
			{
				// LATER: Check outline window for initial placement
				this.commentsWindow = new CommentsWindow(editorUi, document.body.offsetWidth - 380, 120, 300, 350);
				//TODO Are these events needed?
				this.commentsWindow.window.addListener('show', function()
				{
					editorUi.fireEvent(new mxEventObject('comments'));
				});
				this.commentsWindow.window.addListener('hide', function()
				{
					editorUi.fireEvent(new mxEventObject('comments'));
				});
				this.commentsWindow.window.setVisible(true);
				editorUi.fireEvent(new mxEventObject('comments'));
			}
			else
			{
				var isVisible = !this.commentsWindow.window.isVisible();
				this.commentsWindow.window.setVisible(isVisible);
				
				this.commentsWindow.refreshCommentsTime();

				if (isVisible && this.commentsWindow.hasError) 
				{
					this.commentsWindow.refreshComments();
				}				
			}
		}));
		action.setToggleAction(true);
		action.setSelectedCallback(mxUtils.bind(this, function() { return this.commentsWindow != null && this.commentsWindow.window.isVisible(); }));

		// Destroys comments window to force update or disable if not supported
		editorUi.editor.addListener('fileLoaded', mxUtils.bind(this, function()
		{
			if (this.commentsWindow != null)
			{
				this.commentsWindow.destroy();
				this.commentsWindow = null;
			}
		}));
		
		// Extends toolbar dropdown
		var viewPanelsMenu = this.get('viewPanels');
		
		viewPanelsMenu.funct = function(menu, parent)
		{
			var file = editorUi.getCurrentFile();
			editorUi.menus.addMenuItems(menu, ['toggleShapes', 'format', 'ruler', '-',
				'findReplace', 'layers', 'tags', 'outline', '-'], parent);

			if (editorUi.commentsSupported())
			{
				editorUi.menus.addMenuItems(menu, ['-', 'comments'], parent);
			}
			
			if (file != null && file.isRealtimeEnabled() && file.isRealtimeSupported())
			{
				editorUi.menus.addMenuItems(menu, ['-', 'showRemoteCursors', 'shareCursor'], parent);
			}

			editorUi.menus.addMenuItems(menu, ['-', 'fullscreen'], parent);
		};

		// Overrides view menu to add search and scratchpad
		this.put('view', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			if (Editor.currentTheme == 'simple')
			{
				var file = editorUi.getCurrentFile();
				editorUi.menus.addMenuItems(menu, ['toggleShapes', 'format'], parent);
	
				if (editorUi.isPageMenuVisible())
				{
					editorUi.menus.addMenuItems(menu, ['pageTabs'], parent);
				}

				editorUi.menus.addMenuItems(menu, ['ruler', '-', 'search'], parent);

				if (isLocalStorage || mxClient.IS_CHROMEAPP)
				{
					var item = editorUi.menus.addMenuItem(menu, 'scratchpad', parent);
					
					if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
					{
						editorUi.menus.addLinkToItem(item, 'https://www.drawio.com/doc/faq/scratchpad');
					}
				}
				
				editorUi.menus.addMenuItems(menu, ['-', 'findReplace',
					'layers', 'tags', 'outline', '-'], parent);
				
				if (editorUi.commentsSupported())
				{
					editorUi.menus.addMenuItems(menu, ['comments'], parent);
				}
				
				if (file != null && file.isRealtimeEnabled() && file.isRealtimeSupported())
				{
					this.addMenuItems(menu, ['showRemoteCursors'], parent);
				}

				this.addMenuItems(menu, ['-', 'fullscreen'], parent);
			}
			else
			{
				this.addMenuItems(menu, (['format', 'outline', 'layers', 'tags']).
					concat((editorUi.commentsSupported()) ?
					['comments', '-'] : ['-']));
				
				this.addMenuItems(menu, ['-', 'search'], parent);
				
				if (isLocalStorage || mxClient.IS_CHROMEAPP)
				{
					var item = this.addMenuItem(menu, 'scratchpad', parent);
					
					if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
					{
						this.addLinkToItem(item, 'https://www.drawio.com/doc/faq/scratchpad');
					}
				}
				
				this.addMenuItems(menu, ['toggleShapes', '-', 'pageView', 'pageScale']);
				this.addSubmenu('units', menu, parent);
				menu.addSeparator(parent);

				if (editorUi.isPageMenuVisible())
				{
					editorUi.menus.addMenuItems(menu, ['pageTabs'], parent);
				}

				this.addMenuItems(menu, ['ruler', '-', 'tooltips', 'animations',
					'-', 'grid', 'guides', '-', 'connectionArrows', 'connectionPoints', '-',
					'resetView', 'zoomIn', 'zoomOut'], parent);

				if (urlParams['sketch'] != '1')
				{
					this.addMenuItems(menu, ['-', 'fullscreen'], parent);
				}
			}
		})));

		// Edit cell menu
		this.put('editCell', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			// Last entry edits cell label
			this.addMenuItems(menu, ['editLink', 'editShape', 'editImage', 'crop', '-',
				'editData', 'copyData', 'pasteData', '-', 'editConnectionPoints',
				'editGeometry', '-', 'editTooltip', 'editStyle', '-', 'edit'], parent);
		})));
				
		// Current page menu
		this.put('currentPage', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var page = editorUi.currentPage;

			if (page != null)
			{
				menu.addItem(mxResources.get('rename') + '...', null, mxUtils.bind(this, function()
				{
					editorUi.renamePage(page, page.getName());
				}), parent);
				
				menu.addItem(mxResources.get('delete'), null, mxUtils.bind(this, function()
				{
					editorUi.removePage(page);
				}), parent);
				
				if (editorUi.pages.length > 1)
				{
					editorUi.menus.addSubmenu('movePage', menu, parent, mxResources.get('move'));
					menu.addSeparator(parent);
				}

				menu.addSeparator(parent);

				menu.addItem(mxResources.get('duplicate'), null, mxUtils.bind(this, function()
				{
					editorUi.duplicatePage(page, mxResources.get('copyOf', [page.getName()]));
				}), parent);
				
				if (urlParams['embed'] != 1)
				{
					if (!mxClient.IS_CHROMEAPP && !EditorUi.isElectronApp && editorUi.getServiceName() == 'draw.io')
					{
						menu.addItem(mxResources.get('openInNewWindow'), null, mxUtils.bind(this, function()
						{
							editorUi.editor.editAsNew(editorUi.getFileData(true, null, null, null, true, true));
						}), parent);
					}
				}
			}
		})));

		// Pages menu
		this.put('pages', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var page = editorUi.currentPage;

			if (!editorUi.editor.graph.isLightboxView())
			{
				menu.addItem(mxResources.get('insertPage'), null, mxUtils.bind(this, function()
				{
					try
					{
						editorUi.insertPage();
					}
					catch (e)
					{
						editorUi.handleError(e);
					}
				}), parent, null, editorUi.editor.graph.isEnabled());
				
				menu.addSeparator(parent);
			}
			
			if (editorUi.pages != null)
			{
				for (var i = 0; i < editorUi.pages.length; i++)
				{
					(mxUtils.bind(this, function(index)
					{
						var item = null;

						if (editorUi.pages[index] == page && !editorUi.editor.graph.isLightboxView() &&
							editorUi.editor.graph.isEnabled())
						{
							item = editorUi.menus.addSubmenu('currentPage', menu, parent,
								editorUi.getShortPageName(page));
						}
						else
						{
							item = menu.addItem(editorUi.getShortPageName(editorUi.pages[index]),
								null, mxUtils.bind(this, function()
							{
								editorUi.selectPage(editorUi.pages[index]);
							}), parent);
						}

						var id = editorUi.pages[index].getId();
						item.setAttribute('title', editorUi.pages[index].getName() +
							' (' + (index + 1) + '/' + editorUi.pages.length + ')' +
							((id != null) ? ' [' + id + ']' : ''));
						
						// Adds checkmark to current page
						if (editorUi.pages[index] == page)
						{
							menu.addCheckmark(item, Editor.checkmarkImage);
						}
					}))(i);
				}

				menu.addSeparator(parent);

				menu.addItem(mxResources.get('deleteAll'), null, mxUtils.bind(this, function()
				{
					graph.getModel().beginUpdate();	
					try
					{	
						for (var i = editorUi.pages.length; i >= 0; i--)
						{
							editorUi.removePage(editorUi.pages[i]);
						}
					}
					catch (e)
					{
						editorUi.handleError(e);
					}
					finally
					{
						graph.getModel().endUpdate();
					}

					editorUi.actions.get('resetView').funct();
				}), parent, null, editorUi.editor.graph.isEnabled());
			}
		})));
		
		if (EditorUi.isElectronApp)
		{
			var enableSpellCheck = urlParams['enableSpellCheck'] == '1';

			var spellCheckAction = editorUi.actions.addAction('spellCheck', function()
			{
				editorUi.toggleSpellCheck();
				enableSpellCheck = !enableSpellCheck;
				editorUi.alert(mxResources.get('restartForChangeRequired'));
			});
			
			spellCheckAction.setToggleAction(true);
			spellCheckAction.setSelectedCallback(function() { return enableSpellCheck; });

			var enableStoreBkp = urlParams['enableStoreBkp'] == '1';

			var storeBkpAction = editorUi.actions.addAction('autoBkp', function()
			{
				editorUi.toggleStoreBkp();
				enableStoreBkp = !enableStoreBkp;
			});
			
			storeBkpAction.setToggleAction(true);
			storeBkpAction.setSelectedCallback(function() { return enableStoreBkp; });

			var enableGoogleFonts = urlParams['isGoogleFontsEnabled'] == '1';
			
			var googleFontsAction = editorUi.actions.addAction('googleFonts', function()
			{
				editorUi.toggleGoogleFonts();
				enableGoogleFonts = !enableGoogleFonts;
				editorUi.alert(mxResources.get('restartForChangeRequired'));
			});

			googleFontsAction.setToggleAction(true);
			googleFontsAction.setSelectedCallback(function() { return enableGoogleFonts; });

			editorUi.actions.addAction('openDevTools', function()
			{
				editorUi.openDevTools();
			});

			editorUi.actions.addAction('drafts...', function()
			{
				var dlg = new FilenameDialog(editorUi, (EditorUi.draftSaveDelay / 1000) + '',
					mxResources.get('apply'), mxUtils.bind(this, function(newValue)
				{
					var val = parseInt(newValue);
					
					if (val >= 0)
					{
						EditorUi.draftSaveDelay = val * 1000;
						EditorUi.enableDrafts = val > 0;  //Disable if zero
						mxSettings.setDraftSaveDelay(val);
						mxSettings.save();		
					}
				}), mxResources.get('draftSaveInt'));
				editorUi.showDialog(dlg.container, 320, 80, true, true);
				dlg.init();
			});
		}
		
		var langMenu = this.get('language');

		this.put('extras', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			// Compatiblity code for live UI switch and static UI
			if (Editor.currentTheme == 'simple' ||
				Editor.currentTheme == 'sketch' ||
				Editor.currentTheme == 'min')
			{
				if (langMenu != null && (urlParams['embed'] != '1' || urlParams['lang'] == null))
				{
					editorUi.menus.addSubmenu('language', menu, parent);
				}
				
				if ((urlParams['embed'] != '1' || urlParams['atlas'] == '1') &&
					urlParams['extAuth'] != '1' && urlParams['embedInline'] != '1')
				{
					editorUi.menus.addSubmenu('appearance', menu, parent);
				}

				if (urlParams['embed'] != '1' && urlParams['extAuth'] != '1' &&
					editorUi.mode != App.MODE_ATLAS)
				{
					editorUi.menus.addSubmenu('theme', menu, parent);
				}
				
				menu.addSeparator(parent);

				editorUi.menus.addSubmenu('units', menu, parent);
				editorUi.menus.addMenuItems(menu, ['-', 'copyConnect',
					'collapseExpand', '-', 'tooltips', 'animations', '-'], parent);

				var file = editorUi.getCurrentFile();

				if (Editor.currentTheme != 'simple')
				{
					if (file != null && file.isRealtimeEnabled() && file.isRealtimeSupported())
					{
						this.addMenuItems(menu, ['showRemoteCursors'], parent);
					}
					
					editorUi.menus.addMenuItems(menu, ['ruler', '-'], parent);
				}

				if (EditorUi.isElectronApp)
				{
					editorUi.menus.addMenuItems(menu, ['-', 'googleFonts', 'spellCheck', 'autoBkp', 'drafts', '-'], parent);
				}

				this.addSubmenu('diagramLanguage', menu, parent);
				menu.addSeparator(parent);
				
				if (editorUi.mode != App.MODE_ATLAS) 
				{
					editorUi.menus.addMenuItem(menu, 'configuration', parent);
				}
				
				// Adds trailing separator in case new plugin entries are added
				menu.addSeparator(parent);
			}
			else
			{
				if (urlParams['embed'] != '1' || urlParams['lang'] == null)
				{
					this.addSubmenu('language', menu, parent);
				}
				
				if (urlParams['embed'] != '1' || urlParams['atlas'] == '1')
				{
					editorUi.menus.addSubmenu('appearance', menu, parent);
				}

				if (urlParams['embed'] != '1' && urlParams['extAuth'] != '1' &&
					editorUi.mode != App.MODE_ATLAS)
				{
					this.addSubmenu('theme', menu, parent);
				}

				if (EditorUi.isElectronApp)
				{
					this.addMenuItems(menu, ['-', 'googleFonts', 'spellCheck', 'autoBkp', 'drafts', '-'], parent);
				}
	
				menu.addSeparator(parent);
				var item = this.addSubmenu('adaptiveColors', menu, parent);

				if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
				{
					editorUi.menus.addLinkToItem(item, 'https://github.com/jgraph/drawio/discussions/4713');
				}
				
				if (typeof(MathJax) !== 'undefined')
				{
					var item = this.addMenuItem(menu, 'mathematicalTypesetting', parent);
					
					if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
					{
						this.addLinkToItem(item, 'https://www.drawio.com/doc/faq/math-typesetting');
					}
				}
				
				if (urlParams['embed'] != '1')
				{
					var file = editorUi.getCurrentFile();

					if (file != null && file.isRealtimeEnabled() && file.isRealtimeSupported())
					{
						this.addMenuItems(menu, ['-', 'showRemoteCursors', 'shareCursor'], parent);
					}

					menu.addSeparator(parent);
					
					if (isLocalStorage || mxClient.IS_CHROMEAPP)
					{
						this.addMenuItems(menu, ['showStartScreen'], parent);
					}

					this.addMenuItems(menu, ['autosave'], parent);
				}

				this.addMenuItems(menu, ['-', 'copyConnect', 'collapseExpand', '-'], parent);
				this.addSubmenu('diagramLanguage', menu, parent);
				this.addMenuItems(menu, ['editDiagram', '-'], parent);

				if (!editorUi.isOfflineApp() && isLocalStorage)
				{
					this.addMenuItem(menu, 'plugins', parent);
				}
	
				this.addMenuItems(menu, ['configuration'], parent);
			}
		})));

		this.put('movePage', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var currentPage = editorUi.currentPage;
			var current = editorUi.getPageIndex(currentPage);

			if (editorUi.pages != null)
			{
				for (var i = 0; i < editorUi.pages.length; i++)
				{
					if (i != current)
					{
						(function(index)
						{
							menu.addItem(editorUi.getShortPageName(editorUi.pages[index]), null, function()
							{
								editorUi.movePage(current, index);
								editorUi.scrollToPage(currentPage, true);
							}, parent);
						})(i);
					}
				}
			}
		})));

		this.put('share', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			if (!editorUi.isStandaloneApp())
			{
				var err = (editorUi.isOffline(true)) ?
					mxResources.get('offline') :
					editorUi.getNetworkStatus();

				if (err != null)
				{
					menu.addItem(err, null, null, parent, null, false);
					menu.addSeparator(parent);
				}

				editorUi.menus.addMenuItems(menu, ['share'], parent);
			}

			this.addMenuItem(menu, 'publishLink', parent, null,
				null, mxResources.get('publish') + '...');

			if (!EditorUi.isElectronApp && editorUi.isOwnGDriveDomain() &&
				editorUi.getServiceName() == 'draw.io' && !navigator.standalone)
			{
				this.addMenuItem(menu, 'presentationMode', parent);
			}

			if (editorUi.getMainUser() != null)
			{
				this.addMenuItems(menu, ['accounts'], parent);
			}
		})));

		this.put('diagram', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var file = editorUi.getCurrentFile();

			if (Editor.currentTheme != 'simple')
			{
				editorUi.menus.addSubmenu('extras', menu, parent, mxResources.get('settings'));
				menu.addSeparator(parent);
			}

			// Compatiblity code for live UI switch and static UI
			var sketchTheme = Editor.currentTheme == 'simple' ||
				Editor.currentTheme == 'sketch';
			
			if (mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
			{
				editorUi.menus.addMenuItems(menu, ['new', 'open'], parent);
				editorUi.menus.addMenuItems(menu,
					['-', 'synchronize', 'properties', '-',
					'save', 'saveAs', '-'], parent);
			}
			else if (editorUi.mode == App.MODE_ATLAS)
			{
				if (urlParams['noSaveBtn'] != '1' &&
					urlParams['embedInline'] != '1')
				{
					editorUi.menus.addMenuItems(menu, ['-', 'save'], parent);
				}
				
				if (urlParams['saveAndExit'] == '1' || 
					(urlParams['noSaveBtn'] == '1' &&
					urlParams['saveAndExit'] != '0') || editorUi.mode == App.MODE_ATLAS)
				{
					editorUi.menus.addMenuItems(menu, ['saveAndExit'], parent);
					
					if (file != null && file.isRevisionHistorySupported())
					{
						editorUi.menus.addMenuItems(menu, ['revisionHistory'], parent);
					}
				}
				
				menu.addSeparator(parent);
			}
			else if (editorUi.mode == App.MODE_ATLAS)
			{
				editorUi.menus.addMenuItems(menu, ['save', 'synchronize', '-'], parent);
			}
			else if (urlParams['noFileMenu'] != '1')
			{
				editorUi.menus.addSubmenu('file', menu, parent);
				menu.addSeparator(parent);

				if (Editor.currentTheme == 'min')
				{
					editorUi.menus.addMenuItems(menu, ['toggleShapes', 'format',
						'layers', 'tags', '-', 'findReplace'], parent);
			
					if (editorUi.commentsSupported())
					{
						editorUi.menus.addMenuItems(menu, ['comments'], parent);
					}
					
					menu.addSeparator(parent);
				}
			}
			
			if (urlParams['noFileMenu'] != '1')
			{
				// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 148 (Version Control) ======
				// ====== end of changes by SE ======
				editorUi.menus.addMenuItems(menu, ['Save', 'Save As', 'My Files'], parent);
			}

			if (Editor.currentTheme != 'simple' && Editor.currentTheme != 'min')
			{
				editorUi.menus.addMenuItems(menu, ['-',  'findReplace'], parent);
		
				if (editorUi.commentsSupported())
				{
					editorUi.menus.addMenuItems(menu, ['comments', '-'], parent);
				}

				editorUi.menus.addMenuItems(menu, ['toggleShapes', 'format',
					'layers', 'tags', '-'], parent);
				editorUi.menus.addMenuItems(menu, ['pageSetup'], parent);
			}
			else if (Editor.currentTheme != 'min')
			{
				this.addMenuItems(menu, ['-'], parent);
				this.addSubmenu('newLibrary', menu, parent);
				this.addSubmenu('openLibraryFrom', menu, parent);
			}
	
			menu.addSeparator(parent);

			// Cannot use print in standalone mode on iOS as we cannot open new windows
			if (urlParams['noFileMenu'] != '1' && (!mxClient.IS_IOS || !navigator.standalone))
			{
				editorUi.menus.addMenuItems(menu, ['print'], parent);
			}
	
			if (!sketchTheme && Editor.currentTheme != 'min')
			{
				if (file != null && editorUi.fileNode != null && urlParams['embedInline'] != '1')
				{
					var filename = (file.getTitle() != null) ?
						file.getTitle() : editorUi.defaultFilename;
					
					if (!/(\.html)$/i.test(filename))
					{
						this.addMenuItems(menu, ['-', 'properties']);
					}
				}
			}
	
			menu.addSeparator(parent);
			
			if (Editor.currentTheme == 'simple')
			{
				editorUi.menus.addSubmenu('extras', menu, parent, mxResources.get('settings'));
				menu.addSeparator(parent);
			}

			editorUi.menus.addSubmenu('help', menu, parent);
			menu.addSeparator(parent);

			if (urlParams['embed'] == '1')
			{
				if (urlParams['noSaveBtn'] != '1' &&
					urlParams['embedInline'] != '1')
				{
					editorUi.menus.addMenuItems(menu, ['save'], parent);
				}
				
				if (urlParams['saveAndExit'] == '1' || 
					(urlParams['noSaveBtn'] == '1' &&
					urlParams['saveAndExit'] != '0'))
				{
					editorUi.menus.addMenuItems(menu, ['saveAndExit'], parent);
					
					if (file != null && file.isRevisionHistorySupported())
					{
						editorUi.menus.addMenuItems(menu, ['revisionHistory'], parent);
					}
				}
			}

			if (urlParams['embed'] == '1' || editorUi.mode == App.MODE_ATLAS)
			{
				if (urlParams['noExitBtn'] != '1' || editorUi.mode == App.MODE_ATLAS)
				{
					editorUi.menus.addMenuItems(menu, ['exit'], parent);
				}
			}
			
			if (urlParams['embed'] != '1' && file != null && typeof AtlasFile == 'undefined') // Exclude Atlasian plugin
			{
				editorUi.menus.addMenuItems(menu, ['-', 'close'], parent);
			}
		})));

		this.put('save', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var file = editorUi.getCurrentFile();
			
			if (file != null && (file.constructor == DriveFile || file.constructor == OneDriveFile))
			{
				editorUi.menus.addMenuItems(menu, ['save', 'makeCopy', '-', 'rename', 'moveToFolder'], parent);
			}
			else
			{
				editorUi.menus.addMenuItems(menu, ['save', 'saveAs', '-', 'rename'], parent);
				this.addMenuItems(menu, [(editorUi.isOfflineApp()) ? 'upload' : 'makeCopy'], parent);
			}
			
			editorUi.menus.addMenuItems(menu, ['-', 'autosave'], parent);
	
			if (file != null && file.isRevisionHistorySupported())
			{
				editorUi.menus.addMenuItems(menu, ['-', 'revisionHistory'], parent);
			}
		})));

		this.put('file', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			// Compatiblity code for live UI switch and static UI
			var minTheme = Editor.currentTheme == 'simple' ||
				Editor.currentTheme == 'sketch' ||
				Editor.currentTheme == 'min';

			if (urlParams['embed'] == '1')
			{
				this.addSubmenu('embed', menu, parent);

				if (urlParams['libraries'] == '1')
				{
					this.addMenuItems(menu, ['-'], parent);
					this.addSubmenu('newLibrary', menu, parent);
					this.addSubmenu('openLibraryFrom', menu, parent);
				}
				
				if (editorUi.isRevisionHistorySupported())
				{
					this.addMenuItems(menu, ['-', 'revisionHistory'], parent);
				}
				
				this.addMenuItems(menu, ['-', 'pageSetup', 'print', '-', 'rename'], parent);
				
				if (urlParams['embedInline'] != '1')
				{
					if (urlParams['noSaveBtn'] == '1')
					{
						if (urlParams['saveAndExit'] != '0')
						{
							this.addMenuItems(menu, ['saveAndExit'], parent);
						}
					}
					else
					{
						// ====== NOLAI - {- Frontend -} /Sprint 4/ Task 148 (Version Control) ======
						// ====== end of changes by SE ======
						this.addMenuItems(menu, ['Save', 'Save As', 'My Files'], parent);

						if (urlParams['saveAndExit'] == '1')
						{
							this.addMenuItems(menu, ['saveAndExit'], parent);
						}
					}
				}
				
				if (urlParams['noExitBtn'] != '1')
				{
					this.addMenuItems(menu, ['exit'], parent);
				}
			}
			else if (minTheme)
			{
				var file = editorUi.getCurrentFile();
				editorUi.menus.addMenuItems(menu, ['new'], parent);
				
				menu.addSeparator(parent);

				if (!mxClient.IS_CHROMEAPP && !EditorUi.isElectronApp &&
					file != null && (file.constructor != LocalFile ||
					file.fileHandle != null))
				{
					editorUi.menus.addMenuItems(menu, ['synchronize'], parent);
				}

				menu.addSeparator(parent);

				if (file != null)
				{
					if (Editor.currentTheme != 'simple' &&
						(file.constructor == DriveFile ||
						file.constructor == GitHubFile ||
						file.constructor == OneDriveFile))
					{
						editorUi.menus.addMenuItems(menu, ['share'], parent);
					}

					if ((Editor.currentTheme == 'sketch' || Editor.currentTheme == 'min') &&
						!mxClient.IS_CHROMEAPP && !EditorUi.isElectronApp)
					{
						this.addMenuItem(menu, 'publishLink', parent, null, null,
							mxResources.get('publish') + '...');
					}

					if ((Editor.currentTheme == 'sketch' || Editor.currentTheme == 'min') &&
						!EditorUi.isElectronApp && editorUi.isOwnGDriveDomain() &&
						editorUi.getServiceName() == 'draw.io' && !navigator.standalone)
					{
						this.addMenuItem(menu, 'presentationMode', parent);
					}
				}

				menu.addSeparator(parent);

				if (file != null && file.isRenamable())
				{
					this.addMenuItems(menu, ['rename'], parent);
				}
				
				if (editorUi.isOfflineApp())
				{
					this.addMenuItems(menu, ['upload'], parent);
				}
				else
				{
					editorUi.menus.addMenuItems(menu, ['makeCopy'], parent);

					if (file != null)
					{
						if (file.constructor == OneDriveFile ||
							file.constructor == DriveFile)
						{
							editorUi.menus.addMenuItems(menu, ['moveToFolder'], parent);
						}

						menu.addSeparator(parent);

						if (file.getFolderUrl() != null)
						{
							editorUi.menus.addMenuItems(menu, ['openFolder'], parent);
						}

						if (file.getFileUrl() != null)
						{
							editorUi.menus.addMenuItems(menu, ['openFile'], parent);
						}
					}
				}
				
				menu.addSeparator(parent);

				if (file != null && file.isRevisionHistorySupported())
				{
					editorUi.menus.addMenuItems(menu, ['revisionHistory'], parent);
				}

				if (file != null && editorUi.fileNode != null && urlParams['embedInline'] != '1')
				{
					var filename = (file.getTitle() != null) ?
						file.getTitle() : editorUi.defaultFilename;
					
					if ((file.constructor == DriveFile && file.sync != null &&
						file.sync.isConnected()) || !/(\.html)$/i.test(filename))
					{
						this.addMenuItems(menu, ['properties'], parent);
					}
				}
					
				if (Editor.currentTheme == 'simple')
				{
					editorUi.menus.addMenuItems(menu, ['-', 'autosave'], parent);
				}
			}
			else
			{
				var file = this.editorUi.getCurrentFile();
				
				if (file != null && file.constructor == DriveFile)
				{
					if (file.isRestricted())
					{
						this.addMenuItems(menu, ['exportOptionsDisabled'], parent);
					}
					
					this.addMenuItems(menu, ['-', 'share'], parent);
					
					var item = this.addMenuItem(menu, 'synchronize', parent);
					
					if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
					{
						this.addLinkToItem(item, 'https://www.drawio.com/doc/faq/synchronize');
					}
					
					menu.addSeparator(parent);
				}
				else
				{
					this.addMenuItems(menu, ['new'], parent);
				}
				// ======	NOLAI - {- Frontend -} /Sprint 2 & 3/ Task 98, Task 100 and Task 151	=====
				menu.addSeparator(parent);
				this.addMenuItems(menu, ['Save', 'Save As', 'My Files'], parent);
				// ====== end of changes by SE	======
			
				if (file != null && file.constructor == DriveFile)
				{
					this.addMenuItems(menu, ['new', '-', 'rename', 'makeCopy',
						'openFolder', 'moveToFolder'], parent);
				}
				else
				{
					if (!mxClient.IS_CHROMEAPP && !EditorUi.isElectronApp &&
						file != null && (file.constructor != LocalFile ||
						file.fileHandle != null))
					{	
						menu.addSeparator(parent);
						var item = this.addMenuItem(menu, 'synchronize', parent);
						
						if (!editorUi.isOffline() || mxClient.IS_CHROMEAPP || EditorUi.isElectronApp)
						{
							this.addLinkToItem(item, 'https://www.drawio.com/doc/faq/synchronize');
						}
					}
					
					this.addMenuItems(menu, ['-'], parent);
					
					if (!mxClient.IS_CHROMEAPP && !EditorUi.isElectronApp &&
						editorUi.getServiceName() == 'draw.io' &&
						!editorUi.isOfflineApp() && file != null)
					{
						// this.addMenuItems(menu, ['share', '-'], parent);
					}
					
					if (file != null && file.isRenamable())
					{
						this.addMenuItems(menu, ['rename'], parent);
					}
					
					if (editorUi.isOfflineApp())
					{
						this.addMenuItems(menu, ['upload'], parent);
					}
					else
					{
						this.addMenuItems(menu, ['makeCopy'], parent);

						if (file != null)
						{
							if (file.constructor == OneDriveFile)
							{
								this.addMenuItems(menu, ['moveToFolder'], parent);
							}

							if (file.getFolderUrl() != null)
							{
								editorUi.menus.addMenuItems(menu, ['openFolder'], parent);
							}
						}
					}
				}
				
				menu.addSeparator(parent);

				if (!editorUi.isOffline())
				{
					menu.addSeparator(parent);
					this.addSubmenu('embed', menu, parent);

					// ======   NOLAI - {- Frontend -} /Sprint 2/ Task 98   =====
					// this.addSubmenu('publish', menu, parent); (This line was commented to avoid confusion and make a more streamlined UI)
					// ====== end of changes by SE	======
				}
				
				menu.addSeparator(parent);

				// ======   NOLAI - {- Frontend -} /Sprint 2/ Task 98   =====
				// (These two lines were commented to avoid confusion and make a more streamlined UI):
				// this.addSubmenu('newLibrary', menu, parent);
				// this.addSubmenu('openLibraryFrom', menu, parent);
				// ====== end of changes by SE	======
				
				if (editorUi.isRevisionHistorySupported())
				{
					this.addMenuItems(menu, ['-', 'revisionHistory'], parent);
				}
				
				if (file != null && editorUi.fileNode != null && urlParams['embedInline'] != '1')
				{
					var filename = (file.getTitle() != null) ?
						file.getTitle() : editorUi.defaultFilename;
					
					if ((file.constructor == DriveFile && file.sync != null &&
						file.sync.isConnected()) || !/(\.html)$/i.test(filename))
					{
						this.addMenuItems(menu, ['-', 'properties']);
					}
				}
				
				this.addMenuItems(menu, ['-', 'pageSetup'], parent);
				
				// Cannot use print in standalone mode on iOS as we cannot open new windows
				if (!mxClient.IS_IOS || !navigator.standalone)
				{
					this.addMenuItems(menu, ['print'], parent);
				}
				
				menu.addSeparator(parent);
				this.addSubmenu('exportAs', menu, parent);

				if (urlParams['noDevice'] != '1')
				{
					menu.addItem(mxResources.get('importFrom') + ' ' + mxResources.get('device') + '...', null, function()
					{
						editorUi.importLocalFile(true);
					}, parent);
				}

				this.addMenuItems(menu, ['-', 'close']);
			}
		})));
	
		//Replace the default font family menu
		this.put('fontFamily', new Menu(mxUtils.bind(this, function(menu, parent)
		{
			var addItem = mxUtils.bind(this, function(fontName, fontUrl, deletable, fontLabel, tooltip)
			{
				var graph = editorUi.editor.graph;

				var tr = this.styleChange(menu, (fontLabel != null) ? fontLabel : fontName,
					[mxConstants.STYLE_FONTFAMILY, 'fontSource', 'FType'],
					[fontName, (fontUrl != null) ? encodeURIComponent(fontUrl) : null, null],
					null, parent, function()
				{
					graph.setFont(fontName, fontUrl);
					editorUi.fireEvent(new mxEventObject('styleChanged',
						'keys', [mxConstants.STYLE_FONTFAMILY, 'fontSource', 'FType'],
						'values', [fontName, (fontUrl != null) ? encodeURIComponent(fontUrl) : null, null],
						'cells', [graph.cellEditor.getEditingCell()]));
				}, function()
				{
					graph.updateLabelElements(graph.getSelectionCells(), function(elt)
					{
						elt.removeAttribute('face');
						elt.style.fontFamily = null;
						
						if (elt.nodeName == 'PRE')
						{
							graph.replaceElement(elt, 'div');
						}
					});
				});
				
				if (deletable)
				{
					var img = document.createElement('img');
					img.className = 'geAdaptiveAsset';
					img.setAttribute('src', Editor.crossImage);
					img.setAttribute('title', mxResources.get('delete'));
					img.setAttribute('valign', 'absmiddle');
					img.setAttribute('border', '0');
					img.style.position = 'relative';
					img.style.top = '2px';
					img.style.width = '14px';
					img.style.cursor = 'default';
					img.style.margin = '0 3px';
					tr.firstChild.nextSibling.nextSibling.appendChild(img);
					
					mxEvent.addListener(img, (mxClient.IS_POINTER) ? 'pointerup' : 'mouseup', mxUtils.bind(this, function(evt)
					{
						this.removeCustomFont(fontName, fontUrl);
						this.editorUi.hideCurrentMenu();
						mxEvent.consume(evt);
					}));
				}
				
				Graph.addFont(fontName, fontUrl);
				tr.firstChild.nextSibling.style.fontFamily = fontName;
				
				var tooltip = (fontLabel != null) ? fontLabel : fontName;
						
				if (fontUrl != null)
				{
					tooltip += ' (' + fontUrl + ')';
				}

				tr.setAttribute('title', tooltip);
			});
			
			var reserved = {};

			for (var i = 0; i < this.defaultFonts.length; i++)
			{
				var value = this.defaultFonts[i];
				
				if (typeof value === 'string')
				{
					addItem(value);
				}
				else if (value.fontFamily != null && value.fontUrl != null)
				{
					reserved[encodeURIComponent(value.fontFamily) + '@' +
						encodeURIComponent(value.fontUrl)] = true;
					addItem(value.fontFamily, value.fontUrl);
				}
			}

			menu.addSeparator(parent);
		
			// Special entries in the font menu are composed of custom fonts
			// from the local storage and actual used fonts in the file
			var duplicates = {};
			var fontNames = {};
			var entries = [];
			
			function addEntry(entry)
			{
				var key = encodeURIComponent(entry.name) +
					((entry.url == null) ? '' :
					'@' + encodeURIComponent(entry.url));
					
				if (!reserved[key])
				{
					var label = entry.name;
					var counter = 0;
					
					while (fontNames[label.toLowerCase()] != null)
					{
						label = entry.name + ' (' + (++counter) + ')';
					}
					
					if (duplicates[key] == null)
					{
						entries.push({name: entry.name, url: entry.url,
							label: label, title: entry.url});
						fontNames[label.toLowerCase()] = entry;
						duplicates[key] = entry;
					}
				}
			};
			
			// Adds custom user-defined fonts from local storage
			for (var i = 0; i < this.customFonts.length; i++)
			{
				addEntry(this.customFonts[i]);
			}
			
			// Sorts by label
			entries.sort(function(a, b)
			{
				if (a.label < b.label)
				{
					return -1;
				}
				else if (a.label > b.label)
				{
					return 1;
				}
				else
				{
					return 0;
				}
			});
			
			if (entries.length > 0)
			{
				for (var i = 0; i < entries.length; i++)
				{
					addItem(entries[i].name, entries[i].url,
						true, entries[i].label);
				}

				menu.addSeparator(parent);
			}
			
			menu.addItem(mxResources.get('reset'), null, mxUtils.bind(this, function()
			{
				this.customFonts = [];
				editorUi.fireEvent(new mxEventObject('customFontsChanged'));
			}), parent);
			
			menu.addSeparator(parent);
			
			menu.addItem(mxResources.get('custom') + '...', null, mxUtils.bind(this, function()
			{
				var graph = this.editorUi.editor.graph;
				var curFontName = graph.getStylesheet().getDefaultVertexStyle()
					[mxConstants.STYLE_FONTFAMILY];
				var curType = 's';
				var curUrl = null;
				
				// Handles in-place editing custom fonts via font family lookup
				if (graph.isEditing())
				{
					var node = graph.getSelectedEditingElement();

					if (node != null)
					{
						var css = mxUtils.getCurrentStyle(node);

						if (css != null)
						{
							curFontName = mxUtils.getCssFontFamily(css.fontFamily);

							// Finds the URL for the current font by finding the nearest parent element
							// with a data-font-src attribute or the fontSource attribute from the cell
							var state = graph.getView().getState(graph.cellEditor.getEditingCell());
							var curUrl = (state != null) ? state.style['fontSource'] : null;
			    			
			    			if (curUrl != null)
			    			{
				    			curUrl = decodeURIComponent(curUrl);
							}

							var temp = node;

							while (temp != null && temp != graph.cellEditor.textarea)
							{
								if (temp.nodeType == mxConstants.NODETYPE_ELEMENT)
								{
									if (temp.getAttribute('data-font-src') != null)
									{
										curUrl = temp.getAttribute('data-font-src');
										break;
									}
									else if (temp.getAttribute('face') == curFontName)
									{
										// Means that a system font is used for the element
										curUrl = null;
										break;
									}
								}

								temp = temp.parentNode;
							}
							
							if (curUrl != null)
							{
								if (Graph.isGoogleFontUrl(curUrl))
								{
									curUrl = null;
									curType = 'g';
								}
								else
								{
									curType = 'w';
								}
							}
						}
					}
				}
				else
				{
			    	var state = graph.getView().getState(graph.getSelectionCell());
			    	
			    	if (state != null)
			    	{
			    		curFontName = state.style[mxConstants.STYLE_FONTFAMILY] || curFontName;
						var temp = state.style['fontSource'];
						
						if (temp != null)
						{
							temp = decodeURIComponent(temp);
							
							if (Graph.isGoogleFontUrl(temp))
							{
								curType = 'g';
							}
							else
							{
								curType = 'w';
								curUrl = temp;
							}
						}
			    	}
				}
		    	
    			if (curUrl != null && curUrl.substring(0, PROXY_URL.length) == PROXY_URL)
				{
    				curUrl = decodeURIComponent(curUrl.substr((PROXY_URL + '?url=').length));
				}
		    	
		    	// Saves the current selection state
		    	var selState = null;
		    	
		    	if (document.activeElement == graph.cellEditor.textarea)
				{
					selState = graph.cellEditor.saveSelection();
				}
				
				var dlg = new FontDialog(this.editorUi, curFontName, curUrl, curType, mxUtils.bind(this, function(fontName, fontUrl, type)
				{
					// Restores the selection state
					if (selState != null)
					{
						graph.cellEditor.restoreSelection(selState);
						selState = null;
					}
					
					if (fontName != null && fontName.length > 0)
					{
						this.addCustomFont(fontName, fontUrl);

						if (graph.isEditing())
						{
							graph.setFont(fontName, fontUrl);
						}
						else
						{
							graph.getModel().beginUpdate();
							
							try
							{
								graph.stopEditing(false);
								graph.setCellStyles(mxConstants.STYLE_FONTFAMILY, fontName);
								graph.setCellStyles('fontSource', (fontUrl != null) ?
									encodeURIComponent(fontUrl) : null);
								graph.setCellStyles('FType', null);
							}
							finally
							{
								graph.getModel().endUpdate();
							}
						}
					}
				}));
				this.editorUi.showDialog(dlg.container, 380, 
					130 + (Editor.enableWebFonts ? 70 : 0) + (urlParams['isGoogleFontsEnabled'] != '0'? 50 : 0), true, true);
				dlg.init();
			}), parent, null, true);
		})));
	};
})();
