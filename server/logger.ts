function timestamp(): string {
  return new Date().toISOString();
}

export function logInfo(component: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    level: "INFO",
    ts: timestamp(),
    component,
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export function logWarn(component: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    level: "WARN",
    ts: timestamp(),
    component,
    message,
    ...data,
  };
  console.warn(JSON.stringify(entry));
}

export function logError(component: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    level: "ERROR",
    ts: timestamp(),
    component,
    message,
    ...data,
  };
  console.error(JSON.stringify(entry));
}
