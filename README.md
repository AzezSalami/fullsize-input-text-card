# Fullsize Input Text Card

A Home Assistant dashboard card that shows an `input_text` (or `text`) entity as a plain text field filling the whole card. No card-mod needed.

## Install with HACS

1. Create a public GitHub repository named `fullsize-input-text-card` and put these three files in its root:
   - `fullsize-input-text-card.js`
   - `hacs.json`
   - `README.md`
2. In Home Assistant, open HACS, open the menu (top right) and choose **Custom repositories**.
3. Paste the repository URL, choose type **Dashboard**, and add it.
4. Find **Fullsize Input Text Card** in HACS, download it, and reload the browser.

## Install by hand

1. Copy `fullsize-input-text-card.js` to `config/www/`.
2. Go to Settings → Dashboards → menu → Resources and add `/local/fullsize-input-text-card.js` as a **JavaScript module**.
3. Reload the browser.

## Use

```yaml
type: custom:fullsize-input-text-card
entity: input_text.sent_voice_notification
grid_options:
  columns: 8
  rows: 1
```

## Options

| Option        | Required | Default              | What it does                                         |
| ------------- | -------- | -------------------- | ---------------------------------------------------- |
| `entity`      | yes      |                      | An `input_text` or `text` entity.                    |
| `placeholder` | no       | entity friendly name | Grey text shown when the field is empty.             |
| `font_size`   | no       | `16px`               | Text size, for example `18px`.                       |
| `border`      | no       | `false`              | Show the normal card border (highlights on focus).   |

## Behaviour

- The value is saved when you press Enter or leave the field.
- Escape discards what you typed and restores the stored value.
- The entity's maximum length, pattern and password mode are respected.
- The field fills the card, so its height follows `grid_options.rows`.
