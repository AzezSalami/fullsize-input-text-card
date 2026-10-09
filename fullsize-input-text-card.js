/*
 * Fullsize Input Text Card
 * A Home Assistant dashboard card that shows an input_text (or text) entity
 * as a plain text area filling the whole card. Text starts at the top and
 * wraps onto the next line.
 *
 * type: custom:fullsize-input-text-card
 * entity: input_text.my_text
 */

const CARD_TAG = "fullsize-input-text-card";
const CARD_VERSION = "1.3.0";
const SAVE_DELAY_MS = 300;
const SUPPORTED_DOMAINS = ["input_text", "text"];

class FullsizeInputTextCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = undefined;
    this._hass = undefined;
    this._input = undefined;
    this._lastStateObj = undefined;
    this._saveTimer = undefined;
    this._pending = 0;
  }

  disconnectedCallback() {
    // Save anything still waiting when the card is removed.
    this._flush();
  }

  /* ---------- Home Assistant card API ---------- */

  static getStubConfig(hass) {
    const entity = Object.keys((hass && hass.states) || {}).find((id) =>
      id.startsWith("input_text.")
    );
    return { entity: entity || "input_text.example" };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "entity",
          required: true,
          selector: { entity: { domain: SUPPORTED_DOMAINS } },
        },
        { name: "label", selector: { text: {} } },
        { name: "placeholder", selector: { text: {} } },
        { name: "font_size", selector: { text: {} } },
        { name: "background", selector: { text: {} } },
        { name: "border", selector: { boolean: {} } },
      ],
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You need to define an entity");
    }
    const domain = String(config.entity).split(".")[0];
    if (!SUPPORTED_DOMAINS.includes(domain)) {
      throw new Error("Entity must be an input_text or text entity");
    }
    this._config = config;
    this._lastStateObj = undefined;
    this._build();
    this._update(true);
  }

  set hass(hass) {
    this._hass = hass;
    this._update(false);
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: 1, min_rows: 1 };
  }

  /* ---------- rendering ---------- */

  _build() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        height: 100%;
      }
      ha-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 56px;
        box-sizing: border-box;
        overflow: hidden;
        background: var(
          --fullsize-input-background,
          var(
            --ha-color-form-background,
            var(
              --input-fill-color,
              var(--mdc-text-field-fill-color, rgba(127, 127, 127, 0.12))
            )
          )
        );
      }
      ha-card.no-border {
        border: none;
      }
      ha-card.with-border:focus-within {
        border-color: var(--primary-color);
      }
      label {
        flex: none;
        display: block;
        padding: 8px 16px 0;
        font-family: inherit;
        font-size: 12px;
        line-height: 16px;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: text;
      }
      ha-card:focus-within label {
        color: var(--primary-color);
      }
      label + textarea {
        padding-top: 0;
        padding-bottom: 8px;
      }
      textarea {
        display: block;
        flex: 1;
        min-width: 0;
        min-height: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 16px;
        box-sizing: border-box;
        resize: none;
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-width: thin;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        border: none;
        outline: none;
        background: transparent;
        color: var(--primary-text-color);
        caret-color: var(--primary-color);
        font-family: inherit;
        font-size: var(--fullsize-input-font-size, 16px);
        line-height: 1.5;
        -webkit-appearance: none;
        appearance: none;
      }
      textarea.password {
        -webkit-text-security: disc;
      }
      textarea::placeholder {
        color: var(--secondary-text-color);
        opacity: 0.7;
      }
      textarea:disabled {
        color: var(--disabled-text-color);
        cursor: not-allowed;
      }
    `;

    const card = document.createElement("ha-card");
    card.classList.add(this._config.border ? "with-border" : "no-border");
    if (this._config.background) {
      card.style.setProperty(
        "--fullsize-input-background",
        String(this._config.background)
      );
    }

    const input = document.createElement("textarea");
    input.rows = 1;
    input.autocomplete = "off";
    if (this._config.font_size) {
      input.style.setProperty(
        "--fullsize-input-font-size",
        String(this._config.font_size)
      );
    }

    // Save while typing (shortly after the last keystroke), and at once
    // when the field is left or Enter is pressed.
    input.addEventListener("input", () => {
      // The entity holds a single line: turn pasted line breaks into spaces.
      if (/[\r\n]/.test(input.value)) {
        const pos = input.selectionStart;
        input.value = input.value.replace(/\r\n|\r|\n/g, " ");
        input.setSelectionRange(pos, pos);
      }
      this._scheduleSave();
    });
    input.addEventListener("change", () => this._flush());
    input.addEventListener("blur", () => this._flush());
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        input.blur();
      }
    });

    input.id = "field";
    const labelText =
      this._config.label === undefined || this._config.label === null
        ? ""
        : String(this._config.label).trim();
    if (labelText) {
      const label = document.createElement("label");
      label.htmlFor = "field";
      label.textContent = labelText;
      card.appendChild(label);
    } else if (this._config.placeholder === undefined) {
      input.setAttribute("aria-label", this._config.entity);
    }
    this._hasLabel = Boolean(labelText);
    card.appendChild(input);
    root.appendChild(style);
    root.appendChild(card);
    this._input = input;
  }

  _stateObj() {
    if (!this._hass || !this._config) return undefined;
    return this._hass.states[this._config.entity];
  }

  _stateValue() {
    const stateObj = this._stateObj();
    if (!stateObj) return "";
    if (stateObj.state === "unknown" || stateObj.state === "unavailable") {
      return "";
    }
    return stateObj.state;
  }

  _update(force) {
    const input = this._input;
    if (!input || !this._hass || !this._config) return;

    const stateObj = this._stateObj();
    if (!force && stateObj === this._lastStateObj) return;
    this._lastStateObj = stateObj;

    if (!stateObj) {
      input.disabled = true;
      input.value = "";
      input.placeholder = "Entity not found: " + this._config.entity;
      return;
    }

    const attrs = stateObj.attributes || {};
    input.disabled = stateObj.state === "unavailable";
    input.classList.toggle("password", attrs.mode === "password");

    if (typeof attrs.max === "number") {
      input.maxLength = attrs.max;
    } else {
      input.removeAttribute("maxlength");
    }

    // With a label the field needs no placeholder unless one is given.
    input.placeholder =
      this._config.placeholder !== undefined
        ? String(this._config.placeholder)
        : this._hasLabel
        ? ""
        : attrs.friendly_name || "";

    // Do not overwrite what the user is typing, or a value still being saved.
    const focused = this.shadowRoot.activeElement === input;
    const busy = this._pending > 0 || this._saveTimer !== undefined;
    const value = this._stateValue();
    if (!focused && !busy && input.value !== value) {
      input.value = value;
    }
  }

  /* ---------- saving ---------- */

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = undefined;
      this._commit();
    }, SAVE_DELAY_MS);
  }

  _flush() {
    if (this._saveTimer === undefined) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = undefined;
    this._commit();
  }

  _commit() {
    const input = this._input;
    if (!input || !this._hass || !this._config) return;

    const stateObj = this._stateObj();
    if (!stateObj || stateObj.state === "unavailable") return;

    const value = input.value;
    if (value === this._stateValue()) return;

    // Too short to be accepted yet: wait for more typing.
    const min = (stateObj.attributes || {}).min;
    if (typeof min === "number" && value.length < min) return;

    const domain = this._config.entity.split(".")[0];
    const result = this._hass.callService(domain, "set_value", {
      entity_id: this._config.entity,
      value: value,
    });

    if (!result || typeof result.then !== "function") return;

    this._pending += 1;
    const done = (failed) => {
      this._pending -= 1;
      if (this._pending > 0 || this._saveTimer !== undefined) return;
      // Once nothing is being saved and the user has left the field, show
      // what Home Assistant actually stored (this also undoes a rejected
      // value, e.g. one that does not match the entity's pattern).
      if (failed || this.shadowRoot.activeElement !== input) {
        this._update(true);
      }
    };
    result.then(
      () => done(false),
      () => done(true)
    );
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, FullsizeInputTextCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Fullsize Input Text Card",
    description: "A text field that fills the whole card.",
    preview: false,
  });
}

console.info(
  "%c FULLSIZE-INPUT-TEXT-CARD %c v" + CARD_VERSION + " ",
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;"
);
