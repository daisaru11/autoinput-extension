import { useEffect, useRef, useState } from "react";
import "./App.css";
import { FormElementInfo } from "./types";
import * as webllm from "@mlc-ai/web-llm";

function App() {
  const [formElements, setFormElements] = useState<FormElementInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const engine = useRef<webllm.MLCEngineInterface | null>(null);
  const engineInitializing = useRef<boolean>(false);

  const handleGetFormElements = async () => {
    try {
      setError(null);
      // アクティブなタブにメッセージを送信
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) {
        throw new Error("アクティブなタブが見つかりません");
      }

      // コンテンツスクリプトが読み込まれているか確認
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getFormElements",
      });
      if (response && response.formElements) {
        setFormElements(response.formElements);
        handleFoundFormElements(response.formElements);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(
        "フォーム要素の取得に失敗しました。ページをリロードしてから再度お試しください。"
      );
    }
  };

  const handleFoundFormElements = async (formElements: FormElementInfo[]) => {
    if (!engine.current) {
      return;
    }

    for (const formElement of formElements) {
      if (formElement.value !== "") {
        continue;
      }

      const inputData = {
        type: formElement.type,
        label: formElement.label,
        name: formElement.name,
        ariaLabel: formElement.ariaLabel,
        placeholder: formElement.placeholder,
      };
      const prompt = `HTML内のinput要素を構造化したデータが与えられます。
これらの項目に自動入力するためのテストデータを生成します。
テストデータは、一般的に自然だと考えられる文字列です。
 
- placeholder がある場合は、それを参考に同じ形式の文字列を生成する
- placeholder と全く同じ文字列は避ける

入力データの形式は以下の通りです。

\`\`\`
{
  type: string;          // input, select, textarea など
  label: string | null;  // 関連するラベルテキスト
  name: string | null;   // name 属性
  ariaLabel: string | null;    // aria-label
  placeholder: string | null;  // プレースホルダー
} 
\`\`\`

出力は以下の形式で出力します。余計な出力はしないでください。

\`\`\`
{"value": string}
\`\`\`
`;
      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(inputData) },
      ];
      const reply = await engine.current.chat.completions.create({
        messages,
        temperature: 0.5,
      });
      console.log(reply.choices[0].message);

      if (!reply.choices[0].message.content) {
        continue;
      }

      let valueString = reply.choices[0].message.content;
      valueString = valueString.trim();
      valueString = valueString.replace(/^```/, "").replace(/^json/, "").replace(/```$/, "");

      let value: string;
      try {
        value = JSON.parse(valueString).value;
      } catch (err) {
        console.error("Error:", err);
        continue;
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) {
        throw new Error("アクティブなタブが見つかりません");
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "fillFormElement",
        refId: formElement.refId,
        value,
      });
      if (response && response.status === "success") {
        console.log("フォーム要素を自動入力しました");
      } else {
        console.error("フォーム要素の自動入力に失敗しました");
      }
    }
  };

  useEffect(() => {
    if (engine.current) {
      return;
    }
    if (engineInitializing.current) {
      return;
    }

    engineInitializing.current = true;

    const initProgressCallback = (report: webllm.InitProgressReport) => {
      console.log(report);
      setStatus(report.text);
    };

    const selectedModel = "gemma-2-2b-jpn-it-q4f16_1-MLC";
    // const selectedModel = "gemma-2-2b-jpn-it-q4f32_1-MLC";
    const initEngine = async () => {
      const modelVersion = "v0_2_48";
      const modelLibURLPrefix =
        "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/";

      const appConfig: webllm.AppConfig = {
        model_list: [
          {
            model:
              "https://huggingface.co/mlc-ai/gemma-2-2b-jpn-it-q4f16_1-MLC",
            model_id: "gemma-2-2b-jpn-it-q4f16_1-MLC",
            model_lib:
              modelLibURLPrefix +
              modelVersion +
              "/gemma-2-2b-jpn-it-q4f16_1-ctx4k_cs1k-webgpu.wasm",
            vram_required_MB: 1895.3,
            low_resource_required: true,
            required_features: ["shader-f16"],
            overrides: {
              context_window_size: 4096,
            },
          },
          // {
          //   model: "https://huggingface.co/mlc-ai/gemma-2-2b-jpn-it-q4f32_1-MLC",
          //   model_id: "gemma-2-2b-jpn-it-q4f32_1-MLC",
          //   model_lib:
          //     modelLibURLPrefix +
          //     modelVersion +
          //     "/gemma-2-2b-jpn-it-q4f32_1-ctx4k_cs1k-webgpu.wasm",
          //   vram_required_MB: 2508.75,
          //   low_resource_required: true,
          //   overrides: {
          //     context_window_size: 4096,
          //   },
          // },
        ],
      };
      setStatus("モデルを読み込んでいます...");
      engine.current = await webllm.CreateMLCEngine(selectedModel, {
        appConfig: appConfig,
        initProgressCallback: initProgressCallback,
        logLevel: "INFO",
      });
      engineInitializing.current = false;
    };
    initEngine();
  }, []);

  return (
    <>
      <h1>Auto Input Extension</h1>
      <div className="card">
        <button onClick={handleGetFormElements}>フォームを自動入力</button>
      </div>
      {error && <div className="error">{error}</div>}
      {status && <div className="status">{status}</div>}
      {formElements.length > 0 && (
        <div className="form-elements">
          <h4>取得したフォーム要素:</h4>
          <pre>{JSON.stringify(formElements, null, 2)}</pre>
        </div>
      )}
    </>
  );
}

export default App;
