// "Claude" (ADR 4): connect your own API key, remove it, and pick the
// model, each named with its trade-off. The key is saved straight to storage and never shown again; the
// panel only ever says whether one is saved.
import { useState } from "react";
import { defaultSettings, parseApiKey } from "../../../rules/profile";
import type { ClaudeModel } from "../../../rules/types";
import { remove, write } from "../../../storage/storage";
import { cx } from "../../cx";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { TickIcon } from "../../components/Icons/Icons";
import { SelectField, TextField } from "../../components/TextField/TextField";
import { useStored } from "../../hooks/useStored";
import styles from "./ClaudeCard.module.css";

const KEYS_URL = "https://platform.claude.com/settings/keys";

const MODELS: readonly { value: ClaudeModel; label: string }[] = [
  { value: "claude-sonnet-5-5", label: "Sonnet 5.5 (default)" },
  { value: "claude-opus-5-5", label: "Opus 5.5 (best letters)" },
  { value: "claude-fable-5-1", label: "Fable 5.1 (most capable)" },
  { value: "claude-haiku-5-5", label: "Haiku 5.5 (cheapest)" },
];

// Costs and speed from the six-letter comparison in the ADR 4 amendment.
const MODEL_HINTS: Record<ClaudeModel, string> = {
  "claude-sonnet-5-5": "Fast, about 1 cent a letter.",
  "claude-opus-5-5":
    "The strongest letters in our tests, about 3 cents and 12 seconds a letter.",
  "claude-fable-5-1":
    "Up to 15 cents and half a minute a letter. Needs 30-day data retention on your Anthropic organisation, or every letter fails.",
  "claude-haiku-5-5": "Under a cent a letter, but misses more letter checks.",
};

export function ClaudeCard() {
  const apiKey = useStored("apiKey");
  const settings = useStored("settings");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const connected = apiKey.status === "ready" && apiKey.value !== undefined;
  const { model } =
    settings.status === "ready" && settings.value
      ? settings.value
      : defaultSettings();

  const onSave = (): void => {
    const parsed = parseApiKey(typed);
    if (!parsed.ok) {
      setError("Paste the whole key. It has no spaces.");
      return;
    }
    write("apiKey", parsed.value).then(
      () => {
        setTyped("");
        setError(undefined);
      },
      () => {
        setError("Your key could not be saved. Try again.");
      },
    );
  };

  return (
    <Card title="Claude">
      {connected ? (
        <>
          <p className={cx(styles.line, "type-body-sm")}>
            <TickIcon size={18} />
            Connected. Your key is saved in this browser only.
          </p>
          <Button
            onClick={() => {
              void remove("apiKey");
            }}
          >
            Remove key
          </Button>
        </>
      ) : (
        <>
          <p className={cx(styles.text, "type-body-sm")}>
            Letters are written by Claude with your own Anthropic API key. Each
            letter is billed to your Anthropic account; the model below sets the
            price. The key stays in this browser and goes only to Anthropic.
          </p>
          <a
            className={cx(styles.link, "type-label")}
            href={KEYS_URL}
            target="_blank"
            rel="noreferrer"
          >
            Create a key in the Anthropic console
          </a>
          <TextField
            label="API key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            error={error}
            onChange={setTyped}
          />
          <Button onClick={onSave}>Save key</Button>
        </>
      )}
      <SelectField
        label="Model"
        options={MODELS}
        value={model}
        onChange={(next) => {
          void write("settings", { model: next });
        }}
      />
      <p className={cx(styles.text, "type-body-sm")}>{MODEL_HINTS[model]}</p>
    </Card>
  );
}
