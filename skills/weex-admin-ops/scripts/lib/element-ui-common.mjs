export async function dialog(page) {
  const d = page.locator(".el-dialog:visible").last();
  await d.waitFor({ timeout: 10000 });
  return d;
}

export async function dialogByText(page, text) {
  await page.waitForFunction(targetText => [...document.querySelectorAll(".el-dialog")]
    .some(dialog => {
      const rect = dialog.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (dialog.innerText || "").includes(targetText);
    }), text, { timeout: 10000 });
  const handle = await page.evaluateHandle(targetText => [...document.querySelectorAll(".el-dialog")]
    .filter(dialog => {
      const rect = dialog.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (dialog.innerText || "").includes(targetText);
    })[0] || null, text);
  const element = handle.asElement();
  if (!element) throw new Error(`Dialog not found by text: ${text}`);
  return element;
}

export async function formItem(page, label) {
  const handle = await page.evaluateHandle(labelText => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs.at(-1) || document;
    const items = [...root.querySelectorAll(".el-form-item")].filter(visible);
    return items.find(item => norm(item.querySelector(".el-form-item__label")?.innerText).includes(norm(labelText))) || null;
  }, label);
  const element = handle.asElement();
  if (!element) throw new Error(`Form item not found: ${label}`);
  return element;
}

export async function formItemInDialog(page, dialogText, label) {
  const handle = await page.evaluateHandle(({ dialogText, label }) => {
    const norm = text => (text || "").replace(/\s/g, "");
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const dialog = [...document.querySelectorAll(".el-dialog")]
      .filter(visible)
      .find(element => (element.innerText || "").includes(dialogText));
    if (!dialog) return null;
    return [...dialog.querySelectorAll(".el-form-item")]
      .filter(visible)
      .find(item => norm(item.querySelector(".el-form-item__label")?.innerText).includes(norm(label))) || null;
  }, { dialogText, label });
  const element = handle.asElement();
  if (!element) throw new Error(`Form item not found: ${label} in dialog ${dialogText}`);
  return element;
}

export async function setNativeInputValue(input, value) {
  await input.evaluate((element, nextValue) => {
    element.focus();
    const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, String(nextValue));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}
