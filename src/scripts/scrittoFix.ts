// Workaround: scritto toggles `data-wrap` on values that contain whitespace,
// which lets the host wrap and breaks button layouts. Keep buttons on a single
// line; preserve wrapping everywhere else.
import "@scritto/core";

const ScrittoText = customElements.get("scritto-text");
if (ScrittoText) {
	const original = ScrittoText.prototype._setWrap;
	ScrittoText.prototype._setWrap = function () {
		if (this.closest("button")) {
			this.removeAttribute("data-wrap");
			return;
		}
		if (original) original.call(this);
	};
}
