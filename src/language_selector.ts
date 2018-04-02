import {
    Message
} from '@phosphor/messaging';

import {
    Widget
} from '@phosphor/widgets';

import {
    Notebook, NotebookPanel //, NotebookActions
} from '@jupyterlab/notebook';

import {
    Styling
} from '@jupyterlab/apputils';

const TOOLBAR_DEFAULTLANGUAGE_DROPDOWN_CLASS = 'jp-Notebook-toolbarCelllanguageDropDown';

/**
 * Create a notebook language switcher
 */
export
    function createDefaultLanguageSwitcher(panel: NotebookPanel): Widget {
    return new DefaultLanguageSwitcher(panel.notebook);
}

/**
 * A toolbar widget that switches cell types.
 */
class DefaultLanguageSwitcher extends Widget {
    /**
     * Construct a new cell type switcher.
     */
    constructor(widget: Notebook) {
        super({ node: createDefaultLanguageSwitcherNode() });
        this.addClass(TOOLBAR_DEFAULTLANGUAGE_DROPDOWN_CLASS);
        this.addClass('sos-widget')

        this._select = this.node.firstChild as HTMLSelectElement;
        Styling.wrapSelect(this._select);
        this._wildCard = document.createElement('option');
        this._wildCard.value = '-';
        this._wildCard.textContent = '-';
        this._notebook = widget;

        // Set the initial value.
        if (widget.model) {
            this._updateValue();
        }

        // Follow the type of the active cell.
        widget.activeCellChanged.connect(this._updateValue, this);

        // Follow a change in the selection.
        widget.selectionChanged.connect(this._updateValue, this);
    }

    /**
     * Handle the DOM events for the widget.
     *
     * @param event - The DOM event sent to the widget.
     *
     * #### Notes
     * This method implements the DOM `EventListener` interface and is
     * called in response to events on the dock panel's node. It should
     * not be called directly by user code.
     */
    handleEvent(event: Event): void {
        switch (event.type) {
            case 'change':
                this._evtChange(event);
                break;
            case 'keydown':
                this._evtKeyDown(event as KeyboardEvent);
                break;
            default:
                break;
        }
    }

    /**
     * Handle `after-attach` messages for the widget.
     */
    protected onAfterAttach(msg: Message): void {
        this._select.addEventListener('change', this);
        this._select.addEventListener('keydown', this);
    }

    /**
     * Handle `before-detach` messages for the widget.
     */
    protected onBeforeDetach(msg: Message): void {
        this._select.removeEventListener('change', this);
        this._select.removeEventListener('keydown', this);
    }

    /**
     * Handle `changed` events for the widget.
     */
    private _evtChange(event: Event): void {
        let select = this._select;
        let widget = this._notebook;
        if (select.value === '-') {
            return;
        }
        if (!this._changeGuard) {
            //let value = select.value as nbformat.CellLanguage;
            // FIXME: this should be change cell language
            //NotebookActions.changeCellLanguage(widget, value);
            widget.activate();
        }
    }

    /**
     * Handle `keydown` events for the widget.
     */
    private _evtKeyDown(event: KeyboardEvent): void {
        if (event.keyCode === 13) {  // Enter
            this._notebook.activate();
        }
    }

    /**
     * Update the value of the dropdown from the widget state.
     */
    private _updateValue(): void {
        console.log("UPDATE VALUE");
        let widget = this._notebook;
        let select = this._select;
        if (!widget.activeCell) {
            return;
        }
        let mType: string = widget.activeCell.model.type;
        for (let i = 0; i < widget.widgets.length; i++) {
            let child = widget.widgets[i];
            if (widget.isSelectedOrActive(child)) {
                if (child.model.type !== mType) {
                    mType = '-';
                    select.appendChild(this._wildCard);
                    break;
                }
            }
        }
        if (mType !== '-') {
            select.remove(3);
        }
        this._changeGuard = true;
        select.value = mType;
        this._changeGuard = false;
    }

    private _changeGuard = false;
    private _wildCard: HTMLOptionElement = null;
    private _select: HTMLSelectElement = null;
    private _notebook: Notebook = null;
}


/**
 * Create the node for the cell type switcher.
 */
function createDefaultLanguageSwitcherNode(): HTMLElement {
    let div = document.createElement('div');
    let select = document.createElement('select');
    for (let t of ['R', 'Python', 'SoS']) {
        let option = document.createElement('option');
        option.value = t.toLowerCase();
        option.textContent = t;
        select.appendChild(option);
    }
    select.className = TOOLBAR_DEFAULTLANGUAGE_DROPDOWN_CLASS + " sos-widget";
    div.appendChild(select);
    return div;
}
