// "Claude" (ADR 4): connect your own API key, remove it, and pick the
// model, each named with its trade-off. The key is saved straight to storage and never shown again; the
// panel only ever says whether one is saved.
import { useState } from "react";
import {
  CLAUDE_MODELS,
  defaultSettings,
  parseApiKey,
} from "../../../rules/profile";
import type { ClaudeModel } from "../../../rules/types";
import { remove, write } from "../../../storage/storage";
import { cx } from "../../cx";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { SelectField, TextField } from "../../components/TextField/TextField";
import { useStored } from "../../hooks/useStored";
import styles from "./ClaudeCard.module.css";

const KEYS_URL = "https://platform.claude.com/settings/keys";

const MODEL_LABELS: Record<ClaudeModel, string> = {
  "claude-sonnet-5-5": "Sonnet 5.5 (default)",
  "claude-opus-5-5": "Opus 5.5 (best letters)",
  "claude-fable-5-1": "Fable 5.1 (most capable)",
  "claude-haiku-5-5": "Haiku 5.5 (cheapest)",
};

const MODELS = CLAUDE_MODELS.map((value) => ({
  value,
  label: MODEL_LABELS[value],
}));

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
  // A removal or model change storage refused; cleared by the next action.
  const [failure, setFailure] = useState<string>();
  const connected = apiKey.status === "ready" && apiKey.value !== undefined;
  const { model } =
    settings.status === "ready" && settings.value
      ? settings.value
      : defaultSettings();

  const onRemove = (): void => {
    setFailure(undefined);
    remove("apiKey").catch(() => {
      setFailure("Your key could not be removed. Try again.");
    });
  };

  const onModel = (next: ClaudeModel): void => {
    setFailure(undefined);
    write("settings", { model: next }).catch(() => {
      setFailure("The model could not be changed. Try again.");
    });
  };

  const onSave = (): void => {
    setFailure(undefined);
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
          <Button onClick={onRemove}>Remove key</Button>
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
        onChange={onModel}
      />
      <p className={cx(styles.text, "type-body-sm")}>{MODEL_HINTS[model]}</p>
      {failure && (
        <p className={cx(styles.line, "type-body-sm")} role="alert">
          <ExclamationIcon size={18} />
          {failure}
        </p>
      )}
    </Card>
  );
}
