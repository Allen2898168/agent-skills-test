import { sleep } from "../browser.mjs";
import { formItem, formItemInDialog, setNativeInputValue } from "./element-ui-common.mjs";

export async function fillLabel(page, label, value, required = true) {
  try {
    const item = await formItem(page, label);
    await item.scrollIntoViewIfNeeded();
    const input = await item.$('input:not([type="file"]):not([readonly]):not([type="radio"]):not([type="checkbox"]), textarea');
    if (!input) throw new Error(`Input not found: ${label}`);
    await setNativeInputValue(input, value);
    await sleep(100);
    return true;
  } catch (error) {
    if (required) throw error;
    return false;
  }
}

export async function fillLabelInDialog(page, dialogText, label, value, required = true) {
  try {
    const item = await formItemInDialog(page, dialogText, label);
    await item.scrollIntoViewIfNeeded();
    const input = await item.$('input:not([type="file"]):not([readonly]):not([type="radio"]):not([type="checkbox"]), textarea');
    if (!input) throw new Error(`Input not found: ${label}`);
    await setNativeInputValue(input, value);
    await sleep(100);
    return true;
  } catch (error) {
    if (required) throw error;
    return false;
  }
}

export async function labelValueInDialog(page, dialogText, label, required = true) {
  try {
    const item = await formItemInDialog(page, dialogText, label);
    const value = await item.evaluate(root => {
      const input = root.querySelector('input:not([type="file"]), textarea');
      if (input) return input.value || input.getAttribute("value") || "";
      return root.innerText.trim();
    });
    return value;
  } catch (error) {
    if (required) throw error;
    return null;
  }
}

export async function fillInputByPlaceholder(page, placeholder, value, required = true) {
  try {
    const filled = await page.evaluate(({ placeholder, value }) => {
      const visibleElements = elements => [...elements].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const setNativeValue = (input, nextValue) => {
        input.focus();
        const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(input, String(nextValue));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const input = visibleElements(document.querySelectorAll('input:not([readonly]):not([type="radio"]):not([type="checkbox"]), textarea'))
        .find(item => (item.getAttribute("placeholder") || "").includes(placeholder));
      if (!input) return false;
      setNativeValue(input, value);
      return true;
    }, { placeholder, value });
    if (!filled) throw new Error(`Input not found by placeholder: ${placeholder}`);
    await sleep(100);
    return true;
  } catch (error) {
    if (required) throw error;
    return false;
  }
}

export async function visibleFormErrors(page) {
  return page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const dialogs = [...document.querySelectorAll(".el-dialog")].filter(visible);
    const root = dialogs.at(-1) || document;
    return [...root.querySelectorAll(".el-form-item")]
      .map(item => ({
        label: item.querySelector(".el-form-item__label")?.innerText.trim(),
        error: item.querySelector(".el-form-item__error")?.innerText.trim(),
      }))
      .filter(item => item.error);
  });
}
