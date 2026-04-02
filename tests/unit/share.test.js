/**
 * Share-related unit tests for Menu.js
 *
 * Only the following are being tested:
 * - shareCursor action
 * - showRemoteCursors action
 */

function setupMenusGlobals() {
  global.urlParams = {};

  global.EditorUi = {
    isElectronApp: false,
  };

  global.mxUtils = {
    bind: (scope, fn) => fn.bind(scope),
  };

  global.mxConstants = {
    POINTS: 'points',
  };

  global.mxPopupMenu = function () {
    this.div = document.createElement('div');
  };

  global.mxPopupMenu.prototype.showMenu = jest.fn();

  global.Action = function (label, fn) {
    this.label = label;
    this.funct = fn;
    this.isEnabled = true;
    this.setToggleAction = jest.fn();
    this.setSelectedCallback = jest.fn();
  };

  global.Menu = function (fn) {
    this.funct = fn;
  };

  global.Menus = function (editorUi) {
    this.editorUi = editorUi;
    this.defaultMenuItems = ['file', 'edit'];
  };

  global.Menus.prototype.init = function () {};
  global.Menus.prototype.put = function () {};
  global.Menus.prototype.addMenuItems = function () {};
}

function loadMenusModule() {
  jest.resetModules();
  setupMenusGlobals();
  require('../../drawio app/src/main/webapp/js/diagramly/Menus.js');
}

function createAction(name, fn) {
  return {
    name,
    funct: fn,
    setToggleAction: jest.fn(),
    setSelectedCallback: jest.fn(),
    setEnabled: jest.fn(),
  };
}

function createEditorUiWithActionCapture() {
  const actionsByName = {};
  let shareCursor = false;
  let showRemoteCursors = false;

  const editorUi = {
    editor: {
      graph: {
        isEnabled: jest.fn(() => true),
        view: {
          setUnit: jest.fn(),
          unit: null,
        },
      },
    },
    actions: {
      addAction: jest.fn((name, fn) => {
        if (name === 'points') {
          throw new Error('STOP_AFTER_SHARE_ACTIONS');
        }

        const action = createAction(name, fn);
        actionsByName[name] = action;
        return action;
      }),
      put: jest.fn((name, action) => {
        actionsByName[name] = action;
        return action;
      }),
    },
    isShareCursorPosition: jest.fn(() => shareCursor),
    setShareCursorPosition: jest.fn((next) => {
      shareCursor = next;
    }),
    isShowRemoteCursors: jest.fn(() => showRemoteCursors),
    setShowRemoteCursors: jest.fn((next) => {
      showRemoteCursors = next;
    }),
    isOffline: jest.fn(() => false),
    mode: 'web',
  };

  return { editorUi, actionsByName };
}

function initMenusUntilShare(editorUi) {
  const menus = new Menus(editorUi);

  try {
    menus.init();
  }
  catch (err) {
    if (err.message !== 'STOP_AFTER_SHARE_ACTIONS') {
      throw err;
    }
  }

  return menus;
}

describe('Menus share actions', () => {
  beforeEach(() => {
    loadMenusModule();
  });

  it('configures shareCursor as toggle action and toggles state when invoked', () => {
    const { editorUi, actionsByName } = createEditorUiWithActionCapture();
    initMenusUntilShare(editorUi);

    const shareCursorAction = actionsByName.shareCursor;
    expect(shareCursorAction).toBeTruthy();

    expect(shareCursorAction.setToggleAction).toHaveBeenCalledWith(true);
    expect(shareCursorAction.setSelectedCallback).toHaveBeenCalledTimes(1);

    const selectedCb = shareCursorAction.setSelectedCallback.mock.calls[0][0];
    expect(selectedCb()).toBe(false);

    shareCursorAction.funct();

    expect(editorUi.setShareCursorPosition).toHaveBeenCalledWith(true);
  });

  it('configures showRemoteCursors as toggle action and toggles state when invoked', () => {
    const { editorUi, actionsByName } = createEditorUiWithActionCapture();
    initMenusUntilShare(editorUi);

    const showRemoteCursorsAction = actionsByName.showRemoteCursors;
    expect(showRemoteCursorsAction).toBeTruthy();

    expect(showRemoteCursorsAction.setToggleAction).toHaveBeenCalledWith(true);
    expect(showRemoteCursorsAction.setSelectedCallback).toHaveBeenCalledTimes(1);

    const selectedCb = showRemoteCursorsAction.setSelectedCallback.mock.calls[0][0];
    expect(selectedCb()).toBe(false);

    showRemoteCursorsAction.funct();

    expect(editorUi.setShowRemoteCursors).toHaveBeenCalledWith(true);
  });
});
