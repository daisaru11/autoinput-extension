export type FormElementInfo = {
  refId: string;        // 自動採番されたID
  type: string;          // input, select, textarea など
  label: string | null;  // 関連するラベルテキスト
  name: string | null;   // name 属性
  id: string | null;     // id 属性
  value: string;         // 現在の値
  ariaLabel: string | null;    // aria-label
  ariaLabelledBy: string | null; // aria-labelledby
  required: boolean;     // 必須項目かどうか
  placeholder: string | null;  // プレースホルダー
} 

export type GetFormElementsRequest = {
  action: 'getFormElements';
}

export type GetFormElementsResponse = {
  formElements: FormElementInfo[];
}

export type FillFormElementRequest = {
  action: 'fillFormElement';
  refId: string;
  value: string;
}

export type FillFormElementResponse = {
  refId: string;
  status: 'success' | 'error';
}