import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { createDir, writeTextFile } from "@tauri-apps/api/fs";

type LogPayload = Record<string, unknown>;

const LOG_DIRNAME = "logs";
const LOG_FILENAME = "cloud.log";

const ensureLogDir = async (): Promise<string | null> => {
  try {
    const baseDir = await appLocalDataDir();
    const logDir = await join(baseDir, LOG_DIRNAME);
    await createDir(logDir, { recursive: true });
    return logDir;
  } catch (error) {
    console.error("[cloud-log] Failed to resolve log dir:", error);
    return null;
  }
};

export const logCloudAction = async (
  event: string,
  payload: LogPayload = {},
): Promise<void> => {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log("[cloud-log]", entry);

  try {
    const logDir = await ensureLogDir();
    if (!logDir) return;
    const logPath = await join(logDir, LOG_FILENAME);
    await writeTextFile(logPath, `${JSON.stringify(entry)}\n`, {
      append: true,
    });
  } catch (error) {
    console.error("[cloud-log] Failed to write log:", error);
  }
};