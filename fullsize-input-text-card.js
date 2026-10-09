/*
 * Fullsize Input Text Card
 * A Home Assistant dashboard card that shows an input_text (or text) entity
 * as a plain text field filling the whole card.
 *
 * type: custom:fullsize-input-text-card
 * entity: input_text.my_text
 */

const CARD_TAG = "fullsize-input-text-card";
const CARD_VERSION = "1.0.0";
const SUPPORTED_DOMAINS = ["input_text", "text"];

class FullsizeInputTextCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = undefined;
    this._hass = undefined;
    this._input = undefined;
    this._lastStateObj = undefined;
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
        { name: "placeholder", selector: { text: {} } },
        { name: "font_size", selector: { text: {} } },
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
        height: 100%;
        min-height: 56px;
        box-sizing: border-box;
        overflow: hidden;
      }
      ha-card.no-border {
        border: none;
      }
      ha-card.with-border:focus-within {
        border-color: var(--primary-color);
      }
      input {
        flex: 1;
        min-width: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0 16px;
        box-sizing: border-box;
        border: none;
        outline: none;
        background: transparent;
        color: var(--primary-text-color);
        caret-color: var(--primary-color);
        font-family: inherit;
        font-size: var(--fullsize-input-font-size, 16px);
        line-height: normal;
        -webkit-appearance: none;
        appearance: none;
      }
      input::placeholder {
        color: var(--secondary-text-color);
        opacity: 0.7;
      }
      input:disabled {
        color: var(--disabled-text-color);
        cursor: not-allowed;
      }
    `;

    const card = document.createElement("ha-card");
    card.classList.add(this._config.border ? "with-border" : "no-border");

    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    if (this._config.font_size) {
      input.style.setProperty(
        "--fullsize-input-font-size",
        String(this._config.font_size)
      );
    }

    input.addEventListener("change", () => this._commit());
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        input.blur();
      } else if (ev.key === "Escape") {
        input.value = this._stateValue();
        input.blur();
      }
    });

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
    input.type = attrs.mode === "password" ? "password" : "text";

    if (typeof attrs.max === "number") {
      input.maxLength = attrs.max;
    } else {
      input.removeAttribute("maxlength");
    }
    if (attrs.pattern) {
      input.pattern = attrs.pattern;
    } else {
      input.removeAttribute("pattern");
    }

    input.placeholder =
      this._config.placeholder !== undefined
        ? String(this._config.placeholder)
        : attrs.friendly_name || "";

    // Do not overwrite what the user is typing.
    const focused = this.shadowRoot.activeElement === input;
    const value = this._stateValue();
    if (!focused && input.value !== value) {
      input.value = value;
    }
  }

  /* ---------- saving ---------- */

  _commit() {
    const input = this._input;
    if (!input || !this._hass || !this._config) return;

    const stateObj = this._stateObj();
    if (!stateObj || stateObj.state === "unavailable") return;

    const value = input.value;
    if (value === this._stateValue()) return;

    const domain = this._config.entity.split(".")[0];
    const result = this._hass.callService(domain, "set_value", {
      entity_id: this._config.entity,
      value: value,
    });

    // If Home Assistant rejects the value (too short, wrong pattern...),
    // put the stored value back.
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        input.value = this._stateValue();
      });
    }
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
