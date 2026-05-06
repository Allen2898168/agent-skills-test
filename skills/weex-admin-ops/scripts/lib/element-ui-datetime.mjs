import { sleep } from "./browser.mjs";

export async function setDateTimeRangeByLabel(page, label, startValue, endValue, required = true) {
  const result = await page.evaluate(async ({ label, startValue, endValue }) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const normalize = text => (text || "").replace(/\s/g, "");
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs.at(-1) || document;
    const item = [...root.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(candidate => normalize(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(normalize(label)));
    if (!item) return null;
    const editors = [...item.querySelectorAll(".el-date-editor")]
      .filter(visible)
      .map(element => element.__vue__)
      .filter(Boolean);
    if (editors.length < 2) return null;
    const values = [startValue, endValue];
    for (let index = 0; index < 2; index += 1) {
      const vm = editors[index];
      const value = values[index];
      vm.emitInput(value);
      vm.emitChange(value);
      vm.$emit("input", value);
      vm.$emit("change", value);
      vm.userInput = null;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    return editors.slice(0, 2).map(vm => ({
      value: vm.value,
      displayValue: vm.displayValue,
    }));
  }, { label, startValue, endValue });
  const bound = result?.[0]?.value === startValue && result?.[1]?.value === endValue;
  if (!bound && required) throw new Error(`Date-time range binding failed: ${label}; result=${JSON.stringify(result)}`);
  await sleep(500);
  return result;
}
