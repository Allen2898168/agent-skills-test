import { sleep } from "../browser.mjs";
import { dialog, formItem } from "./common.mjs";

export async function clickVisibleDialogText(page, text) {
  const d = await dialog(page);
  const clicked = await d.evaluate((root, targetText) => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const all = [...root.querySelectorAll("label, span, button, div")].filter(element => visible(element));
    const exact = all.filter(element => (element.innerText || "").trim() === targetText);
    const candidates = (exact.length ? exact : all.filter(element => {
      const text = (element.innerText || "").trim();
      return text.includes(targetText) && text.length <= targetText.length + 12;
    }))
      .sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);
    if (!candidates.length) return false;
    candidates[0].click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Visible dialog text not found: ${text}`);
  await sleep(500);
}

export async function clickButton(page, text, scopeSelector = null, required = true) {
  const clicked = await page.evaluate(({ text, scopeSelector }) => {
    const visibleElements = elements => [...elements].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const root = scopeSelector ? visibleElements(document.querySelectorAll(scopeSelector)).at(-1) : document;
    if (!root) return false;
    const button = visibleElements(root.querySelectorAll("button")).find(item => (item.innerText || "").includes(text));
    if (!button) return false;
    button.click();
    return true;
  }, { text, scopeSelector }).catch(() => false);
  if (!clicked && required) throw new Error(`Button not found: ${text}`);
  await sleep(100);
  return clicked;
}

export async function setEnglish(page, enName) {
  const d = await dialog(page);
  if (!(await d.locator(".el-switch").count())) return false;
  const sw = d.locator(".el-switch").first();
  const cls = await sw.getAttribute("class");
  if (!cls.includes("is-checked")) await sw.click();
  await sleep(700);
  const en = d.locator('input[placeholder="英语"]').first();
  if (await en.count()) {
    await en.fill(enName);
    return true;
  }
  return false;
}

export async function uploadFileInFormItem(page, label, filePath) {
  const item = await formItem(page, label);
  await item.scrollIntoViewIfNeeded();
  const uploadPromise = page.waitForResponse(response => response.url().includes("/prod-api/common/uploadImgReplace"), { timeout: 12000 }).catch(() => null);
  let inputs = await item.$$('input[type="file"]');
  if (!inputs.length) inputs = await page.locator('.el-dialog:visible .el-upload input[type="file"]').elementHandles();
  if (!inputs.length) throw new Error(`${label} file input not found`);
  await inputs[inputs.length - 1].setInputFiles(filePath);
  const response = await uploadPromise;
  await sleep(1200);
  if (!response) throw new Error("Image upload response not observed");
  if (response.status() >= 400) throw new Error(`Image upload HTTP ${response.status()}`);
  return response.status();
}
