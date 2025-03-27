import { FillFormElementRequest, FillFormElementResponse, FormElementInfo, GetFormElementsRequest, GetFormElementsResponse } from './types';

// スタイルの追加
function addHighlightStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .autoinput-highlight {
      animation: autoinput-highlight 3s ease-out;
    }
    
    @keyframes autoinput-highlight {
      0% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.6);
      }
      70% {
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.6);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.6);
      }
    }
  `;
  document.head.appendChild(style);
}

// DOMの準備が完了したらスタイルを追加
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addHighlightStyle);
} else {
  addHighlightStyle();
}

// DOM要素とFormElementInfoのマッピングを保持
const elementMapping = new Map<string, HTMLInputElement>();

// 自動採番IDのカウンター
let refIdCounter = 0;

function generateRefId(): string {
  refIdCounter++;
  return `form-element-${refIdCounter}`;
}

function getFormElements(): FormElementInfo[] {
  const formElements: FormElementInfo[] = [];
  
  // フォーム関連の要素を全て取得
  const inputs = document.querySelectorAll('input, select, textarea');
  
  inputs.forEach((element) => {
    const htmlElement = element as HTMLElement;
    
    // ラベルの取得（複数の方法で）
    let labelText: string | null = null;
    
    // 1. for属性を使用したラベル
    if (htmlElement.id) {
      const label = document.querySelector(`label[for="${htmlElement.id}"]`);
      if (label) {
        labelText = label.textContent?.trim() || null;
      }
    }
    
    // 2. 親要素がlabelの場合
    if (!labelText) {
      const parentLabel = htmlElement.closest('label');
      if (parentLabel) {
        labelText = parentLabel.textContent?.trim() || null;
      }
    }

    // 要素の情報を収集
    const info: FormElementInfo = {
      refId: generateRefId(),
      type: (htmlElement as HTMLInputElement).type || htmlElement.tagName.toLowerCase(),
      label: labelText,
      name: htmlElement.getAttribute('name'),
      id: htmlElement.id,
      value: (htmlElement as HTMLInputElement).value,
      ariaLabel: htmlElement.getAttribute('aria-label'),
      ariaLabelledBy: htmlElement.getAttribute('aria-labelledby'),
      required: (htmlElement as HTMLInputElement).required,
      placeholder: htmlElement.getAttribute('placeholder')
    };

    // aria-labelledby の解決
    if (info.ariaLabelledBy) {
      const labelledByElement = document.getElementById(info.ariaLabelledBy);
      if (labelledByElement) {
        info.ariaLabelledBy = labelledByElement.textContent?.trim() || null;
      }
    }

    // マッピングを保存
    elementMapping.set(info.refId, htmlElement as HTMLInputElement);
    formElements.push(info);
  });

  return formElements;
}

// ハイライト効果を適用する関数
function highlightElement(element: HTMLElement) {
  // クラスを追加
  element.classList.add('autoinput-highlight');
  
  // アニメーション終了後にクラスを削除
  element.addEventListener('animationend', () => {
    element.classList.remove('autoinput-highlight');
  }, { once: true });
}

// Chrome Extension のメッセージリスナー
chrome.runtime.onMessage.addListener((
  request: GetFormElementsRequest | FillFormElementRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: GetFormElementsResponse | FillFormElementResponse) => void
) => {
  console.log("onMessage:", request);
  if (request.action === "getFormElements") {
    const formElements = getFormElements();
    sendResponse({ formElements });
  }

  if (request.action === "fillFormElement") {
    const element = elementMapping.get(request.refId);
    if (element) {
      (element as HTMLInputElement).value = request.value;
      // ハイライト効果を適用
      highlightElement(element);
      sendResponse({ refId: request.refId, status: "success" });
    } else {
      sendResponse({ refId: request.refId, status: "error" });
    }
  }
  return true;
}); 