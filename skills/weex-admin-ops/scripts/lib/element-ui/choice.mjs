import { sleep } from "../browser.mjs";
import { formItem } from "./common.mjs";

export async function clickChoiceByLabel(page, label, choice, type = "checkbox", required = true) {
  let clicked = await tryClickChoice(page, label, choice, type);
  if (clicked) {
    const checked = await waitChoiceChecked(page, label, choice, type, 1200);
    if (!checked) {
      await sleep(250);
      clicked = await tryClickChoice(page, label, choice, type);
      if (clicked) await waitChoiceChecked(page, label, choice, type, 1800);
    }
  }
  if (!clicked && required) throw new Error(`Choice not found: ${label}/${choice}`);
  await sleep(250);
  return clicked;
}

export async function clearCheckedByLabel(page, label, type = "checkbox") {
  await page.evaluate(({ label, type }) => {
    const visibleElements = elements => [...elements].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const normalize = text => (text || "").replace(/\s/g, "");
    const dialogs = visibleElements(document.querySelectorAll(".el-dialog"));
    const root = dialogs.at(-1) || document;
    const item = visibleElements(root.querySelectorAll(".el-form-item"))
      .find(candidate => normalize(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(normalize(label)));
    if (!item) return;
    const selector = type === "radio" ? ".el-radio.is-checked" : ".el-checkbox.is-checked";
    for (const choice of visibleElements(item.querySelectorAll(selector))) {
      if (!choice.classList.contains("is-disabled")) choice.click();
    }
  }, { label, type }).catch(() => {});
  await sleep(200);
}

export async function setSwitchByLabel(page, label, checked, required = true) {
  const changed = await page.evaluate(({ label, checked }) => {
    const visibleElements = elements => [...elements].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const normalize = text => (text || "").replace(/\s/g, "");
    const dialogs = visibleElements(document.querySelectorAll(".el-dialog"));
    const root = dialogs.at(-1) || document;
    const item = visibleElements(root.querySelectorAll(".el-form-item"))
      .find(candidate => normalize(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(normalize(label)));
    if (!item) return false;
    const sw = visibleElements(item.querySelectorAll(".el-switch"))[0];
    if (!sw) return false;
    const isChecked = sw.classList.contains("is-checked");
    if (isChecked !== checked) sw.click();
    return true;
  }, { label, checked }).catch(() => false);
  if (!changed && required) throw new Error(`Switch not found: ${label}`);
  await sleep(400);
  return changed;
}

export async function clickFirstVisibleChoiceByLabel(page, label) {
  const item = await formItem(page, label);
  await item.scrollIntoViewIfNeeded();
  const clicked = await item.evaluate(root => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const choice = [...root.querySelectorAll(".el-radio, .el-checkbox")]
      .find(element => visible(element));
    if (!choice) return false;
    choice.click();
    return true;
  });
  if (!clicked) throw new Error(`Visible choice not found: ${label}`);
  await sleep(600);
}

async function tryClickChoice(page, label, choice, type) {
  return page.evaluate(({ label, choice, type }) => {
    const visibleElements = elements => [...elements].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const normalize = text => (text || "").replace(/\s/g, "");
    const dialogs = visibleElements(document.querySelectorAll(".el-dialog"));
    const root = dialogs.at(-1) || document;
    const item = visibleElements(root.querySelectorAll(".el-form-item"))
      .find(candidate => normalize(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(normalize(label)));
    if (!item) return false;
    const selector = type === "radio" ? ".el-radio" : ".el-checkbox";
    const target = visibleElements(item.querySelectorAll(selector))
      .find(element => normalize(element.innerText) === normalize(choice) || normalize(element.innerText).includes(normalize(choice)));
    if (!target || target.classList.contains("is-disabled")) return false;
    if (!target.classList.contains("is-checked")) {
      target.click();
      const inner = target.querySelector("input, .el-checkbox__inner, .el-radio__inner");
      if (inner) inner.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }
    return true;
  }, { label, choice, type }).catch(() => false);
}

async function waitChoiceChecked(page, label, choice, type, timeoutMs) {
  return page.waitForFunction(({ label, choice, type }) => {
    const visibleElements = elements => [...elements].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const normalize = text => (text || "").replace(/\s/g, "");
    const dialogs = visibleElements(document.querySelectorAll(".el-dialog"));
    const root = dialogs.at(-1) || document;
    const item = visibleElements(root.querySelectorAll(".el-form-item"))
      .find(candidate => normalize(candidate.querySelector(".el-form-item__label")?.innerText || "").includes(normalize(label)));
    if (!item) return false;
    const selector = type === "radio" ? ".el-radio" : ".el-checkbox";
    const target = visibleElements(item.querySelectorAll(selector))
      .find(element => normalize(element.innerText) === normalize(choice) || normalize(element.innerText).includes(normalize(choice)));
    return Boolean(target?.classList.contains("is-checked"));
  }, { label, choice, type }, { timeout: timeoutMs }).then(() => true).catch(() => false);
}
